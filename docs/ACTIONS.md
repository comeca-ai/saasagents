# Mesa dos Agentes no GitHub Actions do cliente

A versão Actions não usa Cloudflare. Tudo roda no repositório do cliente:

| Peça | Onde fica |
| --- | --- |
| Pedido da tarefa | Issue com a label `agente` |
| Acompanhamento | Comentário `/agente ...` na mesma Issue (`/agente @revisor ...` escolhe outro agente) |
| Execução | `.github/workflows/agentes.yml` (GitHub Actions) |
| Contexto | Checkout do próprio repositório: README, BACKLOG, STATUS, package.json e até 8 `tickets/*.md` |
| Modelo | GitHub Models, autenticado pelo `GITHUB_TOKEN` do job (`permissions: models: read`) |
| Resultado | Comentário na Issue e resumo da execução, com modelo, tokens e link do run |
| Agentes e modelo | `.saasagents/agentes.json` |

Nenhum secret é necessário. O `GITHUB_TOKEN` expira ao fim do job e só tem `contents: read`, `issues: write` e `models: read`.

## Instalação no cliente

A página `interface/` guia o cliente em cinco etapas: repositório, agentes e modelo, instalação dos três arquivos, ativação e primeira tarefa. Ela é publicada pelo workflow `interface.yml` no GitHub Pages (Settings → Pages → Source: GitHub Actions). Para gerar localmente: `npm run interface` e abra `interface/dist/index.html`.

Arquivos que o cliente recebe:

- `.github/workflows/agentes.yml` (sem as linhas marcadas `# interno`, que só servem ao teste desta branch)
- `.saasagents/run.mjs` (Node.js, sem dependências)
- `.saasagents/agentes.json`

Depois, em Actions → Mesa dos Agentes → Run workflow com `configurar`: cria a label `agente` e faz um teste de conexão com o modelo.

## Modelo

Padrão: `openai/gpt-4.1-mini`. Precedência: campo `modelo` do disparo manual → variável de repositório `SAASAGENTS_MODEL` → `modelo` em `agentes.json`. `meta/Llama-3.3-70B-Instruct` é o mesmo modelo da versão Cloudflare.

A cota gratuita do GitHub Models é por conta e por modelo, com limite de tokens por requisição. Por isso o contexto é limitado a 18.000 caracteres (`contexto.max_total`). Em repositórios de organização, o uso de GitHub Models precisa estar liberado pela organização.

## Segurança

- Só quem pode aplicar labels (triagem ou escrita) cria tarefas; só `OWNER`, `MEMBER` e `COLLABORATOR` disparam `/agente`.
- Arquivos `.env`, chaves e caminhos fora do repositório nunca entram no contexto; tokens conhecidos são mascarados.
- O modelo só produz texto. O conteúdo do repositório e da Issue é tratado como dado, não como instrução.
- O checkout usa `persist-credentials: false`.

## Testes

`node --test tests/actions.test.js` cobre eventos, escolha de agente, limites de contexto, formato da chamada ao GitHub Models, classificação de falhas e o fluxo completo com comentário na Issue.
