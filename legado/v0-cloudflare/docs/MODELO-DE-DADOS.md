# Modelo de dados (v0)

Banco de documentos JSON do Artifact. Cada coleção abaixo; `id` é o id do documento.
Datas em ISO 8601 UTC (`2026-09-23T11:40:00Z`); prazos em `YYYY-MM-DD`.
Regra de acesso: raiz `read: view`, `write: admin` — só quem pode editar (o dono e o coordenador,
que age como o dono) escreve.

Quem pode ser responsável (`de`) numa espera: `dono` · `igor` · `socios` · `coordenador` · nome de
um agente. Só `de: "dono"` aparece na faixa **Esperando você**.

## `escritorio` — o coordenador

Um documento: `escritorio/coordenador`.

| Campo | Tipo | Uso |
|---|---|---|
| `tema` | texto | o assunto em que o coordenador está agora |
| `detalhe` | texto? | próximo passo / contexto curto |
| `desde` | ISO | quando entrou no tema (relógio "no tema há") |
| `esperando` | texto? | o que ele espera |
| `de` | texto? | de quem espera |
| `bloqueia` | texto? | o que isso trava (aparece em "trava:") |
| `esperaDesde` | ISO? | desde quando espera ("esperando há") |

## `orientacoes` — regras que o coordenador passou ao time

| Campo | Tipo | Uso |
|---|---|---|
| `texto` | texto | a orientação |
| `quando` | ISO | quando foi dada (a página mostra as 6 mais recentes) |
| `para` | texto? | `time` ou nomes de agentes |

## `fila` — estado de cada mesa (id = nome do agente)

| Campo | Tipo | Uso |
|---|---|---|
| `proxima` | texto? | "a seguir" |
| `esperando` | texto? | o que trava o agente |
| `de` | texto? | quem precisa agir |
| `bloqueia` | texto? | o que fica travado (vai para "Esperando você" quando `de = dono`) |
| `esperaDesde` | ISO? | desde quando |

## `backlog` — cartões arrastáveis

| Campo | Tipo | Uso |
|---|---|---|
| `titulo` | texto | nome da tarefa |
| `detalhe` | texto? | uma linha de contexto |
| `grupo` | `urgente` · `fila` · `testes` · `cobranca` · `outro` | cor da borda |
| `rank` | número | **ordem de ataque** do coordenador (1 = primeiro) |
| `sugerido` | texto? | agente sugerido (→ nome) |
| `espera` / `de` | texto? | cadeado no cartão: o que espera e de quem |
| `status` | `aberto` · `atribuido` | só `aberto` aparece na coluna |
| `agente` | texto? | para quem foi atribuído |
| `prazo` | data? | vai junto para o pedido |

Arrastar para uma mesa (ou "atribuir a…") = cria um `pedidos` com `origem: "backlog/<id>"` e marca o
cartão `status: atribuido, agente`.

## `pedidos` — o que o dono pede

| Campo | Tipo | Uso |
|---|---|---|
| `agente` | texto | nome do agente ou `coordenador` ("coordenador decide") |
| `texto` | texto | o que precisa |
| `prazo` | data? | cor: em dia · vence em ≤ 2 dias · atrasado |
| `status` | `novo` · `andamento` · `feito` · `cancelado` | o dono só cancela quando `novo` |
| `criado` | ISO | quando pediu |
| `resposta` | texto? | o coordenador escreve (triagem e resultado) |
| `origem` | texto? | `backlog/<id>` quando veio de um cartão |

## `rodadas` — cada execução de agente (id `r<AAAAMMDD>-<algo>`)

| Campo | Tipo | Uso |
|---|---|---|
| `data` | ISO | início (é o relógio da mesa enquanto `rodando`) |
| `fim` | ISO? | término (relógio "livre há") |
| `agente` · `modelo` | texto | quem e em qual modelo (cor: haiku/sonnet/opus/fable) |
| `pedido` · `resultado` | texto | o que foi pedido / o que entregou |
| `estado` | `rodando` · `ok` · `achado` · `raso` · `desperdicio` · `parado` | faixa e filtro |
| `p0` · `p1` | número | achados graves / bugs reais |
| `tokens` · `minutos` · `passos` | número? | custo (vêm do fim da execução) |
| `relatorio` | texto? | onde está o relatório |

## `dias` — commits por dia (id = data)

| Campo | Tipo | Uso |
|---|---|---|
| `data` | data | o dia |
| `commits` | `{feat, fix, docs, chore, ci, outro}` | barra empilhada "Evolução do repositório" |
