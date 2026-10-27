-- Minimal Supabase auth contracts for a disposable local PostgreSQL test.
-- Never run this bootstrap in an actual Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text unique);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
-- Supabase grants these roles default privileges on newly created objects.
-- The app schema must explicitly revoke them before granting its narrow API.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
