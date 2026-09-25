# Changelog

## 2.0.0 — 2026-09-25

Nova arquitetura: a Mesa dos Agentes roda inteira no GitHub Actions do cliente.

- Tarefas por Issue com a label `agente`; continuação com comentário `/agente` (só donos, membros e colaboradores).
- Executor `.saasagents/run.mjs` sem dependências: contexto do próprio repositório, limites de tamanho e mascaramento de segredos.
- Modelo com a chave do cliente (secret `SAASAGENTS_API_KEY`): Anthropic ou qualquer API compatível com a OpenAI, com o provedor reconhecido pela chave.
- Mensagens de falha acionáveis: secret ausente, chave recusada, conta sem créditos, modelo inexistente, limite de uso, provedor instável.
- Interface de instalação em cinco passos, com simulação do fluxo completo, servida em porta local (`npm run interface:serve`) ou no GitHub Pages.
- Sem Cloudflare: Worker, D1, Workers AI, painel e conector da v0 foram arquivados em `legado/v0-cloudflare`.

A primeira versão desta branch usava o GitHub Models, que o GitHub desativou em 30/07/2026; por isso a v2 usa a chave do próprio cliente.

## 0.1.0 — v0

Painel privado na Cloudflare (Worker, D1 e Workers AI) com conector local. Arquivado em `legado/v0-cloudflare` e mantido na branch `main`.
