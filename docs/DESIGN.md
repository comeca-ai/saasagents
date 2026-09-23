# Design da página (v0)

## Leitura em uma olhada — de cima para baixo

1. **Esperando você** (faixa vermelha, 2 px de borda, título 18 px): a única coisa que o dono precisa
   fazer agora. Cada item: **o que fazer** (grande) · **trava:** o que para (vermelho) · mesa e há
   quanto tempo espera. No título: "trava N mesas e M tarefas do backlog". Sem pendências, a faixa
   fica verde: "Nada esperando você — o time pode seguir sozinho".
2. **Quadro em 3 raias** — *Backlog · ordem de ataque* | *Escritório* | *Coordenador*.
   - Tela larga: 290 px · flexível · 300 px.
   - ≤ 1100 px: Coordenador e Backlog lado a lado em cima, Escritório embaixo.
   - ≤ 700 px (celular): Coordenador → Backlog → Escritório, uma coluna.
3. **Pedidos ao time** — formulário à esquerda, lista à direita.
4. **Histórico** — indicadores, tokens por dia (por modelo), commits por dia, lista de rodadas.

## Estados de uma mesa

| Estado | Como aparece |
|---|---|
| trabalhando | fundo claro, borda âmbar com halo, luz âmbar pulsando, pedido em negrito, cronômetro âmbar "trabalhando há 04:12" |
| esperando | borda tracejada, caixa "⏸ esperando X: …" (vermelha se X = você, âmbar se outro), "parado há" |
| livre | fundo apagado, "última: …", "livre há 2 h 15" |
| com pedido aberto | selo azul "1 pedido" ao lado do nome |

## Backlog

- Lista **numerada** porque a ordem é informação (ordem de ataque do coordenador); o nº 1 em azul.
- Borda esquerda = tema: vermelho urgente · azul fila combinada · verde testes · âmbar cobrança.
- Cadeado "⏸ quem: o quê" quando o cartão espera alguém (vermelho se for o dono).
- Arrastar → mesa (ou mesa do coordenador): a mesa fica tracejada azul ao passar por cima. No
  celular, o seletor "atribuir a…" faz o mesmo.

## Cores e tipos

- Fontes: IBM Plex Sans (texto) + IBM Plex Mono (nomes de agente, relógios, números).
- Modelos têm cor fixa: haiku verde-água · sonnet violeta · opus magenta · fable âmbar.
- Semântica separada do acento: ok verde · atenção âmbar · crítico vermelho · informação azul.
- Tema claro e escuro por tokens (`:root`, `prefers-color-scheme`, `[data-theme]`).
- Movimento só na luz da mesa trabalhando, e só se o sistema não pede movimento reduzido.

## Atualização

- Relógios: calculados no navegador a cada segundo (não dependem do banco).
- Dados: assinatura ao vivo em cada coleção — quando o coordenador grava, a tela muda em 1–2 s.
