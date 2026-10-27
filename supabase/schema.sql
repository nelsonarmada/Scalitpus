-- Run in the Supabase SQL editor. Safe to re-run; existing data is preserved.
begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  invite_code text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);
create table if not exists public.group_admins (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 60),
  external boolean not null default false,
  invited_by text check (char_length(invited_by) <= 60),
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
-- Cumulative amount per player, independent of attendance and game fees.
-- Existing data starts at zero; legacy per-game flags are never converted
-- into money because they do not establish an actual amount received.
alter table public.players add column if not exists paid_total_cents integer not null default 0 check (paid_total_cents between 0 and 100000000);
create unique index if not exists players_group_name on public.players (group_id, lower(trim(name)));
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  starts_at timestamptz not null,
  location text not null check (char_length(trim(location)) between 2 and 120),
  capacity integer not null default 14 check (capacity between 2 and 100),
  fee_cents integer not null default 500 check (fee_cents between 0 and 50000),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists games_group_date on public.games(group_id, starts_at);
create table if not exists public.attendance (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'yes', 'no')),
  paid boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

alter table public.group_admins add column if not exists can_merge boolean not null default false;
alter table public.groups add column if not exists master_user_id uuid references auth.users(id);
alter table public.players add column if not exists merged_into uuid references public.players(id);
alter table public.players add column if not exists payments_migrated boolean not null default false;
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.groups(id),
 player_id uuid not null references public.players(id),
 original_player_id uuid not null references public.players(id),
 amount_cents integer not null check(amount_cents between 1 and 100000000),
 paid_on date,
 kind text not null default 'transfer' check(kind in ('transfer','opening_balance')),
 note text not null default '' check(char_length(note)<=250),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 voided_at timestamptz,
 voided_by uuid references auth.users(id),
 void_reason text not null default '' check(char_length(void_reason)<=250),
 check((kind='transfer' and paid_on is not null) or (kind='opening_balance' and paid_on is null))
);
create index if not exists payments_group_player on public.payments(group_id,player_id);
-- Outgoing cash movements are independent of player contributions.
create table if not exists public.expenses (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.groups(id),
 amount_cents integer not null check(amount_cents between 1 and 100000000),
 paid_on date not null,
 description text not null check(char_length(trim(description)) between 3 and 250),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 voided_at timestamptz,
 voided_by uuid references auth.users(id),
 void_reason text not null default '' check(char_length(void_reason)<=250)
);
create index if not exists expenses_group_date on public.expenses(group_id,paid_on);
alter table public.expenses enable row level security;
revoke all on public.expenses from public,anon,authenticated;
create table if not exists public.player_merges (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.groups(id),
 source_id uuid not null references public.players(id),
 target_id uuid not null references public.players(id),
 performed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
-- Preserve old manually entered totals as explicit opening balances, without
-- inventing historic transfer dates or instalments. This runs only once.
insert into public.payments(group_id,player_id,original_player_id,amount_cents,kind,note)
select group_id,id,id,paid_total_cents,'opening_balance','Saldo anterior — parcelas originais indisponíveis'
from public.players where not payments_migrated and paid_total_cents>0;
update public.players set payments_migrated=true where not payments_migrated;
alter table public.players alter column payments_migrated set default true;
alter table public.payments enable row level security;
alter table public.player_merges enable row level security;
revoke all on public.payments,public.player_merges from public,anon,authenticated;

-- No client has direct access to tables, including player access-token hashes.
-- Every supported operation goes through an explicitly granted function below.
alter table public.groups enable row level security;
alter table public.group_admins enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.attendance enable row level security;
revoke all on public.groups, public.group_admins, public.players, public.games, public.attendance from public, anon, authenticated;

create or replace function public.group_role(p_group_id uuid)
returns text language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from public.groups where id=p_group_id and master_user_id=auth.uid()) then 'master'
 when exists(select 1 from public.group_admins where group_id=p_group_id and user_id=auth.uid()) then 'admin' else 'user' end;
$$;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.group_role(p_group_id) in ('master','admin');
$$;

create or replace function public.can_merge_players(p_group_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.group_role(p_group_id)='master' or exists(select 1 from public.group_admins where group_id=p_group_id and user_id=auth.uid() and can_merge);
$$;

-- Serialize registration on each game's row. The capacity cannot be exceeded,
-- even when multiple players respond simultaneously. Never mix two groups.
create or replace function public.validate_attendance()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.games; p public.players;
begin
  select * into g from public.games where id = new.game_id for update;
  select * into p from public.players where id = new.player_id;
  if g.id is null or p.id is null or p.merged_into is not null or g.group_id <> p.group_id then
    raise exception 'Este jogador não pertence ao grupo do jogo.';
  end if;
  if p.external and new.paid then raise exception 'Os jogadores externos estão isentos.'; end if;
  if new.status = 'yes' and (tg_op = 'INSERT' or old.status <> 'yes') then
    if (select count(*) from public.attendance where game_id = g.id and status = 'yes' and player_id <> new.player_id) >= g.capacity then
      raise exception 'O jogo já está completo. Contacta um administrador.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists attendance_checks on public.attendance;
create trigger attendance_checks before insert or update on public.attendance for each row execute function public.validate_attendance();

create or replace function public.get_board(p_code text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g public.groups; result jsonb; role_name text;
begin
 select * into g from public.groups where invite_code=p_code;
 if g.id is null then raise exception 'Link inválido. Pede o link atual a um administrador.'; end if;
 role_name:=public.group_role(g.id);
 result:=jsonb_build_object(
  'role',role_name,
  'can_merge',public.can_merge_players(g.id),
  'group',jsonb_build_object('id',g.id,'name',g.name,'invite_code',g.invite_code),
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'external',p.external,'invited_by',p.invited_by,'created_at',p.created_at) || case when role_name in ('master','admin') then jsonb_build_object('paid_total_cents',coalesce((select sum(amount_cents) from public.payments where player_id=p.id and voided_at is null),0)) else '{}'::jsonb end order by p.created_at,p.id) from public.players p where group_id=g.id and merged_into is null),'[]'::jsonb),
  'games',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'starts_at',x.starts_at,'location',x.location,'capacity',x.capacity,'note',x.note,'created_at',x.created_at) order by x.starts_at) from public.games x where group_id=g.id),'[]'::jsonb),
  'entries',coalesce((select jsonb_agg(jsonb_build_object('game_id',a.game_id,'player_id',a.player_id,'status',a.status)) from public.attendance a join public.games x on x.id=a.game_id where x.group_id=g.id),'[]'::jsonb)
 );
 if role_name in ('master','admin') then
  result:=result||jsonb_build_object('payments',coalesce((select jsonb_agg(jsonb_build_object('id',pay.id,'player_id',pay.player_id,'amount_cents',pay.amount_cents,'paid_on',pay.paid_on,'kind',pay.kind,'note',pay.note,'created_at',pay.created_at,'recorded_by',coalesce(split_part(u.email,'@',1),'Migração'),'voided_at',pay.voided_at,'void_reason',pay.void_reason,'original_player_name',origin.name) order by pay.created_at desc,pay.id) from public.payments pay left join auth.users u on u.id=pay.created_by join public.players origin on origin.id=pay.original_player_id where pay.group_id=g.id),'[]'::jsonb));
 end if;
 if role_name in ('master','admin') then
  result:=result||jsonb_build_object('expenses',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'amount_cents',e.amount_cents,'paid_on',e.paid_on,'description',e.description,'created_at',e.created_at,'recorded_by',split_part(u.email,'@',1),'voided_at',e.voided_at,'void_reason',e.void_reason) order by e.paid_on desc,e.created_at desc,e.id) from public.expenses e join auth.users u on u.id=e.created_by where e.group_id=g.id),'[]'::jsonb));
 end if;
 if role_name='master' then
  result:=result||jsonb_build_object('staff',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'role',case when u.id=g.master_user_id then 'master' else 'admin' end,'can_merge',public.can_merge_players(g.id) and u.id=g.master_user_id or exists(select 1 from public.group_admins a where a.group_id=g.id and a.user_id=u.id and a.can_merge))) from auth.users u where u.id=g.master_user_id or exists(select 1 from public.group_admins a where a.group_id=g.id and a.user_id=u.id)),'[]'::jsonb));
 end if;
 return result;
end;
$$;

create or replace function public.my_group_code()
returns text language sql stable security definer set search_path = '' as $$
  select g.invite_code from public.groups g where public.is_group_admin(g.id) order by g.created_at limit 1;
$$;

create or replace function public.create_group(p_name text, p_player_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.groups; p_id uuid; token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if auth.uid() is null then raise exception 'Inicia sessão para criar um grupo.'; end if;
  insert into public.groups(name,master_user_id) values (trim(p_name),auth.uid()) returning * into g;
  insert into public.group_admins(group_id, user_id) values (g.id, auth.uid());
  insert into public.players(group_id, name, token_hash) values (g.id, trim(p_player_name), encode(extensions.digest(token, 'sha256'), 'hex')) returning id into p_id;
  return jsonb_build_object('invite_code', g.invite_code, 'player_id', p_id, 'token', token);
end;
$$;

create or replace function public.join_group(p_code text, p_name text, p_external boolean default false, p_invited_by text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g_id uuid; p_id uuid; token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into g_id from public.groups where invite_code = p_code;
  if g_id is null then raise exception 'Link de grupo inválido.'; end if;
  if p_external then raise exception 'Pede a um administrador para te adicionar como externo.'; end if;
  insert into public.players(group_id, name, external, invited_by, token_hash)
  values (g_id, trim(p_name), false, p_invited_by, encode(extensions.digest(token, 'sha256'), 'hex')) returning id into p_id;
  return jsonb_build_object('player_id', p_id, 'token', token);
exception when unique_violation then
  raise exception 'Esse nome já está no grupo. Pede um acesso pessoal a um administrador.';
end;
$$;

create or replace function public.admin_add_player(p_code text, p_name text, p_external boolean default false, p_invited_by text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g_id uuid; p_id uuid; token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select id into g_id from public.groups where invite_code = p_code;
  if not public.is_group_admin(g_id) then raise exception 'Apenas os administradores podem adicionar jogadores.'; end if;
  insert into public.players(group_id, name, external, invited_by, token_hash)
  values (g_id, trim(p_name), p_external, p_invited_by, encode(extensions.digest(token, 'sha256'), 'hex')) returning id into p_id;
  return jsonb_build_object('player_id', p_id, 'token', token);
exception when unique_violation then raise exception 'Já existe um jogador com esse nome no grupo.';
end;
$$;

create or replace function public.respond_to_game(p_token text, p_game_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.players; g public.games;
begin
  select * into g from public.games where id = p_game_id for update;
  select * into p from public.players where merged_into is null and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if p.id is null or g.id is null or p.group_id <> g.group_id then raise exception 'Acesso pessoal inválido. Pede um novo link ao administrador.'; end if;
  if g.starts_at <= now() then raise exception 'Este jogo já começou.'; end if;
  insert into public.attendance(game_id, player_id, status) values (p_game_id, p.id, p_status)
  on conflict (game_id, player_id) do update set status = excluded.status;
end;
$$;

create or replace function public.admin_respond_to_game(p_game_id uuid, p_player_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare g_id uuid;
begin
  select group_id into g_id from public.games where id = p_game_id for update;
  if not public.is_group_admin(g_id) then raise exception 'Só os administradores podem responder por outro jogador.'; end if;
  insert into public.attendance(game_id, player_id, status) values (p_game_id, p_player_id, p_status)
  on conflict (game_id, player_id) do update set status = excluded.status;
end;
$$;

create or replace function public.set_payment(p_game_id uuid, p_player_id uuid, p_paid boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare g_id uuid;
begin
  select group_id into g_id from public.games where id = p_game_id;
  if not public.is_group_admin(g_id) then raise exception 'Só os administradores podem registar pagamentos.'; end if;
  update public.attendance set paid = p_paid where game_id = p_game_id and player_id = p_player_id and status = 'yes';
  if not found then raise exception 'Confirma a presença antes de registar o pagamento.'; end if;
end;
$$;

create or replace function public.create_game(p_group_id uuid, p_starts_at timestamptz, p_location text, p_capacity integer, p_fee_cents integer, p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare g_id uuid;
begin
  if not public.is_group_admin(p_group_id) then raise exception 'Só os administradores podem criar jogos.'; end if;
  if p_starts_at <= now() then raise exception 'Escolhe uma data futura.'; end if;
  insert into public.games(group_id, starts_at, location, capacity, fee_cents, note)
  values (p_group_id, p_starts_at, trim(p_location), p_capacity, p_fee_cents, trim(p_note)) returning id into g_id;
  return g_id;
end;
$$;

create or replace function public.rotate_player_token(p_player_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare g_id uuid; token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select group_id into g_id from public.players where id = p_player_id and merged_into is null;
  if not public.is_group_admin(g_id) then raise exception 'Só os administradores podem gerar acessos pessoais.'; end if;
  update public.players set token_hash = encode(extensions.digest(token, 'sha256'), 'hex') where id = p_player_id;
  return token;
end;
$$;

create or replace function public.add_group_admin(p_group_id uuid, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare target_id uuid;
begin
  if public.group_role(p_group_id)<>'master' then raise exception 'Só o Master pode atribuir permissões.'; end if;
  select id into target_id from auth.users where lower(email) = lower(trim(p_email));
  if target_id is null then raise exception 'Essa pessoa deve iniciar sessão neste site primeiro.'; end if;
  insert into public.group_admins(group_id, user_id) values (p_group_id, target_id) on conflict do nothing;
end;
$$;

create or replace function public.set_player_paid_total(p_player_id uuid, p_total_cents integer)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.players;
begin
  select * into p from public.players where id = p_player_id for update;
  if not public.is_group_admin(p.group_id) then raise exception 'Só os administradores podem alterar valores pagos.'; end if;
  if p.external then raise exception 'Os jogadores externos estão isentos.'; end if;
  if p_total_cents is null or p_total_cents < 0 or p_total_cents > 100000000 then raise exception 'Valor pago inválido.'; end if;
  update public.players set paid_total_cents = p_total_cents where id = p_player_id;
end;
$$;


create or replace function public.record_payment(p_player_id uuid,p_amount_cents integer,p_paid_on date,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.players; payment_id uuid;
begin
 select * into p from public.players where id=p_player_id for update;
 if not public.is_group_admin(p.group_id) then raise exception 'Só os administradores podem registar pagamentos.'; end if;
 if p.id is null or p.merged_into is not null then raise exception 'Jogador inválido ou já fundido.'; end if;
 if p.external then raise exception 'Os jogadores externos estão isentos.'; end if;
 if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>100000000 or coalesce((select sum(amount_cents) from public.payments where player_id=p.id and voided_at is null),0)+p_amount_cents>100000000 then raise exception 'Valor inválido.'; end if;
 if p_paid_on is null or p_paid_on<date '1900-01-01' or p_paid_on>(now() at time zone 'Europe/Lisbon')::date then raise exception 'Data de transferência inválida.'; end if;
 insert into public.payments(group_id,player_id,original_player_id,amount_cents,paid_on,note,created_by)
 values(p.group_id,p.id,p.id,p_amount_cents,p_paid_on,trim(p_note),auth.uid()) returning id into payment_id;
 return payment_id;
end;
$$;
create or replace function public.void_payment(p_payment_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare pay public.payments; locked_id uuid;
begin
 select * into pay from public.payments where id=p_payment_id;
 if not public.is_group_admin(pay.group_id) then raise exception 'Só os administradores podem anular pagamentos.'; end if;
 select id into locked_id from public.players where id=pay.player_id for update;
 select * into pay from public.payments where id=p_payment_id for update;
 if pay.player_id<>locked_id then raise exception 'A ficha foi fundida. Atualiza e tenta novamente.'; end if;
 if pay.voided_at is not null then raise exception 'Este pagamento já está anulado.'; end if;
 if p_reason is null or char_length(trim(p_reason))<3 or char_length(p_reason)>250 then raise exception 'Indica o motivo da anulação.'; end if;
 update public.payments set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason) where id=p_payment_id;
end;
$$;
create or replace function public.record_expense(p_group_id uuid,p_amount_cents integer,p_paid_on date,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare expense_id uuid;
begin
 if not public.is_group_admin(p_group_id) then raise exception 'Só os administradores podem registar saídas da caixa.'; end if;
 if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>100000000 then raise exception 'Valor inválido.'; end if;
 if p_paid_on is null or p_paid_on<date '1900-01-01' or p_paid_on>(now() at time zone 'Europe/Lisbon')::date then raise exception 'Data de pagamento inválida.'; end if;
 if p_description is null or char_length(trim(p_description)) not between 3 and 250 then raise exception 'Indica uma descrição entre 3 e 250 caracteres.'; end if;
 insert into public.expenses(group_id,amount_cents,paid_on,description,created_by) values(p_group_id,p_amount_cents,p_paid_on,trim(p_description),auth.uid()) returning id into expense_id;
 return expense_id;
end;
$$;
create or replace function public.void_expense(p_expense_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare expense public.expenses;
begin
 select * into expense from public.expenses where id=p_expense_id for update;
 if not public.is_group_admin(expense.group_id) then raise exception 'Só os administradores podem anular saídas da caixa.'; end if;
 if expense.voided_at is not null then raise exception 'Este pagamento já está anulado.'; end if;
 if p_reason is null or char_length(trim(p_reason))<3 or char_length(p_reason)>250 then raise exception 'Indica o motivo da anulação.'; end if;
 update public.expenses set voided_at=now(),voided_by=auth.uid(),void_reason=trim(p_reason) where id=p_expense_id;
end;
$$;

create or replace function public.manage_group_admin(p_group_id uuid,p_email text,p_admin boolean)
returns void language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if public.group_role(p_group_id)<>'master' then raise exception 'Só o Master pode atribuir permissões.'; end if;
 select id into target_id from auth.users where lower(email)=lower(trim(p_email));
 if target_id is null then raise exception 'Essa pessoa deve iniciar sessão neste site primeiro.'; end if;
 if exists(select 1 from public.groups where id=p_group_id and master_user_id=target_id) then raise exception 'O Master não pode ser despromovido por esta operação.'; end if;
 if p_admin then insert into public.group_admins(group_id,user_id) values(p_group_id,target_id) on conflict do nothing;
 else delete from public.group_admins where group_id=p_group_id and user_id=target_id; end if;
end;
$$;
create or replace function public.grant_merge_permission(p_group_id uuid,p_email text,p_allowed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if public.group_role(p_group_id)<>'master' then raise exception 'Só o Master pode atribuir a permissão de fusão.'; end if;
 if p_allowed is null then raise exception 'Permissão inválida.'; end if;
 select id into target_id from auth.users where lower(email)=lower(trim(p_email));
 update public.group_admins set can_merge=p_allowed where group_id=p_group_id and user_id=target_id;
 if not found then raise exception 'Atribui primeiro o nível de administrador a essa pessoa.'; end if;
end;
$$;

create or replace function public.merge_players(p_source_id uuid,p_target_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare src public.players; dst public.players; source_entries jsonb; item jsonb; g_id uuid;
begin
 if p_source_id=p_target_id then raise exception 'Seleciona duas fichas diferentes.'; end if;
 select group_id into g_id from public.players where id=p_source_id;
 if not public.can_merge_players(g_id) then raise exception 'Só o Master ou administradores autorizados podem fundir jogadores.'; end if;
 -- All attendance writers lock games before inspecting players. Use that same
 -- order; serialize simultaneous merges through the group row.
 perform id from public.groups where id=g_id for update;
 perform id from public.games where group_id=g_id order by id for update;
 perform id from public.players where id in(p_source_id,p_target_id) order by id for update;
 select * into src from public.players where id=p_source_id;
 select * into dst from public.players where id=p_target_id;
 if src.id is null or dst.id is null or src.group_id<>dst.group_id or src.merged_into is not null or dst.merged_into is not null then raise exception 'As fichas devem estar ativas e pertencer ao mesmo grupo.'; end if;
 if coalesce((select sum(amount_cents) from public.payments where player_id in(src.id,dst.id) and voided_at is null),0)>100000000 then raise exception 'O total resultante ultrapassa o limite.'; end if;
 update public.players set external=src.external and dst.external where id=dst.id;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into source_entries from public.attendance a where player_id=src.id;
 delete from public.attendance where player_id=src.id;
 for item in select value from jsonb_array_elements(source_entries) loop
   insert into public.attendance(game_id,player_id,status,paid)
   values((item->>'game_id')::uuid,dst.id,item->>'status',(item->>'paid')::boolean)
   on conflict(game_id,player_id) do update set
    status=case when public.attendance.status='yes' or excluded.status='yes' then 'yes' when public.attendance.status='no' or excluded.status='no' then 'no' else 'pending' end,
    paid=public.attendance.paid or excluded.paid;
 end loop;

 update public.payments set player_id=dst.id where player_id=src.id;
 update public.players set merged_into=dst.id,token_hash=encode(extensions.gen_random_bytes(32),'hex') where id=src.id;
 insert into public.player_merges(group_id,source_id,target_id,performed_by) values(g_id,src.id,dst.id,auth.uid());
 return dst.id;
end;
$$;

revoke all on function public.is_group_admin(uuid), public.validate_attendance(), public.get_board(text), public.my_group_code(), public.create_group(text,text), public.join_group(text,text,boolean,text), public.admin_add_player(text,text,boolean,text), public.respond_to_game(text,uuid,text), public.admin_respond_to_game(uuid,uuid,text), public.set_payment(uuid,uuid,boolean), public.create_game(uuid,timestamptz,text,integer,integer,text), public.rotate_player_token(uuid), public.add_group_admin(uuid,text), public.set_player_paid_total(uuid,integer) from public, anon, authenticated;
grant execute on function public.is_group_admin(uuid), public.get_board(text), public.join_group(text,text,boolean,text), public.respond_to_game(text,uuid,text) to anon, authenticated;
grant execute on function public.my_group_code(), public.create_group(text,text), public.admin_add_player(text,text,boolean,text), public.admin_respond_to_game(uuid,uuid,text), public.create_game(uuid,timestamptz,text,integer,integer,text), public.rotate_player_token(uuid), public.add_group_admin(uuid,text) to authenticated;

revoke all on function public.group_role(uuid),public.record_payment(uuid,integer,date,text),public.void_payment(uuid,text),public.manage_group_admin(uuid,text,boolean),public.merge_players(uuid,uuid) from public,anon,authenticated;
grant execute on function public.group_role(uuid) to anon,authenticated;
grant execute on function public.record_payment(uuid,integer,date,text),public.void_payment(uuid,text),public.manage_group_admin(uuid,text,boolean),public.merge_players(uuid,uuid) to authenticated;
revoke all on function public.can_merge_players(uuid),public.grant_merge_permission(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.grant_merge_permission(uuid,text,boolean) to authenticated;
revoke all on function public.record_expense(uuid,integer,date,text),public.void_expense(uuid,text) from public,anon,authenticated;
grant execute on function public.record_expense(uuid,integer,date,text),public.void_expense(uuid,text) to authenticated;
commit;
