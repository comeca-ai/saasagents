// Gera a interface de instalação com os arquivos do cliente embutidos.
// Saída: interface/dist/index.html (página completa, publicada pelo GitHub Pages).
// Com --fragmento, grava também interface/dist/fragmento.html (sem <html>/<head>/<body>).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(join(root, path), 'utf8');

// Linhas marcadas com "# interno" só servem ao repositório da SaaS Agents (teste da branch).
export const clientWorkflow = text => text.split('\n').filter(line => !/#\s*interno\s*$/.test(line)).join('\n');

// O cliente recebe só o workflow e o executor; .saasagents/agentes.json é opcional.
const [template, workflow, runner] = await Promise.all([
  read('interface/index.html'),
  read('.github/workflows/agentes.yml'),
  read('.saasagents/run.mjs'),
]);
const payload = JSON.stringify({ workflow: clientWorkflow(workflow), runner }).replace(/</g, '\\u003c');
if (!template.includes('__ARQUIVOS__')) throw new Error('Marcador __ARQUIVOS__ ausente em interface/index.html');
const fragment = template.replace('__ARQUIVOS__', () => payload);
const page = `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${fragment}\n</body>\n</html>\n`;

await mkdir(join(root, 'interface', 'dist'), { recursive: true });
await writeFile(join(root, 'interface', 'dist', 'index.html'), page);
if (process.argv.includes('--fragmento')) await writeFile(join(root, 'interface', 'dist', 'fragmento.html'), fragment);
console.log(`interface/dist/index.html gerado (${page.length} bytes)`);
