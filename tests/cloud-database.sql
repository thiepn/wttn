-- Disposable users and writes, always rolled back. Run against the canonical database.
begin;
select set_config('wttn.test_a',gen_random_uuid()::text,true),set_config('wttn.test_b',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('wttn.test_a')::uuid,current_setting('wttn.test_a')||'@wttn-test.invalid'),
 (current_setting('wttn.test_b')::uuid,current_setting('wttn.test_b')||'@wttn-test.invalid');
select set_config('request.jwt.claim.sub',current_setting('wttn.test_a'),true);
set local role authenticated;
do $$
declare snapshot text := '{"kind":"word-to-the-nations-full-backup","version":1,"economic":"{}","appearance":{"version":1,"placements":{}}}'; r jsonb; id uuid:=gen_random_uuid(); i integer;
begin
 if (public.wttn_read_save()->>'revision')::int<>0 then raise exception 'new account not empty'; end if;
 r:=public.wttn_write_save(snapshot,0,id);
 if r->>'status'<>'saved' or (r->>'revision')::int<>1 then raise exception 'initial write failed'; end if;
 if public.wttn_write_save(snapshot,0,id)->>'revision'<>'1' then raise exception 'retry not idempotent'; end if;
 if public.wttn_write_save(snapshot,0,gen_random_uuid())->>'status'<>'conflict' then raise exception 'stale write accepted'; end if;
 for i in 1..8 loop perform public.wttn_write_save(snapshot,i,gen_random_uuid(),true); end loop;
 if jsonb_array_length(public.wttn_save_history())<>5 then raise exception 'history not bounded'; end if;
 begin perform * from wttn_private.saves; raise exception 'direct table read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.wttn_write_save(repeat('x',2097153),9,gen_random_uuid()); raise exception 'oversized save allowed'; exception when others then if sqlerrm='oversized save allowed' then raise; end if; end;
 r:=public.wttn_delete_save(9,gen_random_uuid());
 if r->>'deleted'<>'true' or r->>'revision'<>'10' then raise exception 'delete failed'; end if;
 if jsonb_array_length(public.wttn_save_history())<>0 then raise exception 'deleted history retained'; end if;
 if public.wttn_write_save(snapshot,9,gen_random_uuid())->>'status'<>'conflict' then raise exception 'stale resurrection accepted'; end if;
 if public.wttn_write_save(snapshot,10,gen_random_uuid())->>'status'<>'deleted' then raise exception 'deleted save silently recreated'; end if;
 if public.wttn_write_save(snapshot,10,gen_random_uuid(),false,true)->>'status'<>'saved' then raise exception 'explicit reenable failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('wttn.test_b'),true);
set local role authenticated;
do $$ begin
 if public.wttn_read_save()->>'revision'<>'0' then raise exception 'account B read account A'; end if;
 if jsonb_array_length(public.wttn_save_history())<>0 then raise exception 'account B read history A'; end if;
end $$;
reset role;
delete from auth.users where id=current_setting('wttn.test_a')::uuid;
select set_config('request.jwt.claim.sub',current_setting('wttn.test_a'),true);
set local role authenticated;
do $$ begin
 begin perform public.wttn_read_save(); raise exception 'deleted identity accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.wttn_read_save(); raise exception 'anonymous read accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select jsonb_build_object('passed',true,'coverage',array['ownership','anonymous denial','direct table denial','idempotency','revision conflict','history cap','deletion tombstone','explicit reenable','deleted identity','payload limit','cascade deletion'], 'fixtures','rolled back') as verification;
rollback;
