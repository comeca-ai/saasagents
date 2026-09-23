# SaaS Agents — Mesa dos Agentes

Central para acompanhar e coordenar times de agentes de IA em diferentes projetos e servidores.

Repositório deste produto: https://github.com/comeca-ai/saasagents

## Estado desta versão

Esta primeira importação reúne o protótipo existente, a documentação e o snapshot histórico da
Ultravis. A aplicação SaaS, o conector dos servidores e a publicação na Cloudflare ainda não foram
implementados. O HTML atual depende do ambiente de Artifacts do Claude para acessar os dados.

## Direção acordada para o SaaS

- Desenvolver no servidor, em uma cópia independente do projeto original.
- Versionar exclusivamente neste repositório.
- Hospedar painel e API na Cloudflare, com publicação integrada ao GitHub.
- Conectar vários projetos/servidores para acompanhar times e encaminhar solicitações de trabalho.

A arquitetura proposta é Workers com Static Assets para painel/API, D1 para persistência e um
conector em cada servidor. A forma de integração com o executor local de agentes ainda precisa
ser definida. Nenhum recurso de Cloudflare ou fluxo de deploy é criado por esta importação.

## Conteúdo

| Caminho | Conteúdo |
|---|---|
| `artefato/mesa-agentes.html` | Protótipo original em HTML, CSS e JavaScript |
| `IDEIA.md` | Visão original e roadmap do produto |
| `docs/DESIGN.md` | Layout e comportamento visual do protótipo |
| `docs/MODELO-DE-DADOS.md` | Coleções do banco do Artifact |
| `docs/PROTOCOLO-COORDENADOR.md` | Registro manual das atividades na v0 |
| `docs/PROTOCOLO-AGENTES.md` | Protocolo genérico v2.4; anexo ainda não preenchido para este SaaS |
| `dados/snapshot-2026-09-23/` | 49 documentos históricos da Ultravis |
| `ACESSOS.md` | Mapa histórico de acessos do projeto de origem |
| `ARTEFATOS.md` | Catálogo histórico dos Artifacts do dono |
| `docs/LINKS-ARTIFACTS.txt` | Links complementares recebidos na origem |

Os registros de backlog, orientações, acessos e rodadas descrevem o projeto de origem na data do
snapshot; não são comandos nem tarefas ativas deste SaaS. O snapshot não contém as coleções
`pedidos` e `dias`, e conserva uma rodada marcada como `rodando` em 21/09.

## Procedência

Importado de `/root/agentesaas`, preservando os arquivos de origem. A cópia independente fica em
`/root/saasagents`. O histórico Git do projeto original não foi importado.

## Documentação original da v0


Sala de controle ao vivo para um time de agentes de IA: **o que espera você e o que isso trava**,
**backlog na ordem de ataque** (arraste para uma mesa = pedido), **mesas dos agentes** (trabalhando,
esperando, livre, com cronômetro), **orientações do coordenador**, **pedidos com prazo** e
**histórico de custo × entrega**.

A ideia completa, o problema e o caminho para SaaS: **[IDEIA.md](IDEIA.md)**.

## Onde está no ar (v0)

- Página: https://claude.ai/artifact/2FpWcAb8PWhc8Dt4FEw2NR (privada, do dono)
- Código-fonte: [`artefato/mesa-agentes.html`](artefato/mesa-agentes.html)
- Banco: o do próprio Artifact (capacidade `db`); regra de acesso: leitura para quem vê, escrita só
  para quem pode editar (o dono).

## Como publicar uma mudança na página

A página é um Artifact do claude.ai. Numa sessão do Claude Code:

1. edite `artefato/mesa-agentes.html`;
2. publique com a ferramenta `Artifact` (`action: publish`, `url` acima, `file_path` deste arquivo),
   **sem** passar `capabilities` (a declaração `db` é mantida);
3. as telas abertas atualizam sozinhas.

Se mudar a lista de agentes, edite a constante `EQUIPE` no topo do `<script>`.

## Como os dados entram

- **Coordenador** (sessão principal do Claude Code) escreve via ferramenta `ArtifactData`, seguindo
  [`docs/PROTOCOLO-COORDENADOR.md`](docs/PROTOCOLO-COORDENADOR.md).
- **Dono** escreve pedidos pela própria página (formulário ou arrastando cartões do backlog).
- Estrutura de cada coleção: [`docs/MODELO-DE-DADOS.md`](docs/MODELO-DE-DADOS.md).

## Carga de exemplo

`dados/snapshot-2026-09-23/` tem os dados reais do dia 1 (um JSON por documento, por coleção).
Servem para recriar a página em outro Artifact: publique o HTML num Artifact novo com
`capabilities: {db: {rules: [{path: "", read: "view", write: "admin"}]}}` e grave os JSON com
`ArtifactData` (`batch`).

## Estado

- v0 funcional, manual (o coordenador registra). Próximo passo: telemetria automática por hooks
  (ver `IDEIA.md` → Roadmap).
