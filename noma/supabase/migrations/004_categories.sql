-- =============================================================
-- NOMA CLUB — 004: categorias de lançamentos customizáveis
--
-- Antes as categorias eram fixas num CHECK no banco. Agora o dono
-- pode criar/desativar categorias pelo app, tanto de DESPESA quanto
-- de RECEBIMENTO. Removemos os CHECK e passamos a validar pela
-- tabela de categorias (o texto continua gravado no lançamento,
-- então o histórico nunca quebra se uma categoria for desativada).
-- =============================================================

-- Categorias de DESPESA
create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Categorias de RECEBIMENTO (antigo "kind" dos pagamentos)
create table if not exists income_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table expense_categories enable row level security;
alter table income_categories enable row level security;

-- Remove os CHECK fixos — categorias passam a ser livres (validadas na aplicação)
alter table expenses  drop constraint if exists expenses_category_check;
alter table payments   drop constraint if exists payments_kind_check;

-- Semente com as categorias padrão que já existiam
insert into expense_categories (name) values
  ('aluguel'), ('internet'), ('contabilidade'), ('luz'),
  ('impostos'), ('celular'), ('equipamento'), ('manutencao'), ('outro')
on conflict (name) do nothing;

insert into income_categories (name) values
  ('mensalidade'), ('aula_avulsa'), ('produto'), ('outro')
on conflict (name) do nothing;
