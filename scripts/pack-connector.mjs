import { mkdir, readFile, writeFile, mkdtemp, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyTemplate } from '../connector/template.mjs';
await mkdir('dist', { recursive: true });
const stage = await mkdtemp(join(tmpdir(), 'saasagents-pack-'));
try {
  for (const file of ['cli.mjs', 'init.mjs', 'template.mjs', 'package.json', 'README.md']) await cp('connector/' + file, join(stage, file));
  await copyTemplate(process.cwd(), join(stage, 'template'));
  execFileSync('npm', ['pack', stage, '--pack-destination', resolve('dist'), '--ignore-scripts'], { stdio: 'inherit' });
} finally { await rm(stage, { recursive: true, force: true }); }
const { name, version } = JSON.parse(await readFile('connector/package.json', 'utf8'));
const file = `${name}-${version}.tgz`;
const hash = createHash('sha256').update(await readFile('dist/' + file)).digest('hex');
await writeFile('dist/SHA256SUMS', `${hash}  ${file}\n`);
