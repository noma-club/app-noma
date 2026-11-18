-- =============================================================
-- NOMA CLUB — 005: autenticação própria (usuário + senha)
--
-- Abandonamos o Supabase Auth (exigia e-mail e a API admin dava
-- "This endpoint requires a valid Bearer token"). O login agora é
-- por USUÁRIO + SENHA, guardados na própria tabela profiles.
-- A senha é hasheada com bcrypt (pgcrypto / função crypt).
-- A sessão é validada pela aplicação com cookie assinado (sem
-- chamada de rede por página -> acaba o logout aleatório).
-- =============================================================

create extension if not exists pgcrypto;

-- profiles deixa de depender de auth.users
alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();
alter table profiles add column if not exists username text;
alter table profiles add column if not exists password_hash text;

create unique index if not exists idx_profiles_username
  on profiles (username) where username is not null;

-- ---------- Funções de autenticação (rodam no banco com bcrypt) ----------

-- Verifica usuário+senha e devolve o perfil (ou nada)
create or replace function verify_app_user(p_username text, p_password text)
returns table (id uuid, name text, role text, active boolean)
language sql
security definer
set search_path = public, extensions
as $$
  select p.id, p.name, p.role, p.active
  from profiles p
  where p.username = lower(trim(p_username))
    and p.password_hash is not null
    and p.password_hash = crypt(p_password, p.password_hash)
    and p.active = true
  limit 1;
$$;

-- Cria um novo usuário (professor/dono). Lança USERNAME_TAKEN se já existe.
create or replace function create_app_user(p_username text, p_name text, p_role text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if exists (select 1 from profiles where username = lower(trim(p_username))) then
    raise exception 'USERNAME_TAKEN';
  end if;
  insert into profiles (name, role, username, password_hash, active)
  values (
    p_name,
    case when p_role = 'dono' then 'dono' else 'professor' end,
    lower(trim(p_username)),
    crypt(p_password, gen_salt('bf')),
    true
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Redefine a senha de um usuário
create or replace function set_app_user_password(p_id uuid, p_password text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update profiles set password_hash = crypt(p_password, gen_salt('bf')) where id = p_id;
$$;

-- ---------- Semente: garante um login de dono ----------
-- Dá usuário 'admin' / senha 'Noma@2026' ao primeiro dono existente
-- (ou cria um). TROQUE a senha no primeiro acesso, na aba Usuários.
do $$
begin
  if not exists (select 1 from profiles where username is not null) then
    if exists (select 1 from profiles where role = 'dono') then
      update profiles
        set username = 'admin',
            password_hash = crypt('Noma@2026', gen_salt('bf')),
            active = true
      where id = (select id from profiles where role = 'dono' order by created_at limit 1);
    else
      insert into profiles (name, role, username, password_hash)
      values ('Administrador', 'dono', 'admin', crypt('Noma@2026', gen_salt('bf')));
    end if;
  end if;
end $$;
