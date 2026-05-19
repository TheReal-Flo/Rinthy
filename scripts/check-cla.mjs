import { readFile } from 'node:fs/promises';

const SIGNATURE_TEXT = 'I have read the CLA Document and I hereby sign the CLA';
const SIGNATURES_PATH = new URL('../signatures/cla/v1.json', import.meta.url);
const ALLOWLIST = new Set(
  (process.env.CLA_ALLOWLIST ?? 'imsawiq,dependabot[bot],github-actions[bot],renovate[bot]')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
);

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const getEvent = async () => {
  if (!process.env.GITHUB_EVENT_PATH) return null;
  try {
    return await readJson(process.env.GITHUB_EVENT_PATH);
  } catch (error) {
    throw new Error(`Failed to read GitHub event payload: ${error.message}`);
  }
};

const hasStoredSignature = (signedContributors, user) =>
  signedContributors.some((contributor) => {
    const sameName = contributor.name?.toLowerCase() === user.login.toLowerCase();
    const sameId = Number(contributor.id) === Number(user.id);
    return sameName || sameId;
  });

const getPullRequestComments = async (event) => {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const pullRequestNumber = event?.pull_request?.number;

  if (!repository || !pullRequestNumber) return [];

  const comments = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${repository}/issues/${pullRequestNumber}/comments?per_page=100&page=${page}`;
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`GitHub comments request failed with ${response.status}: ${await response.text()}`);
    }

    const pageComments = await response.json();
    comments.push(...pageComments);
    if (pageComments.length < 100) return comments;
    page += 1;
  }
};

const hasPrCommentSignature = async (event, user) => {
  const comments = await getPullRequestComments(event);
  return comments.some((comment) => {
    const sameUser = Number(comment.user?.id) === Number(user.id);
    return sameUser && comment.body?.trim() === SIGNATURE_TEXT;
  });
};

const main = async () => {
  const signatures = await readJson(SIGNATURES_PATH);
  const signedContributors = signatures.signedContributors ?? [];

  if (!Array.isArray(signedContributors)) {
    throw new Error('signatures/cla/v1.json must contain a signedContributors array.');
  }

  const event = await getEvent();
  const author = event?.pull_request?.user;

  if (!author) {
    console.log('CLA signatures file is valid. No pull request author found in this run.');
    return;
  }

  if (ALLOWLIST.has(author.login)) {
    console.log(`CLA check skipped for allowlisted author ${author.login}.`);
    return;
  }

  if (hasStoredSignature(signedContributors, author)) {
    console.log(`CLA signed by ${author.login} in signatures/cla/v1.json.`);
    return;
  }

  if (await hasPrCommentSignature(event, author)) {
    console.log(`CLA signed by ${author.login} in PR #${event.pull_request.number} comments.`);
    return;
  }

  throw new Error(
    [
      `CLA is missing for ${author.login}.`,
      'Ask the contributor to read CLA.md and comment exactly:',
      SIGNATURE_TEXT,
    ].join('\n'),
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
