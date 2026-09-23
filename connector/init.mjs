import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { copyTemplate, assertTemplate } from './template.mjs';

export function repositoryName(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value)) throw new Error('Informe o novo repositório como conta/nome, sem URL.');
  return value;
}
export function installationName(value) {
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(value) || value.endsWith('-') || value === 'saasagents-v0') throw new Error('Nome do ambiente: 3–48 caracteres (a-z, 0-9, hífen); saasagents-v0 é reservado.');
  return value;
}
export async function initialize(values, ask, { run = (file, args, options = {}) => execFileSync(file, args, { encoding: 'utf8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'], ...options }), env = process.env } = {}) {
  let login;
  try {
    run('git', ['--version']);
    login = run('gh', ['api', 'user', '--jq', '.login']).trim();
  } catch { throw new Error('Instale Git e GitHub CLI e execute gh auth login. Depois repita saasagents init.'); }
  console.log('GitHub conectado: ' + login);
  const repo = repositoryName(values.repo || (await ask(`Novo repositório privado (ex.: ${login}/mesa-cliente): `)).trim());
  const name = installationName(values.name || (await ask('Nome exclusivo do Worker e banco (ex.: mesa-cliente-teste): ')).trim());
  const account = (values.account || env.CLOUDFLARE_ACCOUNT_ID || await ask('Cloudflare Account ID do cliente: ')).trim();
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('Cloudflare Account ID inválido.');
  console.log(`Será criado https://github.com/${repo} (privado).
Ambiente GitHub: client. Worker e D1: ${name}.
O workflow usará sua conta Cloudflare. Pode consumir cotas dessa conta.
Esta etapa publica o produto; não lê nem envia a pasta do projeto do cliente.
Não inclui assinatura/cobrança nem executa uma análise de IA.`);
  if ((await ask('Confirma criar o repositório, salvar os secrets e iniciar a instalação pelos Actions? [s/N] ')).trim().toLowerCase() !== 's') throw new Error('Cancelado. Nenhum repositório criado.');
  const token = (env.CLOUDFLARE_API_TOKEN || await ask('Token Cloudflare (entrada oculta): ', true)).trim();
  const key = (env.SAASAGENTS_ADMIN_KEY || await ask('Código privado do NOVO painel (24–256 caracteres, entrada oculta): ', true)).trim();
  if (!token || /\s/.test(token) || key.length < 24 || key.length > 256) throw new Error('Token ou código privado inválido. Nenhum repositório criado.');
  const packaged = fileURLToPath(new URL('./template/', import.meta.url));
  const source = await access(packaged).then(() => packaged, () => fileURLToPath(new URL('../', import.meta.url)));
  await assertTemplate(source);
  const stage = await mkdtemp(join(tmpdir(), 'saasagents-install-'));
  let created = false;
  try {
    await copyTemplate(source, stage);
    run('git', ['init', '-b', 'main'], { cwd: stage });
    run('git', ['add', '.'], { cwd: stage });
    run('git', ['-c', 'user.name=SaaS Agents Installer', '-c', 'user.email=installer@saasagents.local', 'commit', '-m', 'feat: instalação independente da Mesa dos Agentes'], { cwd: stage });
    // Cria somente um repositório novo. Um nome existente é recusado pelo GitHub.
    run('gh', ['repo', 'create', repo, '--private']);
    created = true;
    run('git', ['remote', 'add', 'origin', `https://github.com/${repo}.git`], { cwd: stage });
    // Usa a autenticação do gh somente neste processo; não altera a configuração global do Git.
    run('git', ['-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', '-u', 'origin', 'main'], { cwd: stage });
    run('gh', ['api', '--method', 'PUT', `repos/${repo}/environments/client`]);
    for (const [secret, value] of [['CLOUDFLARE_ACCOUNT_ID', account], ['CLOUDFLARE_API_TOKEN', token], ['SAASAGENTS_ADMIN_KEY', key]]) {
      run('gh', ['secret', 'set', secret, '--repo', repo, '--env', 'client'], { input: value });
    }
    run('gh', ['workflow', 'run', 'install-client.yml', '--repo', repo, '--ref', 'main', '-f', `installation_name=${name}`, '-f', 'reuse_resources=false']);
    console.log(`Instalação solicitada: https://github.com/${repo}/actions
O resultado (sucesso ou falha), URL do painel e pacote do conector ficam na execução.
Aguarde o workflow ficar verde antes de conectar a pasta do servidor.`);
  } catch {
    throw new Error(created
      ? `Repositório criado em https://github.com/${repo}, mas a preparação ou o disparo falhou. Não crie outro: confira main, o environment client, os três secrets e Actions → Instalar ambiente do cliente. O CLI não repetiu a operação.`
      : 'Não foi possível criar o repositório. Confira se o nome está livre e se sua conta tem permissão. Nenhum deploy foi disparado.');
  } finally { await rm(stage, { recursive: true, force: true }); }
}
