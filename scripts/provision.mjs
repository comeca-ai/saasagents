import { readFile, writeFile } from 'node:fs/promises';
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account || !/^[a-f0-9]{32}$/i.test(account)) throw new Error('Configure CLOUDFLARE_API_TOKEN e ID_CLOUDFLARE (Account ID) no environment agents.');
async function cloudflare(path, method='GET', body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare recusou ${method} ${path.split('?')[0]} (HTTP ${response.status}; códigos: ${(data.errors || []).map(e=>e.code).join(',')}). Verifique permissão D1 Edit na conta selecionada.`);
  return data.result;
}
const config = JSON.parse(await readFile('wrangler.jsonc','utf8'));
const name = 'saasagents-v0';
const existing = await cloudflare('/d1/database?name=' + encodeURIComponent(name));
let database = existing.find(db => db.name === name);
if (!database) database = await cloudflare('/d1/database','POST',{name});
config.d1_databases[0].database_id = database.uuid;
await writeFile('wrangler.deploy.json',JSON.stringify(config,null,2)+'\n');
console.log('Banco saasagents-v0 disponível. Configuração de deploy preparada.');
