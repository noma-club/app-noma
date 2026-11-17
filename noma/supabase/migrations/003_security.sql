-- =============================================================
-- NOMA CLUB — 003: segurança (anti brute force)
-- Registro de tentativas de login para lockout progressivo.
-- Funciona em serverless (estado no banco, não em memória).
-- =============================================================

create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  identifier text not null,          -- 'email:<email>' ou 'ip:<ip>'
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_login_attempts
  on login_attempts (identifier, created_at desc);

alter table login_attempts enable row level security;
-- Sem policies: acesso somente via service_role (servidor).

-- Limpeza automática opcional (rodar de vez em quando ou agendar com pg_cron):
--   delete from login_attempts where created_at < now() - interval '1 day';
