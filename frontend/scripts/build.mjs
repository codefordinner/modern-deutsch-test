import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function getBuildVersion() {
  const explicit = process.env.BUILD_VERSION || process.env.GITHUB_SHA;
  if (explicit) return explicit.slice(0, 12);

  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

const version = getBuildVersion();
execFileSync('npx', ['tsc', '-b'], { cwd: root, stdio: 'inherit' });
await build({ configFile: resolve(root, 'vite.config.ts') });

const serviceWorkerTemplate = await readFile(resolve(root, 'public/sw.js'), 'utf8');
const serviceWorker = serviceWorkerTemplate.replaceAll('__BUILD_VERSION__', version);
const outputPath = resolve(root, 'dist/sw.js');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serviceWorker);

console.log(`Built frontend version ${version}`);
