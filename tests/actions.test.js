import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveTask, pickAgent, buildContext, loadConfig, classifyError, callModel, main, resolveProvider, DEFAULT_CONFIG,
} from '../.saasagents/run.mjs';

async function fixture(files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mesa-'));
  for (const [name, body] of Object.entries(files)) {
    await mkdir(join(root, name, '..'), { recursive: true });
    await writeFile(join(root, name), body);
  }
  return root;
}

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const route = routes.find(r => url.includes(r.match));
    const { status = 200, body = {} } = route ? route.reply(url, init) : { status: 404, body: { message: 'sem rota' } };
    return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
  };
  return { impl, calls };
}

const okAnthropic = answer => ({ status: 200, body: { model: 'claude-sonnet-5', content: [{ type: 'text', text: answer }], usage: { input_tokens: 120, output_tokens: 30 } } });
const okOpenAI = answer => ({ status: 200, body: { model: 'gpt-6-luna', choices: [{ message: { content: answer } }], usage: { prompt_tokens: 80, completion_tokens: 20 } } });
const MSGS = [{ role: 'system', content: 'regras' }, { role: 'user', content: 'oi' }];

test('issue só vira tarefa quando recebe a label "agente"', () => {
  const issue = { number: 7, title: 'Exportar CSV', body: 'Agente: revisor\nQuero exportar.', labels: [{ name: 'agente' }] };
  assert.equal(resolveTask('issues', { action: 'labeled', label: { name: 'bug' }, issue }), null);
  assert.equal(resolveTask('issues', { action: 'opened', issue }), null);
  const task = resolveTask('issues', { action: 'labeled', label: { name: 'agente' }, issue });
  assert.deepEqual([task.numero, task.titulo, task.agente], [7, 'Exportar CSV', 'revisor']);
  const byLabel = resolveTask('issues', { action: 'labeled', label: { name: 'agente' }, issue: { ...issue, body: '', labels: [{ name: 'agente' }, { name: 'agente:analista' }] } });
  assert.equal(byLabel.agente, 'analista');
});

test('comentário /agente exige autor confiável e aceita @agente', () => {
  const base = { action: 'created', issue: { number: 3, title: 'T', body: 'corpo' } };
  assert.equal(resolveTask('issue_comment', { ...base, comment: { body: '/agente oi', author_association: 'NONE' } }), null);
  assert.equal(resolveTask('issue_comment', { ...base, comment: { body: 'obrigado', author_association: 'OWNER' } }), null);
  const task = resolveTask('issue_comment', { ...base, comment: { body: '/agente @revisor e os testes?', author_association: 'MEMBER' } });
  assert.equal(task.agente, 'revisor');
  assert.match(task.pedido, /corpo[\s\S]*e os testes\?/);
  assert.doesNotMatch(task.pedido, /@revisor/);
});

test('disparo manual sem pedido é teste de conexão; configurar é reconhecido', () => {
  const smoke = resolveTask('workflow_dispatch', { inputs: { acao: 'configurar', pedido: '' } });
  assert.equal(smoke.acao, 'configurar');
  assert.equal(smoke.smoke, true);
  const real = resolveTask('workflow_dispatch', { inputs: { acao: 'tarefa', pedido: 'Resuma o backlog', modelo: 'meta/Llama-3.3-70B-Instruct' } });
  assert.deepEqual([real.smoke, real.modelo], [false, 'meta/Llama-3.3-70B-Instruct']);
  assert.equal(resolveTask('push', {}).smoke, true);
});

test('pickAgent encontra por id ou nome e cai no primeiro', () => {
  const config = { agentes: [{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }] };
  assert.equal(pickAgent(config, 'beta').id, 'b');
  assert.equal(pickAgent(config, 'B').id, 'b');
  assert.equal(pickAgent(config, 'x').id, 'a');
});

test('contexto respeita lista, limites, segredos e não sai da pasta', async () => {
  const root = await fixture({
    'README.md': '# Projeto Aurora\ntoken: ghp_abcdefghijklmnopqrstuvwxyz123456',
    'STATUS.md': 'x'.repeat(5000),
    '.env': 'SEGREDO=1',
    'tickets/b.md': 'ticket b',
    'tickets/a.md': 'ticket a',
    'tickets/nota.txt': 'ignorar',
  });
  const ctx = await buildContext(root, { ...DEFAULT_CONFIG.contexto, arquivos: ['README.md', 'STATUS.md', '.env', '../fora.md'], max_total: 4100 });
  assert.deepEqual(ctx.files, ['README.md', 'STATUS.md']);
  assert.match(ctx.text, /Projeto Aurora/);
  assert.doesNotMatch(ctx.text, /ghp_/);
  assert.ok(ctx.chars <= 4100);
  const all = await buildContext(root, { ...DEFAULT_CONFIG.contexto, arquivos: [] });
  assert.deepEqual(all.files, ['tickets/a.md', 'tickets/b.md']);
});

test('loadConfig usa o padrão sem arquivo e acusa JSON inválido', async () => {
  const empty = await fixture({});
  assert.equal((await loadConfig(empty)).modelo, DEFAULT_CONFIG.modelo);
  const bad = await fixture({ '.saasagents/agentes.json': '{ nao é json' });
  await assert.rejects(loadConfig(bad), /não é um JSON válido/);
  const custom = await fixture({ '.saasagents/agentes.json': JSON.stringify({ modelo: 'x/y', agentes: [], contexto: { max_total: 100 } }) });
  const cfg = await loadConfig(custom);
  assert.equal(cfg.modelo, 'x/y');
  assert.equal(cfg.agentes[0].id, 'analista');
  assert.equal(cfg.contexto.max_total, 100);
  assert.equal(cfg.contexto.max_tickets, 8);
});

test('resolveProvider aplica variável > arquivo > padrão e recusa provedor desconhecido', () => {
  assert.deepEqual(resolveProvider({ provedor: 'anthropic', modelo: '' }, {}), { provedor: 'anthropic', modelo: 'claude-sonnet-5', baseUrl: 'https://api.anthropic.com/v1' });
  const viaVars = resolveProvider({ provedor: 'anthropic', modelo: 'x' }, { SAASAGENTS_PROVIDER: 'OpenAI', SAASAGENTS_BASE_URL: 'https://openrouter.ai/api/v1/' });
  assert.deepEqual(viaVars, { provedor: 'openai', modelo: 'x', baseUrl: 'https://openrouter.ai/api/v1' });
  assert.equal(resolveProvider({ modelo: 'a' }, { SAASAGENTS_MODEL: 'b' }, { modelo: 'c' }).modelo, 'c');
  assert.throws(() => resolveProvider({ provedor: 'github-models' }, {}), /desconhecido/);
});

test('callModel fala o formato da Anthropic', async () => {
  const { impl, calls } = fakeFetch([{ match: 'api.anthropic.com', reply: () => okAnthropic('pronto') }]);
  const result = await callModel({ fetchImpl: impl, provedor: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k1', model: 'claude-sonnet-5', messages: MSGS, maxTokens: 900 });
  assert.deepEqual([result.answer, result.usage.prompt_tokens, result.usage.completion_tokens], ['pronto', 120, 30]);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].headers['x-api-key'], 'k1');
  assert.equal(calls[0].headers['anthropic-version'], '2023-06-01');
  assert.deepEqual([calls[0].body.system, calls[0].body.max_tokens, calls[0].body.messages.length], ['regras', 900, 1]);
  assert.equal(calls[0].body.tools, undefined);
});

test('callModel fala o formato OpenAI e compatíveis', async () => {
  const { impl, calls } = fakeFetch([{ match: '/chat/completions', reply: () => okOpenAI('feito') }]);
  const official = await callModel({ fetchImpl: impl, provedor: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k2', model: 'gpt-6-luna', messages: MSGS, maxTokens: 700 });
  assert.equal(official.answer, 'feito');
  assert.equal(calls[0].headers.Authorization, 'Bearer k2');
  assert.deepEqual([calls[0].body.messages[0].role, calls[0].body.max_completion_tokens, calls[0].body.max_tokens], ['system', 700, undefined]);
  await callModel({ fetchImpl: impl, provedor: 'openai', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k3', model: 'm', messages: MSGS, maxTokens: 500 });
  assert.equal(calls[1].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.deepEqual([calls[1].body.max_tokens, calls[1].body.max_completion_tokens], [500, undefined]);
});

test('falhas do provedor viram mensagens acionáveis', async () => {
  const failing = fakeFetch([{ match: 'anthropic', reply: () => ({ status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit' } } }) }]);
  const error = await callModel({ fetchImpl: failing.impl, provedor: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'k', model: 'm', messages: MSGS }).catch(e => e);
  assert.deepEqual([error.status, error.code], [429, 'rate_limit_error']);
  assert.match(classifyError(error, 'm'), /limite de uso/);
  assert.match(classifyError({ status: 401, message: 'invalid x-api-key' }, 'm'), /foi recusada/);
  assert.match(classifyError({ status: 400, message: 'Your credit balance is too low' }, 'm'), /sem créditos/);
  assert.match(classifyError({ status: 429, code: 'insufficient_quota' }, 'm'), /sem créditos/);
  assert.match(classifyError({ status: 404 }, 'z/z'), /z\/z/);
  assert.match(classifyError({ status: 529, message: 'Overloaded' }, 'm'), /instável/);
  assert.match(classifyError({ kind: 'missing_key' }, 'm'), /SAASAGENTS_API_KEY/);
  const html = fakeFetch([{ match: 'x', reply: () => ({ status: 200, body: 'OK' }) }]);
  const empty = await callModel({ fetchImpl: html.impl, provedor: 'openai', baseUrl: 'https://x.dev/v1', apiKey: 'k', model: 'm', messages: MSGS }).catch(e => e);
  assert.equal(empty.kind, 'empty');
  const offline = await callModel({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); }, provedor: 'openai', baseUrl: 'https://x.dev/v1', apiKey: 'k', model: 'm', messages: MSGS }).catch(e => e);
  assert.equal(offline.kind, 'network');
});

test('main: Issue rotulada gera comentário com resposta e rodapé', async () => {
  const root = await fixture({ 'README.md': '# Aurora', '.saasagents/agentes.json': JSON.stringify({ agentes: [{ id: 'analista', nome: 'Analista' }, { id: 'revisor', nome: 'Revisor' }] }) });
  const eventPath = join(root, 'event.json');
  const summaryPath = join(root, 'summary.md');
  await writeFile(eventPath, JSON.stringify({ action: 'labeled', label: { name: 'agente' }, issue: { number: 12, title: 'Revisar', body: 'Agente: revisor', labels: [] } }));
  const { impl, calls } = fakeFetch([
    { match: 'api.anthropic.com', reply: () => okAnthropic('Resposta do revisor') },
    { match: '/issues/12/comments', reply: () => ({ status: 201, body: { id: 1 } }) },
  ]);
  const result = await main({
    env: { GITHUB_TOKEN: 'segredo123', SAASAGENTS_API_KEY: 'chave-do-cliente', GITHUB_REPOSITORY: 'cliente/app', GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: root, GITHUB_STEP_SUMMARY: summaryPath, GITHUB_RUN_ID: '99' },
    fetchImpl: impl, log: () => {},
  });
  assert.equal(result.status, 'done');
  assert.equal(result.agent, 'revisor');
  const comment = calls.find(c => c.url.endsWith('/repos/cliente/app/issues/12/comments'));
  assert.match(comment.body.body, /### Revisor · Mesa dos Agentes[\s\S]*Resposta do revisor[\s\S]*120 tokens de entrada[\s\S]*README.md[\s\S]*actions\/runs\/99/);
  assert.match(await readFile(summaryPath, 'utf8'), /Resposta do revisor/);
  assert.match(calls[0].body.system, /Você é Revisor/);
  assert.match(comment.body.body, /Anthropic · modelo `claude-sonnet-5`/);
});

test('main: configurar cria a label e falha do modelo vira mensagem clara sem vazar token', async () => {
  const root = await fixture({ 'README.md': '# Aurora' });
  const eventPath = join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ inputs: { acao: 'configurar' } }));
  const { impl, calls } = fakeFetch([
    { match: '/labels', reply: () => ({ status: 422, body: { message: 'already_exists' } }) },
    { match: 'api.anthropic.com', reply: () => ({ status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key chave-ruim segredo123' } } }) },
  ]);
  const logs = [];
  const result = await main({
    env: { GITHUB_TOKEN: 'segredo123', SAASAGENTS_API_KEY: 'chave-ruim', GITHUB_REPOSITORY: 'cliente/app', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: root },
    fetchImpl: impl, log: m => logs.push(m),
  });
  assert.equal(result.status, 'failed');
  assert.match(result.reason, /foi recusada/);
  assert.equal(calls[0].body.name, 'agente');
  assert.ok(logs.every(m => !m.includes('segredo123') && !m.includes('chave-ruim')));
});

test('main: sem o secret, avisa como criar e não chama o provedor', async () => {
  const root = await fixture({ 'README.md': '# Aurora' });
  const eventPath = join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ action: 'labeled', label: { name: 'agente' }, issue: { number: 5, title: 'T', body: '', labels: [] } }));
  const { impl, calls } = fakeFetch([{ match: '/issues/5/comments', reply: () => ({ status: 201, body: {} }) }]);
  const result = await main({ env: { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'cliente/app', GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: root }, fetchImpl: impl, log: () => {} });
  assert.equal(result.status, 'failed');
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.body, /SAASAGENTS_API_KEY[\s\S]*settings\/secrets\/actions\/new/);
});

test('main ignora eventos que não são tarefa', async () => {
  const root = await fixture({});
  const eventPath = join(root, 'event.json');
  await writeFile(eventPath, JSON.stringify({ action: 'labeled', label: { name: 'bug' }, issue: { number: 1 } }));
  const result = await main({ env: { GITHUB_TOKEN: 't', GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_PATH: eventPath, GITHUB_WORKSPACE: root }, fetchImpl: async () => { throw new Error('não deveria chamar'); }, log: () => {} });
  assert.equal(result.status, 'skipped');
});
