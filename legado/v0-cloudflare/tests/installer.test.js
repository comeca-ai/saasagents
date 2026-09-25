import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { settings, provision, verify } from '../scripts/client-install.mjs';
import { panelOrigin, saveConfig, readConfig } from '../connector/cli.mjs';
import { initialize, repositoryName } from '../connector/init.mjs';
import { templateFiles } from '../connector/template.mjs';

const env = { INSTALLATION_NAME: 'mesa-cliente-teste', CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'test-cloudflare-token', ADMIN_KEY: 'test-private-code-'.repeat(3) };
const template = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const run = (args, options = {}) => new Promise((accept, reject) => {
  const p = spawn(process.execPath, [resolve('connector/cli.mjs'), ...args], { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; p.stdout.on('data', c => output += c); p.stderr.on('data', c => output += c);
  p.on('error', reject); p.on('close', code => accept({ code, output }));
});

test('instalação independente recusa nome original e configuração incompleta', () => {
  assert.throws(() => settings({ ...env, INSTALLATION_NAME: 'saasagents-v0' }));
  assert.throws(() => settings({ ...env, INSTALLATION_NAME: 'x; echo segredo' }));
  assert.throws(() => settings({ ...env, CLOUDFLARE_ACCOUNT_ID: '' }));
  assert.throws(() => settings({ ...env, ADMIN_KEY: 'curta' }));
  assert.equal(settings(env).name, 'mesa-cliente-teste');
});
test('provisionamento cria banco novo na conta selecionada e recusa colisões', async () => {
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, ...options });
    assert.match(url, new RegExp('/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/'));
    if (url.endsWith('/workers/subdomain')) return response({ success: true, result: { subdomain: 'cliente' } });
    if (url.endsWith('/settings')) return response({ success: false, errors: [{ code: 10007 }] }, 404);
    if (options.method === 'POST') return response({ success: true, result: { uuid: '11111111-1111-1111-1111-111111111111' } });
    return response({ success: true, result: [] });
  };
  const result = await provision(env, template, request);
  assert.equal(result.url, 'https://mesa-cliente-teste.cliente.workers.dev');
  assert.equal(result.config.name, env.INSTALLATION_NAME);
  assert.equal(result.config.d1_databases[0].database_name, env.INSTALLATION_NAME);
  assert.equal(calls.filter(c => c.method === 'POST').length, 1);
  let writes = 0;
  const collision = async (url, options) => {
    if (options.method !== 'GET') writes++;
    return response({ success: true, result: url.endsWith('/subdomain') ? { subdomain: 'cliente' } : url.endsWith('/settings') ? {} : [{ name: env.INSTALLATION_NAME, uuid: '11111111-1111-1111-1111-111111111111' }] });
  };
  await assert.rejects(provision(env, template, collision), /já usado/);
  assert.equal(writes, 0);
  await provision({ ...env, REUSE_RESOURCES: 'true' }, template, collision);
  assert.equal(writes, 0);
});
test('falha de permissão não é interpretada como Worker inexistente', async () => {
  let count = 0;
  await assert.rejects(provision(env, template, async () => { count++; return response({ success: false }, 403); }), /recusou/);
  assert.equal(count, 1);
});
test('verificação exige saúde, acesso anônimo bloqueado e sessão autenticada', async () => {
  const seen = [];
  await verify('https://cliente.test', env.ADMIN_KEY, async (url, options) => {
    seen.push(url);
    if (url.endsWith('/health')) return response({ ok: true, service: 'saasagents-v0' });
    if (url.endsWith('/state')) return response({}, 401);
    if (url.endsWith('/login')) {
      assert.equal(JSON.parse(options.body).key, env.ADMIN_KEY);
      return new Response('{}', { headers: { 'Set-Cookie': 'session=test; HttpOnly' } });
    }
    assert.equal(options.headers.Cookie, 'session=test');
    return response({ authenticated: true });
  });
  assert.equal(seen.length, 4);
  assert.ok(!seen.some(url => url.includes('/run')));
  await assert.rejects(verify('https://cliente.test', env.ADMIN_KEY, async () => response({ ok: false })), /verificação/);
});
test('URL sem destino implícito, credenciais, redirects ou caminhos extras', () => {
  for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com/?token=x']) assert.throws(() => panelOrigin(url));
  assert.equal(panelOrigin('https://cliente.workers.dev'), 'https://cliente.workers.dev');
});
test('configuração privada é protegida, vinculada à pasta e recusa symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saasagents-config-'));
  try {
    const config = { url: 'https://cliente.test', token: 't'.repeat(40), root, approved_read: true };
    await saveConfig(root, config);
    assert.equal((await stat(join(root, '.secrets/connector.json'))).mode & 0o777, 0o600);
    assert.equal((await stat(join(root, '.secrets'))).mode & 0o777, 0o700);
    assert.equal(await readFile(join(root, '.secrets/.gitignore'), 'utf8'), '*\n');
    assert.equal((await readConfig(root)).token, config.token);
    await saveConfig(root, { ...config, root: '/outra-pasta' });
    await assert.rejects(readConfig(root), /outra pasta|não autorizada/);
    await rm(join(root, '.secrets'), { recursive: true });
    await symlink(tmpdir(), join(root, '.secrets'));
    await assert.rejects(saveConfig(root, config), /link/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('CLI faz um único envio, reutiliza token e falha sem repetições quando recusado', async () => {
  const root = await mkdtemp(join(tmpdir(), 'saasagents-cli-'));
  const token = 'test-connector-token-'.repeat(3), received = [];
  let rejectToken = false;
  const server = createServer(async (request, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/health') return res.end(JSON.stringify({ ok: true, service: 'saasagents-v0' }));
    let body = ''; for await (const chunk of request) body += chunk;
    received.push({ body, token: request.headers.authorization });
    res.statusCode = rejectToken ? 401 : 200;
    res.end('{}');
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const cleanEnv = { ...process.env }; delete cleanEnv.SAASAGENTS_CONNECTOR_TOKEN;
  try {
    await writeFile(join(root, 'README.md'), 'Projeto do cliente');
    await writeFile(join(root, '.env'), 'PRIVATE_ENV_DATA');
    const denied = await run(['install', '--url', url, '--directory', root], { env: { ...cleanEnv, SAASAGENTS_CONNECTOR_TOKEN: token } });
    assert.equal(denied.code, 1); assert.equal(received.length, 0);
    const installed = await run(['install', '--url', url, '--directory', root, '--approve-read'], { env: { ...cleanEnv, SAASAGENTS_CONNECTOR_TOKEN: token } });
    assert.equal(installed.code, 0, installed.output); assert.equal(received.length, 1);
    assert.ok(!installed.output.includes(token)); assert.ok(!received[0].body.includes('PRIVATE_ENV_DATA'));
    assert.equal(received[0].token, 'Bearer ' + token);
    const sync = await run(['sync', '--directory', root], { env: cleanEnv });
    assert.equal(sync.code, 0, sync.output); assert.equal(received.length, 2);
    rejectToken = true;
    const failed = await run(['sync', '--directory', root], { env: cleanEnv });
    assert.equal(failed.code, 1); assert.equal(received.length, 3);
    assert.ok(!failed.output.includes(token));
  } finally { await new Promise(yes => server.close(yes)); await rm(root, { recursive: true, force: true }); }
});
// Arquivado na v2: o wizard monta o template a partir da raiz da v0 (package.json, .github/workflows), que nao existe em legado/.
test.skip('wizard cria repo privado, salva secrets por stdin e dispara somente workflow do cliente', async () => {
  const calls = [];
  const values = { repo: 'cliente/mesa-teste', name: 'mesa-teste', account: env.CLOUDFLARE_ACCOUNT_ID };
  const run = (file, args, options = {}) => { calls.push({ file, args, options }); return args[0] === 'api' && args[1] === 'user' ? 'cliente\n' : ''; };
  await initialize(values, async () => 's', { run, env: { CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN, SAASAGENTS_ADMIN_KEY: env.ADMIN_KEY } });
  assert.ok(calls.some(c => c.args.includes('--private')));
  const secrets = calls.filter(c => c.args[0] === 'secret'); assert.equal(secrets.length, 3);
  assert.equal(secrets.find(c => c.args.includes('CLOUDFLARE_API_TOKEN')).options.input, env.CLOUDFLARE_API_TOKEN);
  for (const c of calls) { assert.ok(!c.args.join(' ').includes(env.CLOUDFLARE_API_TOKEN)); assert.ok(!c.args.join(' ').includes(env.ADMIN_KEY)); }
  assert.deepEqual(calls.at(-1).args, ['workflow', 'run', 'install-client.yml', '--repo', values.repo, '--ref', 'main', '-f', 'installation_name=mesa-teste', '-f', 'reuse_resources=false']);
  calls.length = 0;
  await assert.rejects(initialize(values, async () => 'n', { run, env: {} }), /Cancelado/);
  assert.equal(calls.length, 2); // somente git --version e identidade GitHub
  assert.throws(() => repositoryName('https://github.com/cliente/repo'));
  assert.ok(!templateFiles.some(p => /^(dados|artefato|\.secrets|ACESSOS|ARTEFATOS)/.test(p)));
});
