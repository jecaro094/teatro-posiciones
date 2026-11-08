-- Pegar en Supabase → SQL Editor → Run. Es idempotente: se puede volver a ejecutar.
-- Todo el estado (elenco + escenas) vive en una sola fila JSON: es pequeño y mantiene storage.js simple.
-- Acceso: nadie lee ni escribe tablas directamente. Todo pasa por funciones que validan un token:
--   token 'viewer' (elenco): puede leer.   token 'admin': puede leer y escribir.

create table if not exists app_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null check (pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);

-- Guarda solo el sha256 (hex) de cada token. (Se llama admin_tokens por historia; contiene ambos roles.)
create table if not exists admin_tokens (
  token_hash text primary key
);
alter table admin_tokens add column if not exists role text not null default 'admin' check (role in ('admin','viewer'));

alter table app_state enable row level security;
alter table admin_tokens enable row level security;

-- Cierra la lectura directa (versión anterior la permitía).
drop policy if exists "lectura publica" on app_state;
revoke all on app_state from anon;
revoke all on admin_tokens from anon;

create or replace function token_role(p_token text) returns text
language sql security definer set search_path = public as $$
  select role from admin_tokens
  where token_hash = encode(sha256(convert_to(coalesce(p_token,''), 'utf8')), 'hex');
$$;

create or replace function is_admin(p_token text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce(token_role(p_token) = 'admin', false);
$$;

create or replace function get_state(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if token_role(p_token) is null then
    raise exception 'token no valido' using errcode = '42501';
  end if;
  return (select data from app_state where id = 1);
end;
$$;

create or replace function save_state(p_token text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(p_token) then
    raise exception 'token no valido' using errcode = '42501';
  end if;
  insert into app_state (id, data, updated_at) values (1, p_data, now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

-- token_role es interna: nadie la llama desde fuera.
revoke execute on function token_role(text) from public, anon;
grant usage on schema public to anon;
grant execute on function is_admin(text), get_state(text), save_state(text, jsonb) to anon;

-- Altas (solo hashes). Para revocar/cambiar: delete from admin_tokens where role = '...'; e inserta otro.
insert into admin_tokens (token_hash, role) values ('ced3b639dbd741b53fd4abb41354542bfc408a63d4fd7a0452d4de2e316ef69f', 'admin') on conflict (token_hash) do nothing;
insert into admin_tokens (token_hash, role) values ('f374a5cf39f44c76f1afe2ecf2ce7aa7cd96e45a2c0b77453281ba6a6f68b88d', 'viewer') on conflict (token_hash) do nothing;
