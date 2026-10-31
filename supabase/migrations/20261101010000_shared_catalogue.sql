-- Private shared review store. Domain validation stays in Catalogue/ProjectEvidence.
-- The bounded snapshot transaction keeps publication, revocation and observations atomic.
create table public.catalogue_version (id integer primary key check (id=1), version bigint not null default 1);
insert into public.catalogue_version(id) values(1);
alter table public.catalogue_version enable row level security;
revoke all on public.catalogue_version from anon, authenticated;
grant select, update on public.catalogue_version to service_role;
create table public.catalogue_source (id text primary key, data text not null);
alter table public.catalogue_source enable row level security;
revoke all on public.catalogue_source from anon, authenticated;
grant select, insert, update, delete on public.catalogue_source to service_role;
create table public.catalogue_project (id text primary key, data text not null);
alter table public.catalogue_project enable row level security;
revoke all on public.catalogue_project from anon, authenticated;
grant select, insert, update, delete on public.catalogue_project to service_role;
create table public.catalogue_building (id text primary key, project_id text not null references public.catalogue_project(id), data text not null);
alter table public.catalogue_building enable row level security;
revoke all on public.catalogue_building from anon, authenticated;
grant select, insert, update, delete on public.catalogue_building to service_role;
create table public.catalogue_import_run (id text primary key, source_id text not null references public.catalogue_source(id), fingerprint text not null, created_at text not null, unique(source_id,fingerprint));
alter table public.catalogue_import_run enable row level security;
revoke all on public.catalogue_import_run from anon, authenticated;
grant select, insert, update, delete on public.catalogue_import_run to service_role;
create table public.catalogue_review_item (id text primary key, run_id text not null references public.catalogue_import_run(id), row_number integer not null, offer_id text, data text not null, errors text not null, status text not null default 'pending' check (status in ('pending','approved','rejected')), reviewer text, note text);
alter table public.catalogue_review_item enable row level security;
revoke all on public.catalogue_review_item from anon, authenticated;
grant select, insert, update, delete on public.catalogue_review_item to service_role;
create table public.catalogue_listing_offer (id text primary key, source_id text not null references public.catalogue_source(id), supplier_id text not null, data text not null, published integer not null check (published in (0,1)), review_id text not null references public.catalogue_review_item(id), unique(source_id,supplier_id));
alter table public.catalogue_listing_offer enable row level security;
revoke all on public.catalogue_listing_offer from anon, authenticated;
grant select, insert, update, delete on public.catalogue_listing_offer to service_role;
create table public.catalogue_listing_observation (id bigint primary key, offer_id text not null references public.catalogue_listing_offer(id), review_id text not null unique references public.catalogue_review_item(id), observed_at text not null, data text not null);
alter table public.catalogue_listing_observation enable row level security;
revoke all on public.catalogue_listing_observation from anon, authenticated;
grant select, insert, update, delete on public.catalogue_listing_observation to service_role;
create table public.catalogue_audit_event (id bigint primary key, action text not null, subject_id text not null, actor text not null, note text not null, created_at text not null);
alter table public.catalogue_audit_event enable row level security;
revoke all on public.catalogue_audit_event from anon, authenticated;
grant select, insert, update, delete on public.catalogue_audit_event to service_role;
create table public.catalogue_evidence_review (id text primary key, evidence_id text not null, source_id text not null references public.catalogue_source(id), fingerprint text not null unique, data text not null, status text not null check (status in ('pending','approved','rejected')), reviewer text, note text, created_at text not null);
alter table public.catalogue_evidence_review enable row level security;
revoke all on public.catalogue_evidence_review from anon, authenticated;
grant select, insert, update, delete on public.catalogue_evidence_review to service_role;
create table public.catalogue_project_evidence (id text primary key, source_id text not null references public.catalogue_source(id), data text not null, review_id text not null references public.catalogue_evidence_review(id), published integer not null check (published in (0,1)));
alter table public.catalogue_project_evidence enable row level security;
revoke all on public.catalogue_project_evidence from anon, authenticated;
grant select, insert, update, delete on public.catalogue_project_evidence to service_role;

create function public.load_catalogue() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('version',v.version,'tables',jsonb_build_object(
'source',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_source t),'[]'::jsonb),
'project',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_project t),'[]'::jsonb),
'building',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_building t),'[]'::jsonb),
'import_run',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_import_run t),'[]'::jsonb),
'review_item',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_review_item t),'[]'::jsonb),
'listing_offer',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_listing_offer t),'[]'::jsonb),
'listing_observation',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_listing_observation t),'[]'::jsonb),
'audit_event',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_audit_event t),'[]'::jsonb),
'evidence_review',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_evidence_review t),'[]'::jsonb),
'project_evidence',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.catalogue_project_evidence t),'[]'::jsonb)
)) from public.catalogue_version v where v.id=1;
$$;
create function public.commit_catalogue(p_expected_version bigint,p_tables jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare current_version bigint; table_name text;
begin
 select version into current_version from public.catalogue_version where id=1 for update;
 if current_version <> p_expected_version then return false; end if;
 if jsonb_typeof(p_tables) <> 'object' or octet_length(p_tables::text)>5000000
    or (select count(*) from jsonb_object_keys(p_tables))<>10 then raise exception 'Invalid catalogue snapshot'; end if;
 foreach table_name in array ARRAY['source','project','building','import_run','review_item','listing_offer','listing_observation','audit_event','evidence_review','project_evidence'] loop
  if jsonb_typeof(p_tables->table_name) is distinct from 'array' or jsonb_array_length(p_tables->table_name)>10000 then
   raise exception 'Invalid catalogue table';
  end if;
 end loop;
 delete from public.catalogue_project_evidence where id is not null;
 delete from public.catalogue_evidence_review where id is not null;
 delete from public.catalogue_audit_event where id is not null;
 delete from public.catalogue_listing_observation where id is not null;
 delete from public.catalogue_listing_offer where id is not null;
 delete from public.catalogue_review_item where id is not null;
 delete from public.catalogue_import_run where id is not null;
 delete from public.catalogue_building where id is not null;
 delete from public.catalogue_project where id is not null;
 delete from public.catalogue_source where id is not null;
 insert into public.catalogue_source select * from jsonb_populate_recordset(null::public.catalogue_source,p_tables->'source');
 insert into public.catalogue_project select * from jsonb_populate_recordset(null::public.catalogue_project,p_tables->'project');
 insert into public.catalogue_building select * from jsonb_populate_recordset(null::public.catalogue_building,p_tables->'building');
 insert into public.catalogue_import_run select * from jsonb_populate_recordset(null::public.catalogue_import_run,p_tables->'import_run');
 insert into public.catalogue_review_item select * from jsonb_populate_recordset(null::public.catalogue_review_item,p_tables->'review_item');
 insert into public.catalogue_listing_offer select * from jsonb_populate_recordset(null::public.catalogue_listing_offer,p_tables->'listing_offer');
 insert into public.catalogue_listing_observation select * from jsonb_populate_recordset(null::public.catalogue_listing_observation,p_tables->'listing_observation');
 insert into public.catalogue_audit_event select * from jsonb_populate_recordset(null::public.catalogue_audit_event,p_tables->'audit_event');
 insert into public.catalogue_evidence_review select * from jsonb_populate_recordset(null::public.catalogue_evidence_review,p_tables->'evidence_review');
 insert into public.catalogue_project_evidence select * from jsonb_populate_recordset(null::public.catalogue_project_evidence,p_tables->'project_evidence');
 update public.catalogue_version set version=version+1 where id=1;
 return true;
end;
$$;
revoke all on function public.load_catalogue() from public,anon,authenticated;
revoke all on function public.commit_catalogue(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.load_catalogue() to service_role;
grant execute on function public.commit_catalogue(bigint,jsonb) to service_role;
