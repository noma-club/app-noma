# Noma Club — Sistema de Gestão do Estúdio

Sistema de gestão para estúdio de Pilates: agenda de aulas, cadastro de alunos,
planos/assinaturas, controle financeiro e um portal de autoatendimento para o aluno.

Dois públicos, dois modos de acesso:

| Público | Acesso | Como entra |
|---|---|---|
| Donos e professores | `/admin` | usuário + senha |
| Alunos | `/aluno/<token>` | link único, sem senha |

---

## Sumário

- [Stack e infraestrutura](#stack-e-infraestrutura)
- [Fluxo de trabalho e deploy](#fluxo-de-trabalho-e-deploy)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Autenticação e sessão](#autenticação-e-sessão)
- [Modelo de permissões](#modelo-de-permissões)
- [Estrutura do código](#estrutura-do-código)
- [Rotas](#rotas)
- [Regras de negócio](#regras-de-negócio)
- [Identidade visual](#identidade-visual)
- [Armadilhas conhecidas](#armadilhas-conhecidas-leia-antes-de-depurar)

---

## Stack e infraestrutura

- **Next.js 15** (App Router) + **TypeScript**
- **React Server Components** e **Server Actions** — quase não há API REST própria
- **Supabase** (PostgreSQL) como banco
- **Cloudflare Workers** como runtime, via **OpenNext** (`@opennextjs/cloudflare`)
- CSS próprio em `src/app/globals.css` (sem framework de UI)

Produção: <https://app-noma.noma-club-app.workers.dev>

> O runtime é **Workers**, não Node. Nada de `fs`, nada de dependência que exija
> binário nativo. Criptografia usa a **Web Crypto API** (`crypto.subtle`).

---

## Fluxo de trabalho e deploy

```
alterações no código  →  commit no GitHub (noma-club/app-noma)  →  build automático na Cloudflare
```

Não há deploy manual. Commitou, a Cloudflare builda e publica.

Migrations **não** rodam no deploy: são aplicadas à mão no **SQL Editor do Supabase**.
Ao subir uma migration nova, rode o SQL **antes** (ou junto) do commit que depende dela.

---

## Variáveis de ambiente

Configuradas no painel da Cloudflare, no Worker.

| Nome | Onde | O que é |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Build variable** | URL base do projeto Supabase, **sem** `/rest/v1` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** (runtime) | chave `service_role` / `sb_secret_...` |
| `SESSION_SECRET` | **Secret** (runtime) | segredo do HMAC que assina o cookie de sessão |

⚠️ **`SUPABASE_SERVICE_ROLE_KEY` precisa ser mesmo a `service_role`.** A chave `anon`
(ou `sb_publishable_`) é pública e **não ignora o RLS** — com ela o app autentica mas
não lê nem grava nada. Veja [Armadilhas conhecidas](#armadilhas-conhecidas-leia-antes-de-depurar).

`NEXT_PUBLIC_*` é embutida no build, então **mudá-la exige um build novo**, não só
salvar a variável.

### Diagnóstico

`GET /api/diag` (restrito ao **dono logado**) responde se cada peça está no lugar:
presença das variáveis, papel da chave Supabase decodificado (sem expor a chave),
se uma leitura comum na tabela `profiles` passa pelo RLS, e se o cookie chegou.
É a primeira parada quando "nada funciona".

---

## Banco de dados

### Migrations — rodar nesta ordem

| Arquivo | Conteúdo |
|---|---|
| `001_schema.sql` | tabelas, FKs, RLS ligado |
| `002_users.sql` | perfis iniciais |
| `003_security.sql` | `login_attempts` e endurecimento |
| `004_categories.sql` | categorias de receita e despesa |
| `005_auth.sql` | login próprio: `username`/`password_hash` + RPCs |
| `006_session_fix.sql` | remove policy morta do Supabase Auth, cria `get_app_user`, concede `execute` |
| `seed.sql` | planos, modalidades, salas e categorias de exemplo |

### Tabelas

**Pessoas** — `profiles` (equipe: dono/professor), `clients` (alunos, cada um com `access_token`)

**Agenda** — `class_types` (modalidades), `spaces` (salas), `classes` (aulas),
`enrollments` (inscrições), `waitlist` (lista de espera), `makeup_credits` (créditos de reposição)

**Comercial** — `plans`, `subscriptions`

**Financeiro** — `payments`, `expenses`, `income_categories`, `expense_categories`

**Segurança** — `login_attempts` (bloqueio por tentativas)

### Funções (RPC)

Todas `SECURITY DEFINER`, para funcionarem independentemente de RLS:

| Função | Uso |
|---|---|
| `verify_app_user(username, password)` | valida login (bcrypt via `pgcrypto`) |
| `create_app_user(...)` | cria usuário da equipe |
| `set_app_user_password(id, senha)` | troca/reseta senha |
| `get_app_user(id)` | resolve o usuário da sessão |
| `rotate_client_token(id)` | gera novo link do aluno |

### Modelo de segurança do banco

**RLS está ligado em tudo e praticamente não existem policies.** Isso é proposital:

- O navegador **nunca** fala com o Supabase. Todo acesso acontece no servidor.
- O servidor usa a `service_role`, que ignora RLS.
- Qualquer outro caminho (chave `anon` vazada, acesso direto à URL pública) **não lê nada**.

> 🚫 **Não "resolva" um erro de RLS criando policy permissiva.** A
> `NEXT_PUBLIC_SUPABASE_URL` é pública; abrir o RLS para o papel `anon` expõe
> CPF, telefone e financeiro de todos os alunos para qualquer um. Se aparecer
> `violates row-level security policy`, o problema é a **chave**, não a policy.

---

## Autenticação e sessão

Não se usa Supabase Auth. O login é próprio:

1. `POST /api/login` recebe usuário e senha do formulário.
2. `verify_app_user` confere o hash bcrypt direto no Postgres.
3. Em caso de sucesso, gera-se `userId.expiração.assinatura`, assinado com
   **HMAC-SHA256** usando `SESSION_SECRET`.
4. Grava-se no cookie `noma_session` — `httpOnly`, `secure`, `SameSite=Lax`, **8h**.
5. A cada requisição, `getSessionUser()` confere a assinatura e carrega o perfil
   via `get_app_user`.

A validação é **local**: nenhuma ida ao banco para verificar o token em si.

Senha: mínimo 8 caracteres, com maiúscula, minúscula e caractere especial
(`src/lib/password.ts`). Tentativas erradas são registradas em `login_attempts`
e disparam bloqueio temporário (`src/lib/ratelimit.ts`).

**Aluno** não tem senha: o `access_token` na URL *é* a credencial. Se vazar, use
"gerar novo link" — o token antigo morre na hora.

---

## Modelo de permissões

Dois papéis: `dono` e `professor`.

| Área | Dono | Professor |
|---|---|---|
| Agenda | cria, exclui, inscreve, marca presença | **só visualiza** |
| Clientes | cadastra e edita | **só visualiza** |
| Financeiro | completo | **sem acesso** (oculto no menu) |
| Cadastros | completo | sem acesso |
| Usuários | completo | sem acesso |

A regra é aplicada **duas vezes**: a UI esconde o controle e a Server Action
chama `requireOwner()`. Esconder o botão não é proteção — o bloqueio real está
no servidor.

---

## Estrutura do código

```
src/
├── app/
│   ├── admin/              # área autenticada da equipe
│   │   ├── agenda/         # aulas, inscrições, presença
│   │   ├── cadastros/      # modalidades, salas, planos, categorias
│   │   ├── clientes/       # alunos, assinaturas, pagamentos
│   │   ├── financeiro/     # entradas, saídas, relatórios
│   │   └── usuarios/       # equipe e links de aluno
│   ├── aluno/[token]/      # portal do aluno, sem senha
│   ├── api/                # login, logout, diag
│   ├── login/
│   └── globals.css         # todo o CSS do projeto
├── components/
└── lib/
supabase/migrations/
```

Cada pasta de `admin/` segue o mesmo par: `page.tsx` (Server Component que lê o
banco) + `actions.ts` (Server Actions que gravam).

### `src/lib`

| Arquivo | Responsabilidade |
|---|---|
| `auth.ts` | sessão, HMAC, `requireUser` / `requireOwner` |
| `db.ts` | cliente Supabase + formatação (datas, `brl`) + constantes de regra |
| `dbwrite.ts` | `check()` — faz o erro do banco aparecer na tela |
| `enrollment.ts` | inscrever, cancelar, créditos de reposição |
| `finance.ts` | períodos, variação mês a mês |
| `password.ts` | validação de senha e normalização de usuário |
| `ratelimit.ts` | bloqueio por tentativas de login |

### `src/components`

| Componente | Para quê |
|---|---|
| `AdminShell` | layout, menu lateral e filtro por papel |
| `ActionForm` | formulário que atualiza a tela sozinho após gravar |
| `CopyLink` | link completo do aluno + botão copiar |
| `PasswordField` | campo de senha com olho de mostrar/ocultar |
| `ConfirmButton` | confirmação antes de ação destrutiva |
| `PrintButton` | impressão de relatório |
| `AzexFooter` | rodapé do desenvolvedor |

---

## Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `/` | público | entrada |
| `/login` | público | login da equipe |
| `/admin` | equipe | painel do dia |
| `/admin/agenda` | equipe | grade de aulas |
| `/admin/agenda/[id]` | equipe | detalhe da aula, presença |
| `/admin/clientes` | equipe | alunos, planos, pagamentos |
| `/admin/cadastros` | dono | modalidades, salas, planos, categorias |
| `/admin/financeiro` | dono | entradas e saídas |
| `/admin/financeiro/relatorios` | dono | relatórios mensais |
| `/admin/usuarios` | dono | equipe e links de aluno |
| `/aluno/[token]` | aluno | agenda, inscrição, cancelamento |
| `/api/login`, `/api/logout` | — | sessão |
| `/api/diag` | dono | diagnóstico de configuração |

---

## Regras de negócio

Centralizadas em `src/lib/db.ts` e `src/lib/enrollment.ts`:

- **Janela de cancelamento: 6h** (`ENROLL_CANCEL_WINDOW_HOURS`). Cancelou com
  mais de 6h de antecedência, ganha crédito de reposição; com menos, perde a aula.
- **Máximo de 2 reposições por mês** (`MAX_MAKEUPS_PER_MONTH`).
- **Lotação** vem da modalidade (`class_types.max_students`) e da sala
  (`spaces.capacity`). Cheio, o aluno entra na `waitlist`.
- **Fechar plano torna o aluno `fixo`** automaticamente.
- **Status do aluno**: `visitante` → `experimental` → `avulso` → `fixo`.
- **Planos**: duração de 1, 3 ou 6 meses. A duração **não muda** depois de criado,
  porque assinaturas já emitidas dependem dela.
- O admin pode inscrever **ignorando a janela de 6h**; o aluno, não.

---

## Identidade visual

| Cor | Hex | Uso |
|---|---|---|
| Vinho | `#4d0014` | primária |
| Verde | `#0f2d20` | detalhes e acentos |
| Rosa | `#be7882` | apoio |
| Rosê | `#ffd8d9` | fundos claros |

Tipografia: **Playfair Display** (títulos) e **Montserrat** (texto).
Logo em `public/logo.svg`. Rodapé: Azex Tech.

---

## Armadilhas conhecidas (leia antes de depurar)

Esta seção existe porque cada item abaixo já custou horas.

### 1. Erro de RLS significa chave errada

```
new row violates row-level security policy for table "spaces"
```

Uma `service_role` verdadeira **ignora RLS** — é incapaz de gerar esse erro.
Se ele aparece, a chave configurada não é a `service_role`.

O sintoma engana: funções `SECURITY DEFINER` (login) continuam funcionando
enquanto **toda** consulta comum falha. Dá a impressão de bug de sessão ou de
cookie, quando é configuração. Confirme em `/api/diag`.

### 2. Variável de ambiente no topo do módulo chega vazia

No OpenNext/Cloudflare, variáveis e secrets são resolvidos **por requisição**.
Ler no escopo do módulo congela o valor errado:

```ts
// ❌ roda antes da requisição existir — pega undefined
const SECRET = process.env.SESSION_SECRET || "fallback";

// ✅ lê em tempo de requisição
function sessionSecret() {
  return process.env.SESSION_SECRET || "fallback";
}
```

Isso derrubava a sessão logo após o login: a assinatura era feita com um
segredo e conferida com outro.

### 3. Não grave cookie em resposta de redirect

O header `Set-Cookie` se perde de forma intermitente em respostas 3xx sob
OpenNext. `/api/login` responde **200** com o cookie e manda o navegador ao
`/admin` pelo cliente. Parece contraintuitivo, mas é o caminho confiável.

### 4. Toda gravação precisa de `check()`

`supabase-js` **não lança exceção** — ele devolve `{ error }`. Escrever
`await db().from("x").insert(...)` sem ler o `error` faz a falha sumir, e o
usuário vê "não acontece nada".

```ts
import { check } from "@/lib/dbwrite";

check(await db().from("spaces").insert({ ... }), "/admin/cadastros", "Criar sala");
```

O mesmo vale para `if (!algo) return;` depois de uma leitura — explique o motivo
em vez de sair calado.

### 5. Atualizar a tela sem F5

`revalidatePath()` sozinho nem sempre atualiza a árvore já renderizada. Use o
`ActionForm`, que chama `router.refresh()` ao fim da ação.

### 6. Senha semeada está no repositório

A `005_auth.sql` cria `admin` / `Noma@2026` em texto puro, versionado no Git.
**Troque no primeiro acesso.** Quem tem acesso ao repositório conhece a senha inicial.

---

## Checklist de um ambiente novo

1. Criar projeto no Supabase.
2. Rodar as migrations `001` → `006`, depois `seed.sql`.
3. Na Cloudflare: `NEXT_PUBLIC_SUPABASE_URL` como *build variable*;
   `SUPABASE_SERVICE_ROLE_KEY` e `SESSION_SECRET` como *secrets*.
4. Commitar e aguardar o build.
5. Abrir `/api/diag` logado como dono e conferir que tudo está ✅.
6. Entrar com `admin` / `Noma@2026` e **trocar a senha**.
7. Em **Cadastros**, ajustar modalidades, salas, planos e categorias.
