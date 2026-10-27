begin;
create function pg_temp.assert_true(condition boolean,label text) returns void language plpgsql as $$ begin if condition is distinct from true then raise exception 'Assertion failed: %',label; end if; end; $$;
create function pg_temp.expect_error(statement text,fragment text) returns void language plpgsql as $$ begin begin execute statement; exception when others then if position(fragment in sqlerrm)>0 then return; end if; raise exception 'Unexpected error: %',sqlerrm; end; raise exception 'Expected failure: %',statement; end; $$;
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000001','master@example.test'),
('00000000-0000-0000-0000-000000000002','other@example.test'),
('00000000-0000-0000-0000-000000000003','admin@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.create_group('Scalitpus Test','Nelson A') as group_data \gset
select (:'group_data'::jsonb->>'invite_code') as code,(:'group_data'::jsonb->>'player_id') as target_id,(:'group_data'::jsonb->>'token') as target_token \gset
select (public.get_board(:'code')->'group'->>'id') as group_id \gset
select pg_temp.assert_true(public.group_role(:'group_id')='master','creator is Master');
select public.manage_group_admin(:'group_id','admin@example.test',true);
select public.create_game(:'group_id',now()+interval '7 days','Pavilhão',2,0,'Teste') as game_id \gset
select public.admin_add_player(:'code','Amigo Externo',true,'Nelson A') as external_data \gset
select (:'external_data'::jsonb->>'player_id') as external_id \gset
select public.join_group(:'code','Nelson B',false,null) as member_data \gset
select (:'member_data'::jsonb->>'player_id') as source_id,(:'member_data'::jsonb->>'token') as source_token \gset
select public.respond_to_game(:'source_token',:'game_id','yes');
select public.admin_respond_to_game(:'game_id',:'target_id','no');
select public.admin_respond_to_game(:'game_id',:'external_id','yes');
select public.record_payment(:'target_id',2000,current_date,'Parcela A') as payment_a \gset
select public.record_payment(:'target_id',4000,current_date,'Parcela B') as payment_b \gset
select public.record_payment(:'source_id',1000,current_date,'Parcela C') as payment_c \gset
select public.record_payment(:'source_id',500,current_date,'Duplicado') as void_id \gset
select public.void_payment(:'void_id','Parcela duplicada');
select public.record_expense(:'group_id',2500,current_date,'Aluguer do pavilhão') as expense_a \gset
select pg_temp.assert_true(jsonb_array_length(public.get_board(:'code')->'expenses')=1,'Master sees cash expenses');
select pg_temp.expect_error(format('select public.record_expense(%L,0,current_date,''Pavilhão'')',:'group_id'),'Valor inválido');
select pg_temp.expect_error(format('select public.record_expense(%L,100,current_date+1,''Pavilhão'')',:'group_id'),'Data de pagamento inválida');
select pg_temp.expect_error(format('select public.record_expense(%L,100,current_date,''x'')',:'group_id'),'descrição');

select pg_temp.assert_true((select (p->>'paid_total_cents')::integer=6000 from jsonb_array_elements(public.get_board(:'code')->'players') p where p->>'id'=:'target_id'),'total is sum of transfers');
select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date,''x'')',:'external_id'),'isentos');
select pg_temp.expect_error(format('select public.record_payment(%L,-1,current_date,''x'')',:'source_id'),'Valor inválido');
select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date+1,''x'')',:'source_id'),'Data de transferência inválida');
select pg_temp.expect_error(format('select public.void_payment(%L,''x'')',:'payment_a'),'motivo');
select pg_temp.expect_error(format('select public.void_payment(%L,''Duplicado'')',:'void_id'),'já está anulado');
select pg_temp.expect_error(format('select public.manage_group_admin(%L,''master@example.test'',false)',:'group_id'),'Master não pode');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true(public.get_board(:'code')->>'role'='user','anonymous invite has user role');
select pg_temp.assert_true(not(public.get_board(:'code') ? 'payments'),'public board omits payment history');
select pg_temp.assert_true(not(public.get_board(:'code') ? 'expenses'),'public board omits outgoing cash history');
select pg_temp.expect_error('select * from public.expenses','permission denied');
select pg_temp.expect_error(format('select public.record_expense(%L,1000,current_date,''Pavilhão'')',:'group_id'),'permission denied');
select pg_temp.expect_error(format('select public.void_expense(%L,''Duplicado'')',:'expense_a'),'permission denied');

select pg_temp.assert_true(not(public.get_board(:'code') ? 'staff'),'public board omits staff');
select pg_temp.assert_true(public.get_board(:'code')::text not like '%paid_total_cents%','public board omits all balances');
select pg_temp.assert_true(public.get_board(:'code')::text not like '%amount_cents%','public board omits transfer amounts');
select pg_temp.assert_true(public.get_board(:'code')::text not like '%token_hash%','token hashes stay private');
select pg_temp.expect_error('select * from public.payments','permission denied');
select pg_temp.expect_error('select * from public.players','permission denied');
select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date,''x'')',:'target_id'),'permission denied');
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'target_id'),'permission denied');
select public.respond_to_game(:'source_token',:'game_id','no');
select public.respond_to_game(:'source_token',:'game_id','yes');
select pg_temp.expect_error(format('select public.join_group(%L,''nelson b'',false,null)',:'code'),'já está no grupo');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.create_group('Other Team','Other Admin') as other_data \gset
select (:'other_data'::jsonb->>'player_id') as other_player \gset
select pg_temp.assert_true(not(public.get_board(:'code') ? 'payments'),'signed-in outsider cannot read payments');
select pg_temp.assert_true(not(public.get_board(:'code') ? 'expenses'),'outsider cannot read outgoing cash history');
select pg_temp.expect_error(format('select public.record_expense(%L,1000,current_date,''Pavilhão'')',:'group_id'),'Só os administradores');
select pg_temp.expect_error(format('select public.void_expense(%L,''Duplicado'')',:'expense_a'),'Só os administradores');

select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date,''x'')',:'target_id'),'Só os administradores');
select pg_temp.expect_error(format('select public.void_payment(%L,''Duplicado'')',:'payment_a'),'Só os administradores');
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'target_id'),'Só o Master');
select pg_temp.expect_error(format('select public.manage_group_admin(%L,''other@example.test'',true)',:'group_id'),'Só o Master');
select pg_temp.expect_error(format('select public.respond_to_game(''invalid-token'',%L,''yes'')',:'game_id'),'Acesso pessoal inválido');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true(public.group_role(:'group_id')='admin','delegated admin has admin role');
select pg_temp.assert_true(not (public.get_board(:'code')->>'can_merge')::boolean,'administrators cannot merge by default');
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'target_id'),'Só o Master');
select pg_temp.expect_error(format('select public.grant_merge_permission(%L,''admin@example.test'',true)',:'group_id'),'Só o Master');

select pg_temp.assert_true(public.get_board(:'code') ? 'payments','admin can read financial history');
select pg_temp.assert_true(public.get_board(:'code') ? 'expenses','admin sees expenses');
select public.record_expense(:'group_id',6000,current_date,'Outra despesa') as expense_b \gset
select pg_temp.expect_error(format('select public.void_expense(%L,''x'')',:'expense_b'),'motivo');
select public.void_expense(:'expense_b','Registo duplicado');
select pg_temp.expect_error(format('select public.void_expense(%L,''Duplicado'')',:'expense_b'),'já está anulado');
select pg_temp.assert_true((select sum((e->>'amount_cents')::integer)=2500 from jsonb_array_elements(public.get_board(:'code')->'expenses') e where e->>'voided_at' is null),'voided expenses excluded from spent total');
select pg_temp.assert_true(jsonb_array_length(public.get_board(:'code')->'expenses')=2,'expense audit retained');

select pg_temp.assert_true(not(public.get_board(:'code') ? 'staff'),'only Master reads staff emails');
select pg_temp.expect_error(format('select public.add_group_admin(%L,''other@example.test'')',:'group_id'),'Só o Master');
select pg_temp.expect_error(format('select public.manage_group_admin(%L,''other@example.test'',true)',:'group_id'),'Só o Master');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.grant_merge_permission(:'group_id','admin@example.test',true);
select pg_temp.expect_error(format('select public.grant_merge_permission(%L,''missing@example.test'',true)',:'group_id'),'Atribui primeiro');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((public.get_board(:'code')->>'can_merge')::boolean,'explicitly authorized administrator can merge');
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'other_player'),'mesmo grupo');
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'source_id'),'diferentes');
-- The game is full: moving the source's confirmed place must still succeed.

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.grant_merge_permission(:'group_id','admin@example.test',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error(format('select public.merge_players(%L,%L)',:'source_id',:'target_id'),'Só o Master');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.grant_merge_permission(:'group_id','admin@example.test',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select public.merge_players(:'source_id',:'target_id');
select pg_temp.assert_true((select (p->>'paid_total_cents')::integer=7000 from jsonb_array_elements(public.get_board(:'code')->'players') p where p->>'id'=:'target_id'),'merged total preserves distinct valid transfers');
select pg_temp.assert_true(jsonb_array_length(public.get_board(:'code')->'payments')=4,'all payments including void retained');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.get_board(:'code')->'players') p where p->>'id'=:'source_id'),'absorbed player not active');
select pg_temp.assert_true((select e->>'status'='yes' from jsonb_array_elements(public.get_board(:'code')->'entries') e where e->>'player_id'=:'target_id' and e->>'game_id'=:'game_id'),'presence wins over declined during merge');
select pg_temp.expect_error(format('select public.respond_to_game(%L,%L,''no'')',:'source_token',:'game_id'),'Acesso pessoal inválido');
select public.respond_to_game(:'target_token',:'game_id','no');
select public.respond_to_game(:'target_token',:'game_id','yes');
select public.record_payment(:'target_id',250,current_date,'Após fusão');
select public.void_payment(:'payment_c','Duplicação identificada após fusão');
select pg_temp.assert_true((select (p->>'paid_total_cents')::integer=6250 from jsonb_array_elements(public.get_board(:'code')->'players') p where p->>'id'=:'target_id'),'post-merge payments and voiding use surviving player');
select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date,''x'')',:'source_id'),'já fundido');
select pg_temp.expect_error(format('select public.set_player_paid_total(%L,0)',:'target_id'),'permission denied');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.manage_group_admin(:'group_id','admin@example.test',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true(public.group_role(:'group_id')='user','Master can revoke administrator');
select pg_temp.assert_true(not(public.get_board(:'code') ? 'payments'),'revocation immediately removes financial reads');
select pg_temp.expect_error(format('select public.record_payment(%L,1000,current_date,''x'')',:'target_id'),'Só os administradores');
reset role;
select pg_temp.assert_true((select merged_into=:'target_id'::uuid from public.players where id=:'source_id'),'absorbed record archived, not deleted');
select pg_temp.assert_true((select count(*)=1 from public.player_merges where source_id=:'source_id'),'merge audited');
update public.games set starts_at=now()-interval '1 day' where id=:'game_id';
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error(format('select public.respond_to_game(%L,%L,''no'')',:'target_token',:'game_id'),'já começou');
\echo 'Database checks passed: Master/admin/user permissions, financial privacy, instalments, voids, cross-group isolation, full-game merge, history preservation and access revocation.'
rollback;
