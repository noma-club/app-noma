# Noma Club 🧘

> **Pilates · Movimento · Conexão**

Sistema de gestão do Noma Club.

Identidade visual aplicada: vinho `#4d0014`, verde `#0f2d20`, rosa `#be7882`, rosê `#ffd8d9`; tipografia Playfair Display (títulos) + Montserrat (texto), carregadas via Google Fonts.

- **Professores/donos**: acesso autenticado em `/admin` (instale como app pelo navegador do celular — é um PWA).
- **Clientes**: acesso por link individual `/aluno/<token>` (sem senha — cada cliente tem um link único, mostrado na tela de Clientes).

### Atualização 2 (nov/2026)

- **Login por usuário + senha** (sem e-mail e sem Supabase Auth). Resolve o erro "This endpoint requires a valid Bearer token" ao criar usuários e acaba com o **logout aleatório** ao navegar (a sessão agora é um cookie assinado, validado localmente — sem chamada de rede por página).
- **Senha forte** obrigatória: mínimo 8 caracteres, com maiúscula, minúscula e caractere especial.
- **Sidebar retrátil em vinho** (cor primária da marca); o **verde agora é só detalhe** (acento do item ativo, bordas de vaga, valores positivos).
- **Agenda em formato de calendário semanal** (colunas por dia, blocos de aula, hoje destacado).
- **Financeiro**: corrigido o **overflow horizontal**/aperto das colunas (container queries); cards com acento de cor.

### Atualização 1 (nov/2026)

- Visual repaginado e responsivo; **categorias customizáveis**; página de **Relatórios** (evolução, quebra por categoria, DRE, impressão/PDF); **confirmação** em ações sensíveis; rodapé **Azex Tech**.

> Requer rodar as migrations `004_categories.sql` e `005_auth.sql` (ver passo 2 abaixo).

## Regras de negócio implementadas (reunião de nov/2026)

| Regra | Implementação |
| --- | --- |
| Cliente visitante → experimental/avulso → **fixo ao fechar plano** | Status muda automático ao ativar assinatura |
| Planos de 1, 3 ou 6 meses, **pagamento mensal** | Assinatura com `next_due_date`; botão "Receber mensalidade" empurra +1 mês |
| Pagamentos: pix, crédito, débito, dinheiro (manual) | Lançamento manual no Financeiro |
| Despesas recorrentes e pontuais | Categorias: aluguel, internet, contabilidade, luz, impostos, celular... |
| Fluxo de caixa e faturamento mensal | Tela Financeiro, navegável por mês |
| 2 espaços (4 e 8 pessoas) + ala de massagem | Seed em `supabase/seed.sql` |
| Modalidades: solo, dupla, grupo (4), aparelho (4), pilates/yoga/hot (8) | Capacidade da aula = menor entre modalidade e espaço |
| Vagas liberadas por aula | Campo `released_spots` limita inscrições online |
| Marcar/cancelar até **6h antes** | Validado no servidor (`src/lib/enrollment.ts`) |
| Cancelou no prazo → **reposição (máx. 2/mês)** | Tabela `makeup_credits` |
| Cancelou fora do prazo → perde reposição | Registrado em `cancelled_in_time` |
| Lista de espera com promoção automática | Ao abrir vaga, 1º da fila é inscrito |
| Professor vê **só as aulas dele**; dono vê tudo | Filtro por `role` em agenda e dashboard |
| Professor marca **presença/falta** | Tela de chamada da aula |
| Aniversário do cliente | Lista de aniversariantes do mês no dashboard |
| Aluno **não** vê histórico de aulas | Área do aluno mostra só aulas futuras + vencimento |

## Stack (100% free tier)

| Camada | Ferramenta | Custo |
| --- | --- | --- |
| Banco + Auth | Supabase (free: 500 MB, 50k MAUs) | R$ 0 |
| App web (admin + aluno) | Next.js 15 | R$ 0 |
| Hospedagem | Cloudflare Pages ou Netlify (uso comercial permitido no free) | R$ 0 |

> ⚠️ **Não use Vercel no plano gratuito** — o free tier (Hobby) proíbe uso comercial.

## Como rodar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (free).
2. No **SQL Editor**, rode, na ordem: `supabase/migrations/001_schema.sql`, `002_users.sql`, `003_security.sql`, `004_categories.sql`, `005_auth.sql` e `supabase/seed.sql`.
   - Já tem o banco de antes? Rode só as migrations novas: `004_categories.sql` e `005_auth.sql`.
3. **Login inicial** (criado pela migration `005_auth.sql`):
   - Usuário: `admin` · Senha: `Noma@2026`
   - **Troque a senha no primeiro acesso** (aba Usuários → Redefinir) e crie os demais acessos por lá.
   - Não há e-mail: o login é 100% por **usuário + senha** (geridos no próprio app).

### 2. App local

```bash
cp .env.example .env.local   # preencha com a URL e a service_role key do Supabase
npm install
npm run dev                  # http://localhost:3000
```

### 3. Deploy na Cloudflare (Workers + OpenNext)

O projeto já vem configurado (`wrangler.jsonc` + `open-next.config.ts`).

**Pelo painel (recomendado — deploy automático a cada commit):**

1. Suba este repositório no GitHub.
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Import a repository** → escolha o repo.
3. Configure:
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx opennextjs-cloudflare deploy`
4. Em **Build variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` (necessária no build).
5. Após o 1º deploy: **Settings → Variables and Secrets** do Worker → adicione como **Secret**:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - e também `NEXT_PUBLIC_SUPABASE_URL` (como variável normal)
   Depois clique em **Retry deployment** para aplicar.

**Pela linha de comando (alternativa):**

```bash
npm install
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Pronto: admin em `https://noma.<sua-conta>.workers.dev/admin`, link dos alunos em `/aluno/<token>`. Domínio próprio: **Settings → Domains & Routes** do Worker.

> O free tier do Supabase **pausa o projeto após ~1 semana sem uso**. Com uso diário do estúdio isso não acontece; se pausar, reative no painel.


## Gerenciamento de usuários (exclusivo dos donos)

Aba **Usuários** no app (visível só para `role = dono`):

- **Equipe**: criar acesso de professores/donos (e-mail + senha), mudar papel, redefinir senha e **desativar/reativar** (desativado não loga, mas o histórico de aulas é preservado).
- **Alunos**: gerar novo link de acesso (invalida o anterior) e excluir aluno (remove inscrições, assinaturas e reposições em cascata). O cadastro em si continua na aba Clientes.

## Segurança

Ver **[SECURITY.md](SECURITY.md)** — mapeamento OWASP Top 10, CSP/headers, anti brute force e checklist de manutenção.


- Todo acesso ao banco passa pelo servidor Next.js usando a **service_role key** (nunca exposta ao navegador).
- RLS está **habilitado em todas as tabelas sem policies públicas** — o banco não aceita acesso direto do cliente.
- Admin autenticado via Supabase Auth (cookie httpOnly de 8h).
- Aluno autenticado pelo token único do link (32 hex chars, rotacionável mudando `access_token`).

## Estrutura

```
supabase/
  migrations/001_schema.sql   # tabelas + regras
  seed.sql                    # espaços, modalidades, planos, despesas recorrentes
src/
  lib/db.ts                   # cliente Supabase (server) + formatação pt-BR
  lib/auth.ts                 # login/sessão dos donos/professores
  lib/enrollment.ts           # ⭐ regras: 6h, reposição 2/mês, lista de espera
  app/login/                  # login admin
  app/admin/                  # dashboard, agenda, chamada, clientes, financeiro
  app/aluno/[token]/          # área do aluno via link
```

## Próximos passos sugeridos

- [ ] Aulas recorrentes (gerar a grade da semana automaticamente)
- [ ] Lembrete de aula/vencimento via WhatsApp (link `wa.me` já dá para montar manualmente com o telefone do cliente)
- [ ] Relatório de inadimplência
- [ ] Venda de pacotes de aulas avulsas com saldo
