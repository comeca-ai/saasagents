# Instalação independente — GitHub e Cloudflare do cliente

Cada instalação tem repositório GitHub, Worker, banco D1, código privado e tokens de conector próprios. O projeto do cliente continua em seu servidor; o conector envia contexto autorizado ao seu painel na Cloudflare. Não é necessário hospedar o Worker no servidor.

## Pelo assistente CLI

Pré-requisitos: Node.js 22+, npm, Git, GitHub CLI autenticado (`gh auth login`) e conta Cloudflare com workers.dev habilitado. O operador precisa poder criar repositórios e workflows e configurar environments/secrets. O ambiente `client` deve estar disponível no plano GitHub usado para repositórios privados.

A partir de uma cópia do produto:

```sh
git clone https://github.com/comeca-ai/saasagents.git
cd saasagents
node connector/cli.mjs init
```

O repositório de origem é privado: esse caminho exige acesso concedido. Para distribuir sem conceder acesso ao código histórico, gere o pacote com `npm run connector:pack`, entregue o `.tgz` e seu `SHA256SUMS`, e use `npm install --global ./saasagents-connector-0.1.0.tgz` seguido de `saasagents init`. O pacote contém somente a aplicação e os arquivos necessários ao instalador; nenhum snapshot, catálogo histórico, segredo ou configuração de ambiente.

O assistente pede:

1. Novo repositório `conta/nome` (a conta autenticada aparece primeiro).
2. Nome exclusivo da instalação, como `mesa-cliente-teste`.
3. Account ID Cloudflare.
4. Confirmação para criar o repositório e executar o deploy.
5. Token Cloudflare e código privado do novo painel (entrada oculta).

O CLI cria o repo privado e o environment `client`, configura os secrets e dispara **Instalar ambiente do cliente**. Ele não considera o disparo como sucesso do deploy: acompanhe a execução até ficar verde. O resumo do Actions entrega a URL e o comando para conectar a pasta no servidor.

## Configuração manual pelo GitHub

Alternativamente, use um repositório privado com os arquivos do produto e crie **Settings → Environments → client** com estes secrets:

| Secret | Valor |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta do cliente |
| `CLOUDFLARE_API_TOKEN` | Token limitado à conta do cliente, com Workers Scripts Edit, D1 Edit e Workers AI Read/Edit conforme exigido pela conta/binding |
| `SAASAGENTS_ADMIN_KEY` | Código privado exclusivo, entre 24 e 256 caracteres |

Em **Actions → Instalar ambiente do cliente → Run workflow**, informe `installation_name`. O nome original `saasagents-v0` é bloqueado. Deixe `reuse_resources` desmarcado numa instalação nova: a presença de Worker ou D1 com o nome escolhido interrompe a operação, evitando sobrescrita acidental.

O workflow valida código/testes, gera o CLI como artifact, verifica a conta e o subdomínio, prepara o banco, aplica migrações, publica Worker/painel, configura o código privado e verifica Worker/D1, recusa de acesso anônimo e login. Não há chamada de inferência automática. As ferramentas usadas seguem as documentações de [workflows manuais do GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch), [secrets do Workers](https://developers.cloudflare.com/workers/configuration/secrets/) e [pacotes locais npm](https://docs.npmjs.com/cli/v11/commands/npm-install/).

## No outro servidor: um teste

Baixe e extraia o artifact `saasagents-connector` da execução. Com Node.js 22+ instalado:

```sh
sha256sum -c SHA256SUMS
npm install --global ./saasagents-connector-0.1.0.tgz
saasagents install --url https://NOVO-WORKER.CONTA.workers.dev --directory /caminho/do/projeto
```

Entre no novo painel com `SAASAGENTS_ADMIN_KEY`, crie projeto e coordenador e gere um token em **Conectar pasta**. Confirme a leitura no CLI e forneça esse token. O token de um painel anterior não funciona aqui. O CLI envia uma única vez e termina; não cria serviço em segundo plano. Para testar IA uma vez, solicite **Resumo executivo** no painel após o envio e confirme a execução.

## Recuperação e atualização

- Se o CLI criou o repo mas falhou depois, continue nele: confira a branch main, environment/secrets e dispare o workflow manualmente. Não repita a criação do repo.
- Se o workflow criou recursos e falhou depois, eles podem permanecer na conta. Corrija a causa e use `reuse_resources=true` somente para retomar aquela instalação. A opção também permite atualizar o código e as migrações no mesmo Worker/D1; não apaga o banco.
- Se a etapa final falhar, não trate a instalação como validada. Os testes de login/saúde não comprovam inferência: esta é testada separadamente no painel.
- Atualizações do produto não são distribuídas automaticamente aos repositórios dos clientes nesta versão.

## Modelo comercial — ainda não implementado

Este instalador permite infraestrutura na conta do cliente (BYOC). Não implementa assinatura, licença, checkout, cobrança, limites comerciais ou bloqueio por inadimplência. Quem controla o repositório/Worker pode alterar o código; uma checagem de licença somente ali não é uma barreira confiável. O SaaS pago deve oferecer valor em serviços sob nossa gestão (coordenação, atualizações, suporte e recursos premium), com contrato de integração e isolamento definidos numa próxima etapa.
