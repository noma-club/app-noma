-- =============================================================
-- ESTUDIIO — Schema do banco (Supabase / PostgreSQL)
-- Regras levantadas na reunião de alinhamento (nov/2026):
--   * Cliente: visitante, experimental/avulso ou fixo (fecha plano)
--   * Planos de 1, 3 ou 6 meses — pagamento sempre mensal
--   * Pagamentos: pix, crédito, débito, dinheiro (controle manual)
--   * Despesas: aluguel, internet, contabilidade, luz, impostos, celular...
--   * 2 espaços (4 e 8 pessoas) + ala de massagem
--   * Modalidades: solo, yoga, pilates, hot (até 8), dupla, grupo (4), aparelho (4)
--   * Marcar/cancelar aula: até 6h antes do início
--   * Cancelou com antecedência (>=6h): ganha reposição (máx. 2/mês)
--   * Cancelou fora do prazo (<6h): perde o direito à reposição
--   * Lista de espera quando a aula lota
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- Perfis (donos / professores) ----------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role text not null default 'professor' check (role in ('dono', 'professor')),
  created_at timestamptz not null default now()
);

-- ---------- Clientes ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_date date,                    -- aniversário
  cpf text,
  phone text,
  status text not null default 'visitante'
    check (status in ('visitante', 'experimental', 'avulso', 'fixo')),
  access_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_clients_token on clients (access_token);

-- ---------- Planos (1, 3 ou 6 meses; pagamento mensal) ----------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_months int not null check (duration_months in (1, 3, 6)),
  classes_per_week int not null default 1,
  monthly_price numeric(10, 2) not null,
  active boolean not null default true
);

-- ---------- Assinaturas (cliente fixo = tem assinatura ativa) ----------
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  plan_id uuid not null references plans (id),
  start_date date not null default current_date,
  end_date date not null,
  next_due_date date not null,        -- próximo vencimento do pagamento
  status text not null default 'ativa'
    check (status in ('ativa', 'encerrada', 'cancelada')),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_client on subscriptions (client_id);
create index if not exists idx_subscriptions_due on subscriptions (next_due_date) where status = 'ativa';

-- ---------- Recebimentos ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  subscription_id uuid references subscriptions (id) on delete set null,
  description text not null,          -- ex: 'Mensalidade nov/2026', 'Aula avulsa', 'Produto'
  kind text not null default 'mensalidade'
    check (kind in ('mensalidade', 'aula_avulsa', 'produto', 'outro')),
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('pix', 'credito', 'debito', 'dinheiro')),
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_paid_at on payments (paid_at);

-- ---------- Despesas (recorrentes e pontuais) ----------
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null
    check (category in ('aluguel', 'internet', 'contabilidade', 'luz', 'impostos', 'celular', 'equipamento', 'manutencao', 'outro')),
  amount numeric(10, 2) not null check (amount > 0),
  recurring boolean not null default false,  -- gasto recorrente vs pontual
  due_day int check (due_day between 1 and 31),  -- dia do vencimento, se recorrente
  paid_at date,                       -- null = ainda não paga neste ciclo
  reference_month date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_month on expenses (reference_month);

-- ---------- Espaços ----------
create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity int not null check (capacity > 0),
  active boolean not null default true
);

-- ---------- Modalidades ----------
create table if not exists class_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_students int not null check (max_students > 0),
  active boolean not null default true
);

-- ---------- Aulas (agenda) ----------
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references class_types (id),
  space_id uuid not null references spaces (id),
  teacher_id uuid not null references profiles (id),
  starts_at timestamptz not null,
  duration_min int not null default 60,
  capacity int not null,              -- min(espaço, modalidade), definido na criação
  released_spots int not null,        -- vagas liberadas p/ inscrição online (<= capacity)
  created_at timestamptz not null default now(),
  constraint released_within_capacity check (released_spots <= capacity)
);

create index if not exists idx_classes_starts on classes (starts_at);
create index if not exists idx_classes_teacher on classes (teacher_id, starts_at);

-- ---------- Inscrições ----------
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  status text not null default 'inscrito'
    check (status in ('inscrito', 'cancelado', 'presente', 'falta')),
  is_makeup boolean not null default false,       -- é uma reposição?
  cancelled_at timestamptz,
  cancelled_in_time boolean,          -- true = cancelou com >= 6h de antecedência
  created_at timestamptz not null default now(),
  unique (class_id, client_id)
);

create index if not exists idx_enrollments_class on enrollments (class_id);
create index if not exists idx_enrollments_client on enrollments (client_id);

-- ---------- Lista de espera ----------
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, client_id)
);

-- ---------- Créditos de reposição (máx. 2 por mês por cliente) ----------
create table if not exists makeup_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  earned_month date not null,         -- mês em que o crédito foi gerado (primeiro dia)
  source_enrollment_id uuid references enrollments (id) on delete set null,
  used_enrollment_id uuid references enrollments (id) on delete set null,  -- null = disponível
  created_at timestamptz not null default now()
);

create index if not exists idx_makeup_client_month on makeup_credits (client_id, earned_month);

-- =============================================================
-- RLS: tudo bloqueado por padrão.
-- O acesso é feito exclusivamente pelo backend Next.js com a
-- service_role key (área admin autenticada + área do aluno
-- validada por access_token). Nenhuma policy pública.
-- =============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table spaces enable row level security;
alter table class_types enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table waitlist enable row level security;
alter table makeup_credits enable row level security;

-- Donos/professores autenticados podem ler o próprio perfil
create policy "read own profile" on profiles
  for select using (auth.uid() = id);
