import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.gradle',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.xml',
  '.yaml',
  '.yml',
]);

const MAX_TEXT_FILE_BYTES = 750_000;
const MAX_BINARY_FILE_BYTES = 5_000_000;
const SECRET_PATTERNS = [
  [/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9_]{36,}\b/, 'GitHub token'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'OpenAI-style API key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/, 'Slack token'],
];

const fail = (message) => failures.push(message);
const failures = [];

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('dist/'));

for (const file of trackedFiles) {
  const size = statSync(file).size;
  const extension = extname(file).toLowerCase();
  const isText = TEXT_EXTENSIONS.has(extension) || file.startsWith('.github/');

  if (!isText) {
    if (size > MAX_BINARY_FILE_BYTES) {
      fail(`${file}: binary file is ${(size / 1_000_000).toFixed(1)} MB; keep large generated assets out of git.`);
    }
    continue;
  }

  if (size > MAX_TEXT_FILE_BYTES) {
    fail(`${file}: text file is ${(size / 1_000).toFixed(1)} KB; split or generate it outside git.`);
  }

  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const allowsCliConsole = file.startsWith('scripts/');

  lines.forEach((line, index) => {
    const location = `${file}:${index + 1}`;

    if (/^(<<<<<<<|=======|>>>>>>>)(?: |$)/.test(line)) {
      fail(`${location}: unresolved merge conflict marker.`);
    }

    if (/[\u200B-\u200F\u202A-\u202E\u2060-\u206F]/u.test(line)) {
      fail(`${location}: suspicious invisible/bidirectional Unicode character.`);
    }

    if (/\bdebugger\s*;/.test(line)) {
      fail(`${location}: leftover debugger statement.`);
    }

    const previousLine = lines[index - 1] ?? '';
    const consoleLogAllowed =
      line.includes('eslint-disable-next-line no-console') ||
      previousLine.includes('eslint-disable-next-line no-console');

    if (/\bconsole\.log\s*\(/.test(line) && !consoleLogAllowed && !allowsCliConsole) {
      fail(`${location}: console.log must be removed or explicitly justified.`);
    }

    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        fail(`${location}: possible ${label} committed.`);
      }
    }
  });
}

const getLocaleKeys = async (localePath, exportName) => {
  const module = await import(new URL(`../${localePath}`, import.meta.url));
  return Object.keys(module[exportName]).sort();
};

const assertLocaleParity = async () => {
  const enKeys = await getLocaleKeys('locales/en.ts', 'en');
  const localeFiles = trackedFiles
    .filter((file) => /^locales\/[a-z]{2}\.ts$/.test(file))
    .filter((file) => file !== 'locales/en.ts');

  for (const file of localeFiles) {
    const exportName = file.match(/\/([a-z]{2})\.ts$/)?.[1];
    const keys = await getLocaleKeys(file, exportName);
    const missing = enKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !enKeys.includes(key));

    if (missing.length > 0) {
      fail(`${file}: missing translation keys: ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
      fail(`${file}: unknown translation keys: ${extra.join(', ')}`);
    }
  }
};

await assertLocaleParity();

if (failures.length > 0) {
  console.error(`Code quality check failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('Code quality check passed.');
}
