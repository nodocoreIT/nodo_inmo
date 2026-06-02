-- Test: R1 — shared and nodo_inmo schemas exist; public is untouched
begin;
select plan(3);

select has_schema('shared',    'schema shared exists');
select has_schema('nodo_inmo', 'schema nodo_inmo exists');
-- public must still exist (nodo-core owns it; we do NOT drop or modify it)
select has_schema('public',    'schema public still exists');

select * from finish();
rollback;
