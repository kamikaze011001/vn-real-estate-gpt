begin;
select plan(27);

update public.collection_sources set scheduled=true,failure_count=0,retry_after=null,last_success_at=null;

create function pg_temp.finish_source_case(outcome text,states jsonb,attempted jsonb,diagnostics jsonb default '{}')
returns integer language plpgsql as $$
declare lease uuid;
begin
 lease:=public.claim_daily_run(gen_random_uuid()::text);
 return public.finish_daily_run(lease,'[]',outcome,jsonb_build_object(
  'source_states',states,'attempted_sources',attempted,'enabled_sources','["otofun","voz"]'::jsonb,
  'source_diagnostics',diagnostics));
end;
$$;

select lives_ok($$select pg_temp.finish_source_case('failed','{"otofun":"failed"}','["otofun"]')$$,'source failure finishes normally');
select is((select failure_count from public.collection_sources where id='otofun'),1,'first failure counted');
select ok((select retry_after=now()+interval '15 minutes' from public.collection_sources where id='otofun'),'first retry in fifteen minutes');
create temporary table before_skip as select * from public.collection_sources where id='otofun';

select lives_ok($$select pg_temp.finish_source_case('partial','{"otofun":"cooldown","voz":"ok"}','["voz"]')$$,'healthy source succeeds while other cools');
select is((select retry_after from public.collection_sources where id='otofun'),(select retry_after from before_skip),'skip does not extend cooldown');
select is((select checked_at from public.collection_sources where id='otofun'),(select checked_at from before_skip),'skip is not a new check');
select is((select failure_count from public.collection_sources where id='otofun'),1,'skip does not increment failures');
select ok((select last_success_at=now() from public.collection_sources where id='voz'),'healthy source has its own success timestamp');

select lives_ok($$select pg_temp.finish_source_case('failed','{"otofun":"failed"}','["otofun"]')$$,'next attempted failure recorded');
select is((select failure_count from public.collection_sources where id='otofun'),2,'consecutive failures accumulate');
select ok((select retry_after=now()+interval '30 minutes' from public.collection_sources where id='otofun'),'backoff doubles');
update public.collection_sources set failure_count=30 where id='otofun';
select lives_ok($$select pg_temp.finish_source_case('failed','{"otofun":"failed"}','["otofun"]')$$,'many failures remain bounded');
select ok((select retry_after=now()+interval '24 hours' from public.collection_sources where id='otofun'),'default backoff capped at a day');

select lives_ok($$select pg_temp.finish_source_case('failed','{"otofun":"failed"}','["otofun"]','{"otofun":{"retry_after_seconds":172800}}')$$,'server retry delay accepted');
select ok((select retry_after=now()+interval '48 hours' from public.collection_sources where id='otofun'),'longer server delay respected');
select lives_ok($$select pg_temp.finish_source_case('failed','{"voz":"blocked"}','["voz"]')$$,'access stop retained independently');
select ok((select retry_after>=now()+interval '24 hours' from public.collection_sources where id='voz'),'access block waits at least a day');

create temporary table before_deferred as select * from public.collection_sources;
select lives_ok($$select pg_temp.finish_source_case('deferred','{"otofun":"cooldown","voz":"cooldown"}','[]')$$,'all sources cooling can defer');
select is((select failure_count from public.collection_sources where id='otofun'),(select failure_count from before_deferred where id='otofun'),'deferred run does not penalize source');
select lives_ok($$select pg_temp.finish_source_case('completed','{"otofun":"ok"}','["otofun"]')$$,'normal success recovers source');
select is((select failure_count from public.collection_sources where id='otofun'),0,'success resets failure count');
select is((select retry_after from public.collection_sources where id='otofun'),null::timestamptz,'success closes circuit');
select ok((select last_success_at=now() from public.collection_sources where id='otofun'),'recovery success timestamp recorded');
select is(has_function_privilege('anon','public.finish_daily_run(uuid,jsonb,text,jsonb)','execute'),false,'browser cannot update recovery state');

create temporary table legacy_lease as select public.claim_daily_run('legacy-worker') as id;
select lives_ok($$select public.finish_daily_run((select id from legacy_lease),'[]','completed','{"enabled_sources":["voz"],"source_states":{"voz":"ok"}}')$$,'previous worker summary remains compatible');
select is((select failure_count from public.collection_sources where id='voz'),0,'legacy success also resets source');
select is((select count(*)::integer from public.catalogue_listing_offer),0,'resilience never publishes listings');
select * from finish();
rollback;
