import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Pacote de instalação contém somente o produto; nunca inclui dados, histórico ou secrets.
export const templateFiles = [
  'package.json', 'package-lock.json', 'wrangler.jsonc',
  'src', 'public', 'migrations', 'tests',
  '.github/workflows/install-client.yml',
  'scripts/provision.mjs', 'scripts/client-install.mjs', 'scripts/pack-connector.mjs', 'scripts/dev.mjs',
  'connector/cli.mjs', 'connector/init.mjs', 'connector/template.mjs', 'connector/package.json', 'connector/README.md',
  'docs/INSTALACAO-CLIENTE.md',
];
export async function copyTemplate(source, destination) {
  for (const file of templateFiles) {
    const target = resolve(destination, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(resolve(source, file), target, { recursive: true });
  }
  await cp(resolve(source, 'docs/INSTALACAO-CLIENTE.md'), resolve(destination, 'README.md'));
  // npm não preserva .gitignore no tarball: recria ao gerar o repositório do cliente.
  await writeFile(resolve(destination, '.gitignore'), '.env\n.env.*\n.secrets/\n.dev.vars*\nnode_modules/\n.wrangler/\ndist/\n*.log\nwrangler.client.json\nwrangler.deploy.json\nwrangler.local.json\nclient-installation.json\n');
}
export async function assertTemplate(source) {
  const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'saasagents') throw new Error('Template do produto não encontrado. Reinstale o pacote oficial.');
}
