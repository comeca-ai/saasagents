# SaaS Agents — Mesa dos Agentes (v2)

Agentes de IA que analisam o projeto do cliente e respondem tarefas, rodando inteiramente no GitHub do próprio cliente. Não há servidor, banco ou painel para hospedar: a tarefa é uma Issue, a execução é o GitHub Actions e a resposta chega como comentário.

A versão anterior (v0, painel na Cloudflare com Workers AI e D1) está arquivada em [`legado/v0-cloudflare`](legado/v0-cloudflare) e continua intacta na branch `main`.

## Como funciona

1. O cliente abre uma Issue e aplica a label `agente`.
2. O workflow `.github/workflows/agentes.yml` roda no Actions do repositório.
3. `.saasagents/run.mjs` lê README, STATUS, BACKLOG e tickets do próprio repositório e chama o modelo de IA com a chave do cliente (secret `SAASAGENTS_API_KEY`, Anthropic ou OpenAI, reconhecida pelo formato).
4. A resposta volta como comentário na Issue. Para continuar a conversa, basta comentar `/agente` seguido do novo pedido.

O agente só produz texto: não tem ferramentas, terminal nem acesso à rede. Detalhes, segurança e configuração em [docs/ACTIONS.md](docs/ACTIONS.md).

## Instalar no GitHub de um cliente

A página `interface/` guia a instalação em cinco passos (repositório, dois arquivos, chave de IA, teste e primeira tarefa) e tem um botão **Ver simulação** que mostra o fluxo completo sem enviar nada ao GitHub.

```sh
npm run interface:serve   # serve a página na porta 4173 (no Codespace, a porta é encaminhada)
npm run interface         # só gera interface/dist/index.html
```

O workflow `interface.yml` publica a mesma página no GitHub Pages quando houver merge na `main`.

## Desenvolvimento

Requer Node.js 22 ou mais novo. Não há dependências para instalar.

```sh
npm test        # testes do executor (eventos, contexto, provedores, falhas, fluxo completo)
npm run check   # verificação de sintaxe
```

## Estrutura

| Caminho | O que é |
| --- | --- |
| `.github/workflows/agentes.yml` | Workflow que o cliente instala |
| `.saasagents/run.mjs` | Executor que o cliente instala (sem dependências) |
| `.saasagents/agentes.json` | Configuração opcional de agentes, modelo e contexto |
| `interface/` | Página de instalação guiada, com simulação |
| `scripts/` | Geração e servidor local da interface |
| `tests/` | Testes do executor |
| `docs/` | Documentação (`ACTIONS.md` descreve a v2) |
| `BACKLOG.md`, `STATUS.md`, `tickets/` | Contexto do produto, lido pelos próprios agentes |
| `legado/v0-cloudflare/` | Versão v0 arquivada (Worker, D1, painel e conector) |

Histórico de versões em [CHANGELOG.md](CHANGELOG.md).
