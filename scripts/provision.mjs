import { readFile, writeFile } from 'node:fs/promises';
const token = process.env.CLOUDFLARE_API_TOKEN?.trim(), account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if (!token || !account || !/^[a-f0-9]{32}$/i.test(account)) throw new Error('Configure CLOUDFLARE_API_TOKEN e ID_CLOUDFLARE (Account ID) no environment agents.');
async function cloudflare(path, method='GET', body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare recusou ${method} ${path.split('?')[0]} (HTTP ${response.status}; códigos: ${(data.errors || []).map(e=>e.code).join(',')}). Verifique permissão D1 Edit na conta selecionada.`);
  return data.result;
}
// Verifica somente a credencial e a conta configurada; não enumera outros recursos.
async function verifyCredential(path) {
  const response = await fetch('https://api.cloudflare.com/client/v4' + path, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  return { ok: response.ok && data.success && data.result?.status === 'active', http: response.status, codes: (data.errors || []).map(e => e.code) };
}
const personal = await verifyCredential('/user/tokens/verify');
if (!personal.ok) {
  const accountToken = await verifyCredential(`/accounts/${account}/tokens/verify`);
  if (!accountToken.ok) throw new Error(`A credencial não foi validada como token ativo. Verificação pessoal HTTP ${personal.http} (códigos ${personal.codes.join(',')}); verificação da conta HTTP ${accountToken.http} (códigos ${accountToken.codes.join(',')}). Confira o valor de CLOUDFLARE_API_TOKEN no environment agents e o Account ID. Não use a Global API Key.`);
}
console.log('Token Cloudflare ativo. Conferindo acesso ao D1 saasagents-v0.');
const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
const name = 'saasagents-v0';
const existing = await cloudflare('/d1/database?name=' + encodeURIComponent(name));
let database = existing.find(db => db.name === name);
if (!database) database = await cloudflare('/d1/database','POST',{name});
config.d1_databases[0].database_id = database.uuid;
await writeFile('wrangler.deploy.json',JSON.stringify(config,null,2)+'\n');
console.log('Banco saasagents-v0 disponível. Configuração de deploy preparada.');
