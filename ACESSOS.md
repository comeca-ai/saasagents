# Quem entra onde — mapa de acessos (23/set/2026)

> **Nenhuma senha, chave ou e-mail neste arquivo.** Senhas de login: só em `/root/ultravis-acesso.txt`
> (no servidor). Chaves de API: só nos `.env` (fora do git). Pessoas aparecem por papel.

## Sistemas da Ultravis

| Sistema | Endereço | Quem entra | Como |
|---|---|---|---|
| **Painel (produção)** | https://painel.ultravis.ai | clientes; o dono; o Igor (sócio); usuário demo | e-mail + senha; "Esqueceu a senha?" manda link por e-mail. Cadastro público **fechado** — contas novas só pelo operador |
| **Homologação** | https://homolog.ultravis.ai | os mesmos usuários (cópia da produção) + contas de teste (`*@homolog.local`, `+backoffice`) | e-mail + senha **própria da homologação** (a do dono está desatualizada lá — redefinir) |
| **Backoffice do operador** | https://homolog.ultravis.ai/dashboard/admin | só e-mails na lista `OPERATOR_EMAILS` (o dono e mais um operador; na homologação também a conta de teste, que sai antes da produção) | mesmo login do painel; qualquer outro usuário recebe 403. **Ainda não está na produção** |
| **Pauta de dúvidas do Igor** | https://homolog.ultravis.ai/pauta/ | quem tem o usuário/senha do Basic Auth | Basic Auth no Caddy |
| **Banco (API pública do Supabase)** | painel-db.ultravis.ai · homolog.ultravis.ai/_db | só o próprio app (chave pública + RLS) | o Postgres (portas 54322/55322) é fechado para fora |
| **Servidor** | SSH (porta 22) | o dono (root) | chave SSH |
| **GitHub** | github.com/comeca-ai/ultravis_GEO (privado) | conta `comeca-ai` (dono); runner `ultravis-servidor` no próprio servidor | cobrança do Actions ativa (resolvida em 23/set) |
| **DNS** | Cloudflare (nuvem cinza) | o dono | painel da Cloudflare |
| **Fornecedores de IA/coleta** | Cloro, Kimi (Alibaba Model Studio), Scrape.do, OpenRouter | ninguém de fora — **as chaves de IA são sempre da Ultravis** e só aparecem (nome da variável + últimos 4) no backoffice | chaves nos `.env` do servidor |
| **Stripe** (futuro) | — | o dono (conta a abrir, CNPJ) | — |

## Artifacts do claude.ai (os deste projeto)

Todos os artifacts nascem **privados** (só o dono abre). Compartilhar é pelo menu **Compartilhar** da
própria página — ninguém além do dono consegue mudar isso.

| Artifact | Link | Acesso conhecido |
|---|---|---|
| **Mesa dos Agentes** (sala de controle — este projeto) | https://claude.ai/artifact/2FpWcAb8PWhc8Dt4FEw2NR | privado, só o dono lê; escrita no banco só de quem pode editar |
| Equipe Ultravis (mapa do time de agentes) | https://claude.ai/artifact/4bamEK9unSsjfqrQkj3b2C | conferir no Compartilhar |
| Ultravis · Custos por ferramenta | https://claude.ai/artifact/D1euwXmtBV4XGzmrXct8rg | conferir |
| Ultravis · Prestação de contas 19/set (respostas de validação dos sócios, coleção `validacao`) | https://claude.ai/artifact/FitBUymvy5LKmt65LS6P4Q | conferir — os sócios responderam nele, então deve estar compartilhado com eles |
| Regras de Negócio Ultravis | https://claude.ai/artifact/Np8tp4YrAfgPFkjd3hoRFL | conferir |
| Régua das Métricas Ultravis | https://claude.ai/artifact/LTXAt2Eqi49WCrETahY3FV | conferir |
| Onde a Ultravis parou | https://claude.ai/artifact/MgTBeDen719XDJdCCqpm8T | conferir |
| Pauta — Ultravis × Igor · 07/set | https://claude.ai/artifact/VTV8ZgYysHi2Zg4zJyKnHf | conferir |
| Relatório de Teste — Onboarding OtterlyAI (concorrente) | https://claude.ai/artifact/1bQhmBPGqAQPDqD7HuEWU3 | conferir |

> O acesso de cada artifact só é confirmado abrindo a página → **Compartilhar**. Nesta sessão só foi
> confirmado o da Mesa dos Agentes (privado). A cópia do conteúdo dos demais foi bloqueada pela
> proteção de dados pessoais do Claude Code — ver `ARTEFATOS.md`.

## Regras que valem para todos

- Segredo nunca em chat, commit, log ou artifact.
- Produção só recebe mudança com OK do dono; homologação primeiro.
- Usuário novo de cliente: só pelo backoffice (operador) — não existe cadastro aberto.
