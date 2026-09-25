#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, realpath, chmod, rename, lstat, unlink } from 'node:fs/promises';
import { resolve, relative, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';

const excluded = new Set(['.git', '.secrets', '.agents', '.codex', '.npm-cache', 'node_modules', '.wrangler', 'dados', 'artefato', 'test-results', 'playwright-report']);
export function redact(text) {
  return text
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, '[CHAVE PRIVADA OMITIDA]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/g, '[CREDENCIAL OMITIDA]')
    .replace(/((?:token|password|senha|secret|api[_ -]?key|authorization)\s*[:=]\s*)[^\s\n]+/gi, '$1[OMITIDO]');
}
async function safeRead(root, file) {
  const path = await realpath(resolve(root, file)).catch(() => null);
  if (!path || !path.startsWith(root + sep)) return '';
  const buffer = await readFile(path);
  if (buffer.length > 100000) return '';
  return redact(buffer.toString('utf8')).slice(0, 4000);
}
function git(root, args) {
  try { return execFileSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', timeout: 5000, maxBuffer: 500000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
}
export async function collect(directory) {
  const root = await realpath(directory);
  const gitRoot = git(root, ['rev-parse', '--show-toplevel']);
  if (gitRoot && gitRoot !== root) throw new Error('Use a raiz do repositório; o conector não lê projetos pais.');
  const entries = await readdir(root, { withFileTypes: true });
  const files = entries.filter(e => !e.name.startsWith('.') && !excluded.has(e.name)).map(e => e.name);
  const docs = ['README.md', 'BACKLOG.md', 'STATUS.md', 'package.json'];
  const ticketRoot = await realpath(resolve(root, 'tickets')).catch(() => null);
  const tickets = ticketRoot && ticketRoot.startsWith(root + sep) ? await readdir(ticketRoot, { withFileTypes: true }).catch(() => []) : [];
  // Somente a lista explícita acima e até oito tickets Markdown. Não lê .env ou mapas de acesso.
  for (const entry of tickets.filter(e => e.isFile() && e.name.endsWith('.md')).sort((a,b) => a.name.localeCompare(b.name)).slice(0,8)) docs.push('tickets/' + entry.name);
  const chunks = [];
  for (const file of docs) { const content = await safeRead(root, file); if (content) chunks.push(`### ${file}\n${content}`); }
  const changes = git(root, ['status', '--short', '--untracked-files=normal']).split('\n').filter(line => {
    const path = line.slice(3).replace(/^"|"$/g, '');
    return !path.split('/').some(part => part.startsWith('.') || excluded.has(part)) && !/\.(?:pem|key)$/.test(path);
  }).join('\n');
  return { project: basename(root), branch: git(root, ['branch', '--show-current']).slice(0,160), changes: redact(changes).slice(0,4000), files_count: files.length, overview: ('Arquivos e pastas na raiz: ' + files.join(', ') + '\n\n' + chunks.join('\n\n')).slice(0,12000) };
}
export function panelOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL inválida. Informe a origem HTTPS do painel.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Use HTTPS (HTTP somente em localhost).');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Informe somente a origem do painel, sem credenciais ou caminho.');
  return url.origin;
}
async function ask(question, secret = false) {
  if (!process.stdin.isTTY) throw new Error('Sem terminal interativo: informe --approve-read e SAASAGENTS_CONNECTOR_TOKEN no ambiente.');
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const answer = rl.question(question);
    muted = secret;
    return await answer;
  } finally { rl.close(); if (secret) process.stdout.write('\n'); }
}
async function configFile(root) {
  const dir = resolve(root, '.secrets');
  const stat = await lstat(dir).catch(e => { if (e.code !== 'ENOENT') throw e; });
  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error('.secrets precisa ser uma pasta local, não um link.');
  const path = resolve(dir, 'connector.json');
  const file = await lstat(path).catch(e => { if (e.code !== 'ENOENT') throw e; });
  if (file && (!file.isFile() || file.isSymbolicLink())) throw new Error('Configuração deve ser um arquivo local, não um link.');
  return path;
}
export async function readConfig(root) {
  const path = await configFile(root);
  let config;
  try { config = JSON.parse(await readFile(path, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw new Error('Configuração local inválida.'); }
  if (!config.approved_read || config.root !== root) throw new Error('Configuração não autorizada para esta pasta.');
  config.url = panelOrigin(config.url);
  if (typeof config.token !== 'string' || config.token.length < 32) throw new Error('Token local inválido.');
  return config;
}
export async function saveConfig(root, config) {
  const path = await configFile(root), dir = resolve(root, '.secrets');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  // O token não deve aparecer em git add, mesmo em um projeto sem .gitignore.
  const ignoreTemp = resolve(dir, '.gitignore.' + randomUUID());
  try {
    await writeFile(ignoreTemp, '*\n', { flag: 'wx', mode: 0o600 });
    await rename(ignoreTemp, resolve(dir, '.gitignore'));
  } finally { await unlink(ignoreTemp).catch(() => {}); }
  const temp = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temp, path);
  } finally { await unlink(temp).catch(() => {}); }
}
export async function health(url) {
  let response;
  try { response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(20000), redirect: 'error' }); }
  catch { throw new Error('Painel inacessível. Confira a URL e a conexão de rede.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true || data.service !== 'saasagents-v0') throw new Error('Worker/banco não confirmaram saúde. Nenhum snapshot enviado.');
}
export async function sendSnapshot(config, payload) {
  let response;
  try {
    response = await fetch(config.url + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000), redirect: 'error' });
  } catch { throw new Error('Falha de rede durante o envio. Não houve repetição automática; confira o painel antes de tentar novamente.'); }
  if (!response.ok) throw new Error(`Conexão recusada (HTTP ${response.status}). Verifique o token desse projeto no painel.`);
}
export async function main(argv = process.argv.slice(2)) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Instale Node.js 22 ou superior.');
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
    url: { type: 'string' }, directory: { type: 'string' }, 'approve-read': { type: 'boolean' },
    watch: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    repo: { type: 'string' }, name: { type: 'string' }, account: { type: 'string' },
  } });
  if (values.version) { console.log('saasagents 0.1.0'); return; }
  const command = values.help ? 'help' : positionals[0] || 'help';
  if (positionals.length > 1 || !['help', 'init', 'install', 'connect', 'inspect', 'sync', 'status'].includes(command)) throw new Error('Comando inválido. Use saasagents --help.');
  if (values.watch && command !== 'sync') throw new Error('--watch só pode ser usado com sync; install executa um único teste.');
  if (command === 'help') {
    console.log(`Mesa dos Agentes — conector para Node.js 22+
  saasagents init [--repo conta/novo-repo] [--name mesa-cliente] [--account ID]
    Escolhe GitHub/Cloudflare, confirma, cria repo privado e dispara os Actions.
  saasagents install [--directory /pasta] [--url https://painel]
    Assistente: verifica Worker/D1, confirma leitura, envia UM snapshot e termina.
  saasagents inspect [--directory /pasta]   Visualiza o contexto sem enviar
  saasagents status [--directory /pasta]    Verifica a configuração e o Worker/D1
  saasagents sync [--directory /pasta] [--watch]
    Envia uma vez; --watch mantém envio a cada minuto enquanto estiver aberto.
  saasagents connect --url https://painel   Compatibilidade com a v0

Token: reutiliza .secrets/connector.json da pasta ou SAASAGENTS_CONNECTOR_TOKEN.
Sem token disponível, pede um novo no terminal (entrada oculta).
--approve-read confirma explicitamente o escopo em execução não interativa.
install/sync não instalam serviço, não executam comandos remotos nem chamam IA.
`); return;
  }
  if (command === 'init') {
    const { initialize } = await import('./init.mjs');
    await initialize(values, ask);
    return;
  }
  const root = await realpath(resolve(values.directory || process.cwd()));
  if (command === 'inspect') { console.log(JSON.stringify(await collect(root), null, 2)); return; }
  const previous = await readConfig(root);
  if (command === 'install' || command === 'connect') {
    const url = panelOrigin(values.url || previous?.url || (await ask('URL do novo painel (resultado dos Actions): ')).trim());
    console.log(`Mesa dos Agentes — instalação e teste único
Pasta: ${root}
Painel: ${url}
Node.js: ${process.versions.node}
Leitura: README.md, BACKLOG.md, STATUS.md, package.json e até 8 tickets/*.md.
Metadados: nomes na raiz, branch e estado do Git.
Sem .env, mapas de acesso ou arquivos fora da pasta.
O painel e a IA ficam na Cloudflare; este CLI conecta a pasta ao projeto do token.`);
    await health(url);
    console.log('Worker + banco D1: OK.');
    if (!values['approve-read'] && (await ask('Confirma essa integração e autoriza a leitura/envio de um snapshot? [s/N] ')).trim().toLowerCase() !== 's') throw new Error('Cancelado. Nenhum contexto enviado.');
    // Nunca reutiliza um token em outro destino por causa de --url.
    let token = process.env.SAASAGENTS_CONNECTOR_TOKEN || (previous?.url === url ? previous.token : null);
    if (!token) token = await ask('Token do projeto (entrada oculta): ', true);
    token = token.trim();
    if (token.length < 32 || token.length > 240 || /\s/.test(token)) throw new Error('Token inválido. Gere um token de conector no painel.');
    const config = { url, token, root, approved_read: true };
    const payload = await collect(root);
    await sendSnapshot(config, payload);
    try { await saveConfig(root, config); }
    catch { throw new Error('O snapshot foi enviado, mas a configuração não pôde ser salva. Confira as permissões da pasta; o teste não foi repetido.'); }
    console.log(`Token do projeto: aceito. Snapshot: recebido.
Teste único concluído. Nenhum processo ficou em segundo plano.
Abra ${url} e selecione o projeto para ver o contexto.
Para outro envio: saasagents sync --directory ${JSON.stringify(root)}`);
    return;
  }
  if (!previous) throw new Error('Pasta ainda não conectada. Execute saasagents install.');
  if (command === 'status') {
    await health(previous.url);
    console.log(`Pasta: ${root}\nPainel: ${previous.url}\nWorker + banco D1: OK.\nConfiguração local: presente. Token não testado; use sync para validar o envio.`);
    return;
  }
  const sync = async () => {
    await sendSnapshot(previous, await collect(root));
    console.log(new Date().toISOString() + ' — contexto atualizado');
  };
  await sync();
  if (values.watch) {
    // Agenda somente depois de terminar, evitando envios sobrepostos.
    const next = async () => { try { await sync(); } catch (e) { console.error(e.message); } setTimeout(next, 60000); };
    setTimeout(next, 60000);
  }
}
const invoked = process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null);
if (invoked && import.meta.url === pathToFileURL(invoked).href) main().catch(error => {
  // Mensagens de fetch/config são controladas; argumentos arbitrários não aparecem no erro.
  console.error(error.code ? 'Não foi possível concluir. Confira argumentos, pasta e permissões; use --help.' : error.message);
  process.exitCode = 1;
});
