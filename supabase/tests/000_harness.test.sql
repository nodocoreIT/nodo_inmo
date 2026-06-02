-- Harness smoke test: proves pgTAP runs under `supabase test db`.
begin;
select plan(1);

select ok(true, 'pgTAP harness is working');

select * from finish();
rollback;
