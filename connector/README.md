# CLI SaaS Agents

Requer Node.js 22+. Não depende de módulos npm externos.

## Instalar o pacote

Baixe o artifact `saasagents-connector` de uma execução do workflow **Instalar ambiente do cliente** e extraia o ZIP. No diretório extraído:

```sh
sha256sum -c SHA256SUMS
npm install --global ./saasagents-connector-0.1.0.tgz
saasagents --help
```

Sem acesso global, use `npm install --global --prefix "$HOME/.local" ./saasagents-connector-0.1.0.tgz` e acrescente `$HOME/.local/bin` ao PATH. O pacote é privado e ainda não foi publicado no registro npm; `npm install -g saasagents` não é um comando de distribuição deste produto.

## Criar uma instalação independente

Instale Git e [GitHub CLI](https://cli.github.com/), autentique com `gh auth login` e execute:

```sh
saasagents init
```

O assistente mostra a conta autenticada e pergunta o novo repositório (`conta/nome`), o nome do ambiente, o Account ID Cloudflare e a confirmação. Em seguida pede o token Cloudflare e o código privado do painel com entrada oculta. Cria um repositório privado, um environment `client`, salva os secrets e dispara os Actions do cliente. Não copia a pasta atual do usuário: publica somente o template do produto incluído no pacote.

Também aceita `--repo conta/novo-repo --name mesa-cliente-teste --account ACCOUNT_ID`. Credenciais podem vir das variáveis `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `SAASAGENTS_ADMIN_KEY`; não coloque seus valores na linha de comando ou em arquivos versionados. A confirmação continua obrigatória. Um repositório existente não é sobrescrito. A autenticação GitHub precisa poder criar repositórios privados, enviar workflows, criar environments, configurar secrets e disparar Actions.

O template contém apenas o workflow manual de instalação. Não importa o deploy automático da instalação original. As credenciais de um ambiente anterior não servem automaticamente no novo.

## Conectar uma pasta — teste único

Depois do Actions concluir, abra o painel indicado no resumo, crie o projeto, um coordenador e um token em **Conectar pasta**. No servidor do projeto:

```sh
saasagents install --url https://NOVO-WORKER.CONTA.workers.dev --directory /caminho/do/projeto
```

O assistente verifica Worker/D1, confirma o escopo de leitura e pede o token de conector com entrada oculta. Envia um snapshot e termina. Reutiliza um token local somente quando pasta e URL coincidem; também aceita `SAASAGENTS_CONNECTOR_TOKEN` no ambiente. `--approve-read` autoriza explicitamente o escopo para testes não interativos.

O token fica em `.secrets/connector.json`, com modo 600, pasta 700 e `.secrets/.gitignore` protegendo os arquivos contra inclusão acidental no Git. Não use uma pasta `.secrets` que seja link simbólico. A leitura é limitada a README, BACKLOG, STATUS, package.json, até oito tickets Markdown e metadados do Git/raiz. `inspect` permite revisar esse contexto antes do envio.

```sh
saasagents inspect --directory /caminho/do/projeto
saasagents status --directory /caminho/do/projeto
saasagents sync --directory /caminho/do/projeto
```

`status` verifica a saúde da API e a configuração; só o envio valida o token. O painel pode mostrar offline após três minutos sem novos snapshots, mesmo com o teste bem-sucedido. Sincronização contínua é opcional com `sync --watch`; encerre com Ctrl+C. Nenhum serviço ou cron é instalado.

O CLI não recebe comandos remotos, não escreve código do projeto nem executa IA. Para um teste de análise, use **Resumo executivo** no novo painel após o envio. O Workers AI utiliza a cota da conta do cliente.
