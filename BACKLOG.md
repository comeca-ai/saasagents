# Backlog — SaaS Agents

## Em validação nesta v0
- Publicar painel privado na Cloudflare e validar o primeiro agente com contexto real desta pasta.
- Conector local com token por projeto, leitura consentida, resumo executivo e status de conexão.

## Próximos passos
1. Pacote instalável do conector, com permissões por arquivo e revisão do conteúdo antes do envio.
2. Atualização do resumo sob demanda e evidências mais precisas para pendências/bloqueios.
3. Integração com executores de agentes locais, com aprovação separada para qualquer escrita ou comando.
4. Login individual, organizações e isolamento entre clientes antes de abrir para terceiros.
5. Orçamento por execução, cancelamento e telemetria de custos.

## Limites atuais
- Um único dono; não é um SaaS aberto a novos clientes.
- Agentes geram texto. Não alteram o projeto nem iniciam subprocessos.
- Conector envia snapshot a cada minuto enquanto o processo estiver ativo.
