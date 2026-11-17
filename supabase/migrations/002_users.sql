-- =============================================================
-- NOMA CLUB — 002: gerenciamento de usuários
-- Donos gerenciam professores e alunos pelo app.
--   * profiles.active: desativar professor sem apagar histórico
--     (aulas antigas continuam apontando para ele)
-- =============================================================

alter table profiles
  add column if not exists active boolean not null default true;

-- Gera um novo link de acesso para o aluno (invalida o anterior)
create or replace function rotate_client_token(p_client_id uuid)
returns void
language sql
security definer
as $$
  update clients
  set access_token = encode(gen_random_bytes(16), 'hex')
  where id = p_client_id;
$$;
