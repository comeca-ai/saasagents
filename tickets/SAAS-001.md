# SAAS-001 — v0 independente na Cloudflare

Estado: in_dev. Porte: M (hipótese). Execução nesta sessão, até duas rodadas de revisão.

Autorização: usuário solicitou construir, testar e publicar a v0 na Cloudflare, usando
comeca-ai/saasagents e o environment GitHub agents. Escopo local exclusivo: /root/saasagents.

## Plano
- Adaptar o template visual do artefato para projetos, agentes e tarefas persistentes.
- API Worker + D1, login privado e primeiro agente textual via Workers AI.
- Deploy pelo GitHub Actions usando os secrets do environment agents.
- Não conectar outros servidores, executar shell por tarefa ou importar dados históricos.

## Verificação
Testar autenticação, validação, vínculo projeto/agente/tarefa, execução única, resultado e
falha do modelo. Testar interface local e persistência; publicar e verificar saúde e criar
o primeiro agente neste SaaS. Chamadas Workers AI dependem da disponibilidade na conta.

## Contrato
Projetos possuem agentes e tarefas. Agentes têm nome, papel e instrução. Tarefas têm status
queued/running/done/failed, resultado e consumo quando disponível. Execução exige ação
explícita do dono. Dados históricos importados não participam do app.

## Validação local
- 12 testes de API/conector passaram: autenticação, origem, vínculos, execução única,
  falha de IA, tokens restritos, revogação e prevenção de leitura fora da pasta.
- Navegador Chromium: login, criar projeto e agente, criar tarefa, persistência após recarga,
  logout e telas de 1440 px / 390 px sem overflow ou erros JavaScript.
- Revisão local: somente public/ é publicado; secrets ignorados no Git; SQL parametrizado;
  cookies HttpOnly/SameSite; token do conector armazenado como hash e sem poder de leitura.
- IA real e provisionamento da conta serão verificados após o deploy.
