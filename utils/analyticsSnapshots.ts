import type { ModrinthProject } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_DAYS = 90;
const MAX_HISTORY_MS = MAX_HISTORY_DAYS * DAY_MS;

export type AnalyticsSnapshot = {
  capturedAt: number;
  revenueLifetime?: number;
  projects: Record<string, { downloads: number; followers: number }>;
};

type WeeklyProjectDelta = {
  id: string;
  title: string;
  icon_url?: string;
  downloads: number;
  followers: number;
};

const normalizeOptionalMetric = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export const createAnalyticsSnapshot = (projects: ModrinthProject[], capturedAt = Date.now(), revenueLifetime?: number | null): AnalyticsSnapshot => ({
  capturedAt,
  revenueLifetime: normalizeOptionalMetric(revenueLifetime),
  projects: projects.reduce<AnalyticsSnapshot['projects']>((acc, project) => {
    acc[project.id] = {
      downloads: Number(project.downloads) || 0,
      followers: Number(project.followers) || 0
    };
    return acc;
  }, {})
});

const isAnalyticsSnapshot = (value: unknown): value is AnalyticsSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as AnalyticsSnapshot;
  const hasValidRevenue = snapshot.revenueLifetime === undefined || typeof snapshot.revenueLifetime === 'number';
  return typeof snapshot.capturedAt === 'number' && snapshot.projects !== null && typeof snapshot.projects === 'object' && hasValidRevenue;
};

export const readAnalyticsSnapshots = (storageKey: string): AnalyticsSnapshot[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAnalyticsSnapshot) : [];
  } catch {
    return [];
  }
};

const getSnapshotDay = (timestamp: number) => Math.floor(timestamp / DAY_MS);

export const compactAnalyticsSnapshots = (snapshots: AnalyticsSnapshot[], now = Date.now()) => {
  const validSnapshots = snapshots.filter(isAnalyticsSnapshot).sort((a, b) => a.capturedAt - b.capturedAt);
  const cutoff = now - MAX_HISTORY_MS;
  const latestBeforeCutoff = [...validSnapshots].reverse().find((snapshot) => snapshot.capturedAt <= cutoff);
  const latestByDay = new Map<number, AnalyticsSnapshot>();

  validSnapshots.filter((snapshot) => snapshot.capturedAt > cutoff).forEach((snapshot) => {
    latestByDay.set(getSnapshotDay(snapshot.capturedAt), snapshot);
  });

  const compacted = [...latestByDay.values()].sort((a, b) => a.capturedAt - b.capturedAt);
  return latestBeforeCutoff ? [latestBeforeCutoff, ...compacted] : compacted;
};

export const saveAnalyticsSnapshot = (storageKey: string, snapshot: AnalyticsSnapshot) => {
  const snapshots = compactAnalyticsSnapshots([...readAnalyticsSnapshots(storageKey), snapshot], snapshot.capturedAt);
  localStorage.setItem(storageKey, JSON.stringify(snapshots));
};

export const calculateWeeklySummary = (
  projects: ModrinthProject[],
  snapshots: AnalyticsSnapshot[],
  revenueLifetime: number | null,
  now = Date.now(),
  rangeDays = 7,
  baselineOverride?: AnalyticsSnapshot | null
) => {
  const safeRangeDays = Math.min(MAX_HISTORY_DAYS, Math.max(1, Math.round(rangeDays)));
  const rangeMs = safeRangeDays * DAY_MS;
  const currentSnapshot = createAnalyticsSnapshot(projects, now, revenueLifetime);
  const retainedSnapshots = compactAnalyticsSnapshots([...snapshots, currentSnapshot], now);
  const baseline =
    baselineOverride ??
    [...retainedSnapshots].reverse().find((snapshot) => snapshot.capturedAt <= now - rangeMs) ??
    retainedSnapshots[0] ??
    currentSnapshot;

  const projectDeltas: WeeklyProjectDelta[] = projects.map(project => {
    const current = currentSnapshot.projects[project.id] || { downloads: 0, followers: 0 };
    const previous = baseline.projects[project.id] || { downloads: current.downloads, followers: current.followers };
    return {
      id: project.id,
      title: project.title,
      icon_url: project.icon_url,
      downloads: Math.max(0, current.downloads - previous.downloads),
      followers: Math.max(0, current.followers - previous.followers)
    };
  });

  const downloads = projectDeltas.reduce((sum, project) => sum + project.downloads, 0);
  const followers = projectDeltas.reduce((sum, project) => sum + project.followers, 0);
  const revenue =
    currentSnapshot.revenueLifetime !== undefined && baseline.revenueLifetime !== undefined
      ? Math.max(0, currentSnapshot.revenueLifetime - baseline.revenueLifetime)
      : null;
  const activeProjects = projectDeltas.filter(project => project.downloads > 0 || project.followers > 0).length;
  const daysTracked = Math.min(safeRangeDays, Math.max(1, Math.ceil((now - baseline.capturedAt) / DAY_MS)));
  const topProject = [...projectDeltas].sort((a, b) => (b.downloads + b.followers) - (a.downloads + a.followers))[0] || null;

  return {
    downloads,
    followers,
    revenue,
    activeProjects,
    daysTracked,
    topProject,
    projectDeltas: projectDeltas.sort((a, b) => (b.downloads + b.followers) - (a.downloads + a.followers)),
    rangeDays: safeRangeDays,
    isBaselineReady: baseline !== currentSnapshot && now - baseline.capturedAt >= DAY_MS
  };
};
