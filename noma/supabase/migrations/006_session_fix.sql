-- =============================================================
-- NOMA CLUB — 006: conserta a resolução de sessão
--
-- PROBLEMA QUE ESTA MIGRATION RESOLVE
-- A migration 001 criou em profiles a policy:
--     create policy "read own profile" on profiles
--       for select using (auth.uid() = id);
-- Isso era do Supabase Auth, que foi abandonado na 005. Sem o
-- Supabase Auth, auth.uid() é SEMPRE NULL, então a policy nunca
-- libera linha nenhuma. Só o service_role (que ignora RLS) lia
-- profiles.
--
-- Efeito prático: o login validava a senha (verify_app_user é
-- SECURITY DEFINER e ignora RLS), mas logo depois o app lia
-- profiles numa query comum para montar a sessão -> 0 linhas ->
-- sessão inválida -> de volta para a tela de login, SEM erro.
--
-- Solução: a sessão passa a ser resolvida por uma função
-- SECURITY DEFINER (igual ao login), então o app não depende
-- mais de RLS/of service_role para reconhecer quem está logado.
-- =============================================================

-- 1) Remove a policy morta (dependia do Supabase Auth, já removido)
drop policy if exists "read own profile" on profiles;

-- 2) Resolve o usuário da sessão sem depender de RLS
create or replace function get_app_user(p_id uuid)
returns table (id uuid, username text, name text, role text, active boolean)
language sql
security definer
set search_path = public, extensions
as $$
  select p.id, p.username, p.name, p.role, p.active
  from profiles p
  where p.id = p_id
    and p.active = true
  limit 1;
$$;

-- 3) Permite que o app chame as funções de autenticação
grant execute on function get_app_user(uuid)              to anon, authenticated, service_role;
grant execute on function verify_app_user(text, text)     to anon, authenticated, service_role;
