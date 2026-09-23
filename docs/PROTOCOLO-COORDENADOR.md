# Protocolo do coordenador (v0 — registro manual)

A página só mostra a verdade se o coordenador registrar. Esta é a rotina. Ferramenta: `ArtifactData`
no Artifact `https://claude.ai/artifact/2FpWcAb8PWhc8Dt4FEw2NR`. Escrever em documento que já
existe exige `if_version` (a versão lida por último).

## 1. Ao abrir a sessão

1. `list pedidos` → para cada `status: novo`: decidir (qual agente, quando), gravar
   `status: andamento` + `resposta` curta ("vai para o guardião depois do urgente").
   Pedido que gasta dinheiro/crédito ou é destrutivo: confirmar com o dono antes.
2. Conferir `backlog` contra o BACKLOG do projeto: item novo → cartão novo; item feito → remover ou
   `status: atribuido`. Reordenar `rank` se a prioridade mudou.
3. Atualizar `escritorio/coordenador` (`tema`, `detalhe`, `desde`).

## 2. Ao disparar um agente

- Gravar `rodadas/<id>` com `estado: rodando`, `data` = agora, `agente`, `modelo`, `pedido`.
  A mesa acende e o cronômetro corre.
- Limpar `esperando` da `fila/<agente>` se ele foi destravado.

## 3. Quando o agente termina

- Atualizar a mesma rodada: `estado` (ok / achado / raso / desperdicio / parado), `resultado`,
  `p0`, `p1`, `tokens`, `minutos`, `passos` (vêm da notificação de fim), `fim` = agora.
- Se ele atendeu um pedido: `pedidos/<id>` → `status: feito` + `resposta` com o resultado.
- Atualizar `fila/<agente>` (`proxima`, `esperando`, `de`, `bloqueia`, `esperaDesde`).

## 4. Sempre que algo travar ou destravar

- Trava que depende do dono → `fila/<agente>` (ou `escritorio/coordenador`) com `de: "dono"` e
  **`bloqueia` dizendo o que para** — é o que faz a faixa vermelha ser útil.
- Destravou → apagar `esperando/de/bloqueia/esperaDesde` (update com `{"__delete__": true}`).

## 5. Quando der uma regra ao time

- `orientacoes/<id>` com `texto`, `quando`, `para`. A página mostra as 6 mais recentes.

## 6. Fim do dia

- `dias/<data>` com a contagem de commits por tipo.
- Nenhuma rodada deve ficar `rodando` sem agente de fato rodando.

## Por que manual na v0 — e como deixa de ser

Os agentes rodam isolados e só devolvem o resultado no fim; a página não tem como saber sozinha.
Na v1, hooks do Claude Code (início da ferramenta de agente / fim de subagente) fazem os passos 2 e
3 automaticamente — ver `IDEIA.md` → Roadmap.
