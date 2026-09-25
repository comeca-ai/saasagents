# Mesa dos Agentes no GitHub Actions do cliente

A versão Actions não usa Cloudflare nem servidor próprio. Tudo roda no repositório do cliente:

| Peça | Onde fica |
| --- | --- |
| Pedido da tarefa | Issue com a label `agente` |
| Acompanhamento | Comentário `/agente ...` na mesma Issue (`/agente @revisor ...` escolhe outro agente) |
| Execução | `.github/workflows/agentes.yml` (GitHub Actions) |
| Contexto | Checkout do próprio repositório: README, BACKLOG, STATUS, package.json e até 8 `tickets/*.md` |
| Modelo | Anthropic ou qualquer API compatível com a OpenAI, com a chave do cliente no secret `SAASAGENTS_API_KEY` |
| Resultado | Comentário na Issue e resumo da execução, com provedor, modelo, tokens e link do run |
| Agentes e modelo | `.saasagents/agentes.json` |

O agente só produz texto: é uma chamada simples ao modelo, sem ferramentas, sem shell e sem acesso a arquivos pelo modelo.

## Por que a chave do cliente

O GitHub Models, usado na primeira versão, foi desativado pelo GitHub em 30/07/2026. A chave própria funciona em qualquer plano do GitHub, não depende de Copilot e deixa o custo de cada tarefa na conta do cliente, junto ao provedor que ele escolher.

## Instalação no cliente

A página `interface/` guia o cliente em cinco passos, um por tela: repositório, os dois arquivos, a chave de IA, o teste de conexão e a primeira tarefa. Ela é publicada pelo workflow `interface.yml` no GitHub Pages (Settings → Pages → Source: GitHub Actions). Para gerar localmente: `npm run interface` e abra `interface/dist/index.html`. No Codespace, `npm run interface:serve` serve a página na porta 4173 (com o botão Ver simulação).

Arquivos que o cliente recebe:

- `.github/workflows/agentes.yml` (sem as linhas marcadas `# interno`, que só servem ao teste desta branch)
- `.saasagents/run.mjs` (Node.js, sem dependências)

`.saasagents/agentes.json` é opcional: sem ele, responde um agente "Analista" com o contexto padrão.

Secret obrigatório: `SAASAGENTS_API_KEY` (Settings → Secrets and variables → Actions → New repository secret).

Depois, em Actions → Mesa dos Agentes → Run workflow com `configurar`: cria a label `agente` e faz um teste de conexão com o modelo.

## Provedor e modelo

Sem configuração, o provedor é reconhecido pela chave: `sk-ant-...` usa a Anthropic (Claude Sonnet 5); outras chaves `sk-...` usam a OpenAI (GPT-6 Luna). Para fixar provedor, modelo ou endereço, use `.saasagents/agentes.json`:

```json
{ "provedor": "anthropic", "modelo": "claude-sonnet-5", "base_url": "" }
```

- `provedor: "anthropic"` usa `https://api.anthropic.com/v1/messages`.
- `provedor: "openai"` usa `https://api.openai.com/v1/chat/completions`. Com `base_url`, vale para qualquer serviço compatível (OpenRouter, Groq, Azure AI Foundry, vLLM).

Variáveis de repositório opcionais sobrescrevem o arquivo: `SAASAGENTS_PROVIDER`, `SAASAGENTS_MODEL`, `SAASAGENTS_BASE_URL`. O campo `modelo` do disparo manual vale só para aquela execução. Ao trocar de provedor por variável, troque também o modelo.

O contexto é limitado a 18.000 caracteres (`contexto.max_total`) e a resposta a 1.500 tokens (`max_tokens`).

## Falhas

O comentário e o resumo da execução explicam o motivo e a correção: secret ausente (com link para criar), chave recusada, conta sem créditos, modelo inexistente, limite de uso, contexto grande demais ou provedor instável. Chaves e tokens são mascarados nas mensagens.

## Segurança

- Só quem pode aplicar labels (triagem ou escrita) cria tarefas; só `OWNER`, `MEMBER` e `COLLABORATOR` disparam `/agente`.
- Arquivos `.env`, chaves e caminhos fora do repositório nunca entram no contexto; tokens conhecidos são mascarados.
- O conteúdo do repositório e da Issue é tratado como dado, não como instrução.
- O checkout usa `persist-credentials: false`; o job só tem `contents: read` e `issues: write`.

## Testes

`node --test tests/actions.test.js` cobre eventos, escolha de agente, limites de contexto, os formatos Anthropic e OpenAI, classificação de falhas, secret ausente e o fluxo completo com comentário na Issue.
