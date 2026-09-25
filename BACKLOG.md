# Backlog — SaaS Agents

## Entregue na v0
- Painel privado publicado na Cloudflare, usando apenas o repositório comeca-ai/saasagents.
- Card de resumo e objetivo editável, projetos, agentes, pedidos e histórico persistente.
- Conector desta pasta com leitura consentida, token por projeto e status de conexão.
- Resumo executivo sob demanda, validado com análise real pelo Workers AI.

## Próximas evoluções — planejadas, não iniciadas
1. Seleção personalizada de arquivos no conector (o pacote e o assistente de instalação já foram implementados; leitura ainda usa lista fixa).
2. Evidências mais precisas e indicação de mudanças desde a última análise.
3. Integração com executores locais, com autorização separada para escrita e comandos.
4. Login individual, organizações e isolamento entre clientes antes de abrir para terceiros.
5. Orçamento por execução, cancelamento e telemetria de custos monetários.
6. Assinatura e serviços de gestão SaaS para instalações na conta do cliente; cobrança e licenciamento ainda não implementados.

## Implementado localmente — aguardando teste em conta de cliente
- CLI `saasagents init`: escolhe GitHub/Cloudflare, cria repo privado e dispara Actions.
- Workflow manual para Worker e D1 próprios, com verificação de saúde/login e proteção contra colisão de nomes.
- Pacote transportável com template sem dados históricos; `install` confirma leitura e envia um único snapshot.

O estado verificado está em STATUS.md. Esta lista de evolução não indica trabalho em andamento.
