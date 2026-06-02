import type { Language, ModrinthProject } from '../types';

const PROJECT_SORT_KEY = 'project_sort_mode';
const FAVORITE_PROJECTS_KEY_PREFIX = 'favorite_projects';

export type ProjectSortMode = 'popularity' | 'updated' | 'followers' | 'title';

export const PROJECT_SORT_OPTIONS: ProjectSortMode[] = ['popularity', 'updated', 'title'];

export const getStoredProjectSortMode = (): ProjectSortMode => {
  const raw = localStorage.getItem(PROJECT_SORT_KEY);
  return raw === 'updated' || raw === 'followers' || raw === 'title' ? raw : 'popularity';
};

export const saveProjectSortMode = (mode: ProjectSortMode) => {
  localStorage.setItem(PROJECT_SORT_KEY, mode);
};

export const sortProjectsByMode = (projects: ModrinthProject[], mode: ProjectSortMode) => {
  const sorted = [...projects];
  const titleOf = (project: ModrinthProject) => project.title || project.name || project.slug || project.id;

  if (mode === 'updated') {
    return sorted.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  }

  if (mode === 'followers') {
    return sorted.sort((a, b) => b.followers - a.followers);
  }

  if (mode === 'title') {
    return sorted.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  }

  return sorted.sort((a, b) => b.downloads - a.downloads);
};

export const formatProjectsCountLabel = (count: number, language: Language, t: (key: string) => string) => {
  if (language !== 'ru') {
    return `${count} ${t('projects_label')}`;
  }

  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} проект`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} проекта`;
  }

  return `${count} проектов`;
};

const getFavoriteProjectsKey = (userId: string) => `${FAVORITE_PROJECTS_KEY_PREFIX}_${userId}`;

export const readFavoriteProjectIds = (userId: string) => {
  try {
    const raw = localStorage.getItem(getFavoriteProjectsKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const saveFavoriteProjectIds = (userId: string, ids: string[]) => {
  localStorage.setItem(getFavoriteProjectsKey(userId), JSON.stringify(ids));
};
