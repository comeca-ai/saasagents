#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { resolve, relative, sep, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

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
async function main() {
  const args = process.argv.slice(2), command = args[0] || 'help';
  const root = await realpath(process.cwd()), configPath = resolve(root, '.secrets/connector.json');
  if (command === 'inspect') { process.stdout.write(JSON.stringify(await collect(root), null, 2) + '\n'); return; }
  if (command === 'connect') {
    const urlArg = args[args.indexOf('--url') + 1];
    if (!args.includes('--url')) throw new Error('Use connect --url https://seu-painel.workers.dev');
    const url = new URL(urlArg);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) throw new Error('Use HTTPS.');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Informe somente a origem do painel.');
    console.log('Pasta autorizada: ' + root + '\nLeitura proposta: README.md, BACKLOG.md, STATUS.md, package.json e até 8 tickets/*.md.\nMetadados: nomes dos itens na raiz, branch e estado do Git. Sem .env, mapas de acesso ou arquivos fora da pasta.');
    if (!args.includes('--approve-read')) {
      const consent = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await consent.question('Autoriza esse escopo de leitura e envio ao painel? [s/N] '); consent.close();
      if (answer.trim().toLowerCase() !== 's') throw new Error('Leitura não autorizada.');
    }
    let token = process.env.SAASAGENTS_CONNECTOR_TOKEN;
    if (!token) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      token = await rl.question('Cole o token do conector (exibido somente ao criar no painel): '); rl.close();
    }
    if (!token || token.length < 32) throw new Error('Token inválido.');
    const payload = await collect(root);
    const response = await fetch(url.origin + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.trim() }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) throw new Error(`Conexão recusada (HTTP ${response.status}).`);
    await mkdir(resolve(root, '.secrets'), { recursive: true, mode: 0o700 });
    await writeFile(configPath, JSON.stringify({ url: url.origin, token: token.trim(), root, approved_read: true }, null, 2), { mode: 0o600 });
    console.log('Conector vinculado. Primeiro snapshot enviado. Use: node connector/cli.mjs sync --watch'); return;
  }
  if (command === 'sync') {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    if (!config.approved_read) throw new Error('Escopo ainda não autorizado.');
    if (config.root !== root) throw new Error('Configuração pertence a outra pasta. Faça connect novamente.');
    const sync = async () => {
      try {
        const response = await fetch(config.url + '/api/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.token }, body: JSON.stringify(await collect(root)), signal: AbortSignal.timeout(20000), redirect: 'error' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(new Date().toISOString() + ' — contexto atualizado');
      } catch { console.error('Não foi possível sincronizar. Verifique conexão e token do projeto.'); if (!args.includes('--watch')) process.exitCode = 1; }
    };
    await sync();
    if (args.includes('--watch')) setInterval(sync, 60000);
    return;
  }
  console.log('Mesa dos Agentes — execute na raiz do projeto\n  node connector/cli.mjs inspect\n  node connector/cli.mjs connect --url https://seu-painel.workers.dev\n  node connector/cli.mjs sync [--watch]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => { console.error('Não foi possível concluir. Confira a pasta, URL e configuração local do conector.'); process.exitCode = 1; });
