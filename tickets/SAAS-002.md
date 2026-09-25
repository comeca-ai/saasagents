# SAAS-002 — Instalação na infraestrutura do cliente

Estado: implementação local; validação remota pendente.

Pedido: o cliente escolhe GitHub/Cloudflare no CLI, usa seus Actions e instala o conector em outro servidor. Primeiro teste envia somente um snapshot. Produto independente; nada do GEO/Ultravis é implantado.

Entrega: `saasagents init` cria repo privado a partir de template limitado ao produto, configura environment/secrets e dispara workflow manual. `install-client.yml` cria Worker/D1 com nome exclusivo, publica painel e verifica saúde/login. `saasagents install` confirma contexto e usa token do novo painel. Tarball distribuível sem depender de publicação no npm.

Validação: testes da API e do conector, provisionamento simulado (incluindo colisão e recusa de credenciais), wizard com GitHub simulado, envio único HTTP local e verificação do pacote instalado. Nenhuma conta de cliente foi criada por estes testes.

Limites: requer Node.js 22+, Git e gh autenticado para init; repo de destino novo; conta Cloudflare com workers.dev e permissões necessárias. Deploy parcial pode deixar recursos criados; retomada é explícita. O instalador não oferece cobrança/licenciamento e não executa inferência automaticamente.
