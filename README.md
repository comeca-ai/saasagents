# SaaS Agents — Mesa dos Agentes

Painel privado para entender projetos, acompanhar agentes e transformar contexto em decisões.
Repositório exclusivo: https://github.com/comeca-ai/saasagents. Pasta desta instalação: `/root/saasagents`.

## Versão GitHub Actions (sem Cloudflare)

A Mesa dos Agentes também roda inteira no GitHub Actions do cliente: Issue com a label `agente` → workflow `agentes.yml` → modelo de IA com a chave do próprio cliente (secret `SAASAGENTS_API_KEY`) → comentário na Issue. Sem Worker e sem D1. A instalação é guiada pela página `interface/`; detalhes em [docs/ACTIONS.md](docs/ACTIONS.md).

## v0

Publicado: https://saasagents-v0.jhonata-emerick.workers.dev

Primeiro projeto conectado: esta própria pasta (`/root/saasagents`). O coordenador já executou
uma análise real pelo Workers AI. Consulte `STATUS.md` para o estado verificado da instalação.

- Painel baseado no template original da Mesa dos Agentes, com tema claro/escuro e layout responsivo.
- Projetos, agentes, backlog e histórico persistidos em Cloudflare D1.
- Agente textual no Workers AI: analisa o pedido e o último snapshot do projeto.
- Conector local com consentimento explícito e token por projeto, limitado ao envio de contexto.
- Login por código privado. Esta v0 é de um único dono, com vários projetos; não há contas de clientes ou cobrança.

O agente não tem terminal nem acesso direto ao servidor. Ele produz análise em texto. O conector
lê uma lista limitada de documentos e não recebe comandos do painel. Contexto dos arquivos é
tratado como dado, não como autorização. Os dados históricos da Ultravis não são carregados no app.

## Rodar localmente

Requer Node.js 22 e npm. Execute nesta pasta:

```sh
npm ci
# Configure ADMIN_KEY em .dev.vars com um código aleatório de pelo menos 24 caracteres.
npm run db:local
npm run dev
```

Painel em http://127.0.0.1:8791. Na instalação atual, o código privado está em
`.secrets/admin-key.txt`, fora do Git. O modo local não chama Workers AI: execução de IA é
verificada no Worker publicado; testes automatizados usam um adaptador controlado.

```sh
npm run check
npm test
```

## Conectar um projeto

1. Entre no painel, crie o projeto e um agente coordenador.
2. Em **Conectar pasta**, gere um token para esse projeto.
3. Na raiz do projeto com `connector/cli.mjs`, execute:

```sh
node connector/cli.mjs connect --url https://SEU-WORKER.workers.dev
```

O conector apresenta o escopo e pede autorização antes de ler e enviar. Depois pede o token.
Ele lê somente README.md, BACKLOG.md, STATUS.md, package.json e até oito tickets Markdown,
além de nomes de itens na raiz e metadados de Git. Não segue links para arquivos fora da pasta,
não lê `.env`, credenciais, mapas de acesso ou outros projetos. Padrões conhecidos de credenciais
são omitidos, mas os documentos autorizados devem conter apenas contexto apropriado para envio.

A configuração fica em `.secrets/connector.json` (permissão 600); mantenha `.secrets/` fora do Git.
Para manter o painel atualizado enquanto o processo estiver ativo:

```sh
node connector/cli.mjs sync --watch
```

Sem novos sinais por três minutos, o painel mostra o conector como offline. O botão **Revogar
acesso** invalida o token. O servidor guarda somente seu hash. `inspect` permite visualizar
localmente o contexto coletado antes de enviar. A v0 usa o script do repositório; um pacote
instalável independente ainda está no backlog.

## Cloudflare / GitHub

O workflow `.github/workflows/deploy.yml` publica a branch `main` pelo environment `agents`:

- `CLOUDFLARE_API_TOKEN`: token da conta, com Workers Scripts Edit e D1 Edit para provisionar este produto.
- `ID_CLOUDFLARE`: Account ID.
- `SAASAGENTS_ADMIN_KEY`: código privado do dono, salvo como secret `ADMIN_KEY` no Worker.

Recursos exclusivos: Worker `saasagents-v0` e banco D1 `saasagents-v0`. A configuração inclui
binding Workers AI. O modelo padrão é `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Cada execução é explícita
e consome a cota Workers AI da conta; custo monetário não é estimado pelo painel. Tokens aparecem
somente quando informados pelo provedor. Não há migração de dados dos projetos anteriores.

A publicação exige testes verdes. O workflow configura o banco, aplica migrações, publica os
arquivos de `public/` e a API, e configura o acesso privado. Documentos e snapshots históricos
ficam no repositório, fora dos arquivos publicados.

## Organização

`src/`: API; `public/`: painel; `connector/`: coletor local; `migrations/`: D1;
`scripts/`: desenvolvimento e deploy; `tests/`: verificações; `tickets/`: andamento do produto.
`artefato/` e `dados/` preservam a origem. `docs/IMPORTACAO-V0.md` registra a importação inicial.
