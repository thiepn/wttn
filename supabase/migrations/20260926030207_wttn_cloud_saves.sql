-- No economic formula or account authority is changed by this migration.
create schema if not exists wttn_private;
revoke all on schema wttn_private from public, anon;
grant usage on schema wttn_private to authenticated;

create table wttn_private.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  snapshot text check (octet_length(snapshot) <= 2097152),
  deleted boolean not null default false,
  request_id uuid,
  updated_at timestamptz not null default now(),
  check (not deleted or snapshot is null)
);
create table wttn_private.history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  snapshot text not null check (octet_length(snapshot) <= 2097152),
  saved_at timestamptz not null default now(),
  primary key (user_id, revision)
);
alter table wttn_private.saves enable row level security;
alter table wttn_private.history enable row level security;
create policy own_save on wttn_private.saves to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_history on wttn_private.history to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Direct writes are deliberately unavailable: every command must check its revision.
revoke all on wttn_private.saves, wttn_private.history from public, anon, authenticated;

create function wttn_private.command(p_action text, p_snapshot text default null, p_revision bigint default null,
 p_request_id uuid default null, p_checkpoint boolean default false, p_restore boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); row_save wttn_private.saves; payload jsonb; result jsonb;
begin
 -- Also rejects an unexpired JWT whose account has since been deleted.
 if uid is null or not exists(select 1 from auth.users where id=uid) then
   raise exception 'Authentication required' using errcode='28000';
 end if;
 if p_action not in ('read','write','delete','history') then raise exception 'Invalid action'; end if;
 if p_action='history' then
   return coalesce((select jsonb_agg(jsonb_build_object('revision',h.revision,'snapshot',h.snapshot,'savedAt',h.saved_at) order by h.revision desc) from wttn_private.history h where h.user_id=uid),'[]'::jsonb);
 end if;
 -- Serializes initial insertion, writes and deletion, including a currently absent row.
 perform pg_advisory_xact_lock(hashtextextended('wttn:' || uid::text,0));
 select * into row_save from wttn_private.saves where user_id=uid for update;
 if not found then row_save.revision:=0; row_save.deleted:=false; end if;
 result:=jsonb_build_object('revision',row_save.revision,'snapshot',row_save.snapshot,'deleted',row_save.deleted,'requestId',row_save.request_id,'updatedAt',row_save.updated_at);
 if p_action='read' then return result; end if;
 if p_request_id is null or p_revision is null or p_revision < 0 then raise exception 'Revision and request ID required'; end if;
 if p_request_id=row_save.request_id then
   return result || jsonb_build_object('status',case when row_save.deleted then 'deleted' else 'saved' end);
 end if;
 if p_revision <> row_save.revision then return result || '{"status":"conflict"}'::jsonb; end if;
 if p_action='write' then
   if row_save.deleted and not coalesce(p_restore,false) then return result || '{"status":"deleted"}'::jsonb; end if;
   if p_snapshot is null or octet_length(p_snapshot)>2097152 then raise exception 'Snapshot size invalid'; end if;
   payload:=p_snapshot::jsonb;
   if payload->>'kind' is distinct from 'word-to-the-nations-full-backup' or payload->>'version' is distinct from '1'
     or jsonb_typeof(payload->'economic') is distinct from 'string' or payload->'appearance'->>'version' is distinct from '1'
     or jsonb_typeof(payload->'appearance'->'placements') is distinct from 'object' then raise exception 'Snapshot format invalid'; end if;
   if coalesce(p_checkpoint,false) and row_save.snapshot is not null then
     insert into wttn_private.history(user_id,revision,snapshot) values(uid,row_save.revision,row_save.snapshot) on conflict do nothing;
     delete from wttn_private.history h where h.user_id=uid and h.revision not in
       (select revision from wttn_private.history where user_id=uid order by revision desc limit 5);
   end if;
 else
   -- Keep the revision tombstone; stale clients cannot recreate erased data.
   p_snapshot:=null;
   delete from wttn_private.history where user_id=uid;
 end if;
 insert into wttn_private.saves(user_id,revision,snapshot,deleted,request_id,updated_at)
 values(uid,row_save.revision+1,p_snapshot,p_action='delete',p_request_id,now())
 on conflict(user_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,
 deleted=excluded.deleted,request_id=excluded.request_id,updated_at=excluded.updated_at
 returning * into row_save;
 insert into public.account_user_apps(user_id,app_slug,source) values(uid,'wttn','app')
 on conflict(user_id,app_slug) do update set last_used_at=now();
 return jsonb_build_object('status',case when row_save.deleted then 'deleted' else 'saved' end,
 'revision',row_save.revision,'snapshot',row_save.snapshot,'deleted',row_save.deleted,'requestId',row_save.request_id,'updatedAt',row_save.updated_at);
end;
$$;
revoke all on function wttn_private.command(text,text,bigint,uuid,boolean,boolean) from public,anon;
grant execute on function wttn_private.command(text,text,bigint,uuid,boolean,boolean) to authenticated;

-- Exposed wrappers run as the caller; privileged code stays in an unexposed schema.
create function public.wttn_read_save() returns jsonb language sql security invoker set search_path='' as $$ select wttn_private.command('read'); $$;
create function public.wttn_save_history() returns jsonb language sql security invoker set search_path='' as $$ select wttn_private.command('history'); $$;
create function public.wttn_write_save(p_snapshot text,p_revision bigint,p_request_id uuid,p_checkpoint boolean default false,p_restore boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select wttn_private.command('write',p_snapshot,p_revision,p_request_id,p_checkpoint,p_restore); $$;
create function public.wttn_delete_save(p_revision bigint,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select wttn_private.command('delete',null,p_revision,p_request_id); $$;
revoke all on function public.wttn_read_save(),public.wttn_save_history(),public.wttn_write_save(text,bigint,uuid,boolean,boolean),public.wttn_delete_save(bigint,uuid) from public,anon;
grant execute on function public.wttn_read_save(),public.wttn_save_history(),public.wttn_write_save(text,bigint,uuid,boolean,boolean),public.wttn_delete_save(bigint,uuid) to authenticated;

insert into public.account_apps(slug,name,description,path,active,sort_order)
values('wttn','Word to the Nations','A local-first Scripture settlement with optional cloud saves.','/wttn/',true,100)
on conflict(slug) do update set name=excluded.name,description=excluded.description,path=excluded.path;
insert into public.account_app_manifests(app_slug,manifest_version,identity_scope,data_scope,export_scope,capabilities)
values('wttn',1,'shared','isolated','app-owned','{"account":true,"identity":true,"app_data":true,"export_data":true,"delete_account":true,"delete_app_data":true,"cloud_saves":true}'::jsonb)
on conflict(app_slug) do update set manifest_version=excluded.manifest_version,identity_scope=excluded.identity_scope,data_scope=excluded.data_scope,export_scope=excluded.export_scope,capabilities=excluded.capabilities;
