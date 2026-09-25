// Gera e serve a interface de instalação numa porta local (Codespaces encaminha a porta).
// Uso: npm run interface:serve   (porta padrão 4173; mude com PORT=8080)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 4173;
const build = () => execFileSync(process.execPath, [join(root, 'scripts', 'build-interface.mjs')], { stdio: 'inherit' });

build();
createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/' && path !== '/index.html') {
    res.writeHead(path === '/favicon.ico' ? 204 : 404).end();
    return;
  }
  try {
    build(); // sempre a versão mais recente dos arquivos do repositório
    const html = await readFile(join(root, 'interface', 'dist', 'index.html'));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Falha ao gerar a interface: ' + error.message);
  }
}).listen(port, '0.0.0.0', () => {
  const cs = process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : `http://localhost:${port}`;
  console.log(`Interface da Mesa dos Agentes em ${cs}`);
});
