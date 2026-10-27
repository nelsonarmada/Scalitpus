do $$ begin
 if (select count(*) from public.payments where player_id='99999999-0000-0000-0000-000000000003')<>1 then raise exception 'Migration duplicated or lost opening balance'; end if;
 if not exists(select 1 from public.payments where player_id='99999999-0000-0000-0000-000000000003' and amount_cents=6000 and paid_on is null and kind='opening_balance') then raise exception 'Migration invented historical transfers or lost amount'; end if;
 if (select master_user_id from public.groups where id='99999999-0000-0000-0000-000000000002') is not null then raise exception 'Migration promoted an arbitrary administrator to Master'; end if;
end $$;
\echo 'Migration checks passed: balance preserved once, no invented transfer date, no automatic Master promotion.'
