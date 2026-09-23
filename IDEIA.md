# A ideia — sala de controle para times de agentes de IA

> Nome de trabalho: **Mesa dos Agentes**. Nasceu em 23/set/2026 dentro da Ultravis, a partir de um
> pedido do dono: *"como posso ver visualmente os agentes trabalhando — como um time de dev num
> escritório — o que cada um está esperando, e eu poder escrever/arrastar o que preciso para eles?"*

## O problema

Quem trabalha com um **time de agentes de IA** (um coordenador que delega para agentes
especializados — revisor de código, testador, segurança, designer, pesquisador…) perde a visão do
todo muito rápido:

- **Não vê quem está trabalhando agora**, em quê, e há quanto tempo. Os agentes rodam isolados e só
  devolvem o resultado no fim.
- **Não vê o que está travado — e quase sempre o que trava é ele mesmo** (uma senha, uma decisão,
  uma conta a abrir, uma aprovação). Esses pedidos se perdem no meio de uma conversa longa.
- **Não sabe em que ordem o coordenador vai atacar o backlog** nem quais regras ele passou ao time.
- **Não tem um lugar para pedir** ("preciso disto, deste agente, até sexta") fora do chat.
- **Não sabe quanto custou e o que rendeu**: qual agente gastou tokens e entregou pouco, qual achou
  o bug grave.

No dia em que a ideia nasceu, isso aconteceu de verdade: um agente de segurança num modelo barato
chamou de "informativa" uma falha real (qualquer usuário podia trocar de empresa); um agente de
design entregou raso; o teste de interface ficou parado horas esperando uma senha do dono — e
ninguém via isso sem perguntar.

## A solução

Uma **página única, ao vivo**, que é ao mesmo tempo painel e quadro de trabalho:

1. **Esperando você** — faixa grande no topo com tudo que depende do dono e **o que cada item está
   travando** (quantas mesas, quais tarefas). Verde quando não há nada.
2. **Backlog na ordem de ataque** — a fila numerada na ordem que o coordenador pretende atacar, com
   cor por tema e cadeado quando o item espera alguém. **Arrastar um cartão para a mesa de um agente
   vira um pedido para ele.**
3. **Escritório** — uma mesa por agente: luz acesa + cronômetro quando está trabalhando; "a seguir"
   (próxima tarefa); "esperando X" (o que o trava e quem precisa agir); contador de pedidos abertos.
4. **Coordenador** — o tema em que está agora, há quanto tempo, e **as últimas orientações que ele
   passou ao time** (as regras que os agentes devem seguir).
5. **Pedidos ao time** — formulário (para quem · o que precisa · prazo) e a lista com status
   (novo → em andamento → feito) e prazo colorido (em dia / vence em 2 dias / atrasado).
6. **Histórico** — cada rodada de agente: modelo, tokens, minutos, resultado (entregou, achou
   problema, raso, desperdício), achados P0/P1, tokens por dia por modelo, commits por dia.

## Como funciona hoje (v0)

- É um **Artifact do claude.ai** com banco de dados próprio (coleções JSON com atualização ao vivo).
  Link privado do dono: https://claude.ai/artifact/2FpWcAb8PWhc8Dt4FEw2NR
- **Quem escreve os dados é o coordenador** (a sessão principal do Claude Code), seguindo o
  `docs/PROTOCOLO-COORDENADOR.md`: marca o agente como "rodando" ao disparar, fecha a rodada com
  tokens/tempo/resultado ao terminar, mantém fila, bloqueios, backlog e orientações em dia, e **lê os
  pedidos novos no começo de cada sessão**.
- **O dono escreve** pedidos (formulário ou arrastando cartões). A página nunca dispara agente
  sozinha — o coordenador lê e decide.

**Limite honesto da v0:** a página mostra o que o coordenador registra. Se ele esquecer, a mesa
mente. A v1 resolve isso com telemetria automática (ver abaixo).

## Por que pode virar SaaS

- **O mercado está indo para times de agentes.** Claude Code, Codex, Cursor, Devin, agentes
  próprios em SDK — todos com subagentes e orquestração. Falta a camada de **gestão**: ver, destravar,
  priorizar e medir custo × entrega. Hoje isso vive em logs de terminal.
- **Quem compra:** o dono/tech lead de empresa pequena que opera com 1 humano + N agentes
  (exatamente o caso da Ultravis), e times de engenharia que adotaram agentes e precisam prestar
  contas de custo.
- **O que diferencia:** não é mais um dashboard de observabilidade de LLM (tokens, latência). É a
  visão **de gestão de time**: quem está travado por mim, em que ordem vamos atacar, que regra o
  coordenador deu, quem entregou raso.

## Roadmap para virar produto

| Fase | O quê | Como |
|---|---|---|
| **v0 (hoje)** | Painel + quadro manual, 1 time, 1 dono | Artifact claude.ai + protocolo do coordenador |
| **v1** | **Telemetria automática** — ninguém precisa lembrar de registrar | Hooks do Claude Code (ex.: `PreToolUse` na ferramenta de agente = "começou"; `SubagentStop` = "terminou", com tokens) enviando um POST para a API do produto. *Nomes/formato dos hooks a confirmar na doc oficial antes de construir.* |
| **v1** | Pedido do dono vira tarefa **sem esperar** a próxima sessão | Um "vigia" (`/loop` numa sessão aberta, ou agente agendado) que lê pedidos novos a cada N minutos |
| **v2** | Multi-time, multi-projeto, convidados (sócios aprovam itens do "esperando") | App web próprio (Next.js + Postgres), login, times, papéis |
| **v2** | Integrações | GitHub (PR/commit ligado à rodada), Slack/WhatsApp ("esperando você" como notificação), e-mail diário |
| **v3** | Inteligência de gestão | "Este agente entrega raso no modelo X — suba para Y"; custo por tarefa entregue; previsão de prazo |

## Modelo de negócio (hipótese, a validar)

- **Grátis** para 1 time e até 5 agentes (canal de aquisição via comunidade de Claude Code).
- **Pro** por time/mês (telemetria automática, histórico ilimitado, notificações).
- **Empresa**: vários times, SSO, auditoria, relatório de custo por projeto.

## Riscos

- Os próprios fornecedores (Anthropic, OpenAI, Cursor) podem lançar painel nativo — o
  diferencial precisa ser a camada de **gestão entre fornecedores**, não a de um só.
- Dependência de hooks/eventos estáveis de cada ferramenta.
- Privacidade: pedidos e resultados podem conter dado sensível do cliente → nunca guardar segredo;
  retenção configurável.

## Onde está cada coisa nesta pasta

| Arquivo | O que é |
|---|---|
| `IDEIA.md` | este documento |
| `README.md` | como usar e manter hoje |
| `artefato/mesa-agentes.html` | o código-fonte completo da página (v0) |
| `docs/MODELO-DE-DADOS.md` | todas as coleções e campos |
| `docs/PROTOCOLO-COORDENADOR.md` | a rotina que o coordenador segue para a página não mentir |
| `docs/DESIGN.md` | layout, estados visuais, cores e decisões de desenho |
| `dados/snapshot-2026-09-23/` | os dados reais do dia em que nasceu (exemplo de carga) |
| `ACESSOS.md` | quem entra onde: sistemas da Ultravis e artifacts (sem senhas) |
| `ARTEFATOS.md` | catálogo dos 50 artifacts do dono, com links, por projeto |
