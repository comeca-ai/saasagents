import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function settings(env) {
  const name = env.INSTALLATION_NAME || '';
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(name) || name.endsWith('-') || name === 'saasagents-v0') throw new Error('Use um nome novo de 3–48 caracteres (a-z, 0-9, hífen). saasagents-v0 é reservado.');
  const account = env.CLOUDFLARE_ACCOUNT_ID?.trim(), token = env.CLOUDFLARE_API_TOKEN?.trim(), key = env.ADMIN_KEY?.trim();
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !token) throw new Error('Configure CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no environment client.');
  if (!key || key.length < 24 || key.length > 256) throw new Error('Configure SAASAGENTS_ADMIN_KEY com 24–256 caracteres no environment client.');
  return { name, account, token, key, reuse: env.REUSE_RESOURCES === 'true' };
}
export async function provision(env, template, request = fetch) {
  const s = settings(env);
  async function api(path, method = 'GET', data) {
    const response = await request(`https://api.cloudflare.com/client/v4/accounts/${s.account}${path}`, {
      method, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    const body = await response.json();
    // Somente o código específico de script inexistente permite criar um Worker novo.
    if (response.status === 404 && path.includes('/workers/scripts/') && body.errors?.some(e => e.code === 10007)) return null;
    if (!response.ok || !body.success) throw new Error(`Cloudflare recusou a verificação (${method}, HTTP ${response.status}). Confira a conta e permissões do token.`);
    return body.result;
  }
  const subdomain = await api('/workers/subdomain');
  if (!/^[a-z0-9-]+$/.test(subdomain?.subdomain || '')) throw new Error('Ative um subdomínio workers.dev na conta Cloudflare antes de instalar.');
  const existingWorker = await api(`/workers/scripts/${s.name}/settings`);
  const databases = await api('/d1/database?name=' + encodeURIComponent(s.name));
  let database = databases.find(db => db.name === s.name);
  if (!s.reuse && (existingWorker || database)) throw new Error('Nome já usado por Worker ou D1. Escolha outro nome. Para retomar/atualizar esta instalação, marque reuse_resources explicitamente.');
  if (!database) database = await api('/d1/database', 'POST', { name: s.name });
  if (!/^[a-f0-9-]{36}$/i.test(database.uuid || '')) throw new Error('Cloudflare não retornou um identificador D1 válido.');
  const config = {
    name: s.name, account_id: s.account, main: template.main, compatibility_date: template.compatibility_date,
    workers_dev: true, assets: template.assets, ai: { binding: 'AI' }, vars: template.vars,
    d1_databases: [{ binding: 'DB', database_name: s.name, database_id: database.uuid, migrations_dir: 'migrations' }],
  };
  return { config, url: `https://${s.name}.${subdomain.subdomain}.workers.dev` };
}
export async function verify(url, key, request = fetch) {
  const options = { signal: AbortSignal.timeout(30000), redirect: 'error' };
  const health = await request(url + '/api/health', options);
  const status = await health.json();
  if (!health.ok || status.ok !== true || status.service !== 'saasagents-v0') throw new Error('Worker/D1 não passaram na verificação.');
  const privateState = await request(url + '/api/state', options);
  if (privateState.status !== 401) throw new Error('Acesso anônimo não foi bloqueado como esperado.');
  const login = await request(url + '/api/login', { ...options, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!login.ok || !cookie) throw new Error('Login privado não passou na verificação.');
  const session = await request(url + '/api/session', { ...options, headers: { Cookie: cookie } });
  if (!session.ok || !(await session.json()).authenticated) throw new Error('Sessão privada não foi confirmada.');
}
async function main() {
  const s = settings(process.env);
  if (process.argv[2] === 'provision') {
    const result = await provision(process.env, JSON.parse(await readFile('wrangler.jsonc', 'utf8')));
    await writeFile('wrangler.client.json', JSON.stringify(result.config, null, 2) + '\n');
    await writeFile('client-installation.json', JSON.stringify({ name: s.name, url: result.url }) + '\n');
    console.log('Recursos da instalação conferidos; configuração independente preparada.');
  } else if (process.argv[2] === 'verify') {
    const { url } = JSON.parse(await readFile('client-installation.json', 'utf8'));
    const expected = new RegExp(`^https://${s.name}\\.[a-z0-9-]+\\.workers\\.dev$`);
    if (!expected.test(url)) throw new Error('URL da instalação inválida.');
    await verify(url, s.key);
    const summary = `## Instalação ${s.name}\n\nPainel: ${url}\n\nWorker, banco D1, bloqueio de acesso anônimo e login privado: verificados.\n\nBaixe o artifact **saasagents-connector**, extraia-o e, no outro servidor (Node.js 22+):\n\n\`\`\`sh\nsha256sum -c SHA256SUMS\nnpm install --global ./saasagents-connector-0.1.0.tgz\nsaasagents install --url ${url} --directory /caminho/do/projeto\n\`\`\`\n\nEntre no painel com o código SAASAGENTS_ADMIN_KEY, crie o projeto e o coordenador e gere um token em **Conectar pasta**. O CLI confirma a leitura e envia um único snapshot; não instala serviço. Cada ambiente usa seus próprios tokens.\n\nWorkers AI está configurado, mas inferência não foi executada pelo workflow. Após conectar a pasta, use **Resumo executivo** no painel para um teste explícito de IA.\n`;
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    console.log('Instalação validada: ' + url);
  } else throw new Error('Use client-install.mjs provision|verify.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => {
  console.error('Instalação não concluída. Confira nome exclusivo, permissões (Workers Scripts/D1/Workers AI), secrets e disponibilidade da conta. Nenhum segredo foi impresso.');
  process.exitCode = 1;
});
