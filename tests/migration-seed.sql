insert into auth.users(id,email) values('99999999-0000-0000-0000-000000000001','legacy-admin@example.test');
insert into public.groups(id,name,invite_code) values('99999999-0000-0000-0000-000000000002','Grupo anterior','legacy-test-group');
insert into public.group_admins(group_id,user_id) values('99999999-0000-0000-0000-000000000002','99999999-0000-0000-0000-000000000001');
insert into public.players(id,group_id,name,token_hash,paid_total_cents,payments_migrated) values('99999999-0000-0000-0000-000000000003','99999999-0000-0000-0000-000000000002','Jogador anterior','migration-test-only-hash',6000,false);
