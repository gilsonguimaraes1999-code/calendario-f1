begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select has_column('public', 'permissions', 'can_view_all', 'explicit all-incidents permission exists');
insert into auth.users (id,email,raw_user_meta_data) values
 ('66666666-6666-4666-8666-666666666661','scope-a@example.test','{"can_view_all":true}'),
 ('66666666-6666-4666-8666-666666666662','scope-b@example.test','{}'),
 ('66666666-6666-4666-8666-666666666663','scope-owner@example.test','{}');
select is((select can_view_all from permissions where profile_id='66666666-6666-4666-8666-666666666661'), false, 'signup metadata cannot grant all-incidents access');
update profiles set status='approved' where id::text like '66666666-6666-4666-8666-%';
update profiles set role='owner' where id='66666666-6666-4666-8666-666666666663';
update permissions set can_view=true, can_create=true, can_edit=true, can_delete=true where profile_id='66666666-6666-4666-8666-666666666661';
insert into incidents (incident_date,kind,start_time,end_time,note,author_id) values
 ('2026-09-21','partial','10:00','10:20','own','66666666-6666-4666-8666-666666666661'),
 ('2026-09-21','partial','11:00','11:20','other','66666666-6666-4666-8666-666666666662'),
 ('2026-09-22','full_day',null,null,'removed author',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
select results_eq($$select note from incidents order by note$$, $$values ('own'::text)$$, 'personal view excludes other and deleted authors');
select results_eq($$update incidents set note='stolen' where note='other' returning note$$, $$select null::text where false$$, 'known hidden row cannot be updated');
select results_eq($$delete from incidents where note='other' returning note$$, $$select null::text where false$$, 'known hidden row cannot be deleted');
select results_eq($$update incidents set note='own edited' where note='own' returning note$$, $$values ('own edited'::text)$$, 'personal scope can edit own row');
select results_eq($$update permissions set can_view_all=true where profile_id=auth.uid() returning profile_id$$, $$select null::uuid where false$$, 'member cannot elevate own visibility');
reset role;
update permissions set can_view_all=true where profile_id='66666666-6666-4666-8666-666666666661';
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
select is((select count(*) from incidents),3::bigint,'all view includes other and deleted authors');
select results_eq($$update incidents set note='other edited' where note='other' returning note$$, $$values ('other edited'::text)$$, 'all view plus edit allows another author');
reset role;
update permissions set can_edit=false,can_delete=false where profile_id='66666666-6666-4666-8666-666666666661';
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
select results_eq($$update incidents set note='denied' returning note$$, $$select null::text where false$$, 'all visibility does not grant edit');
select results_eq($$delete from incidents returning note$$, $$select null::text where false$$, 'all visibility does not grant delete');
reset role;
update profiles set status='suspended' where id='66666666-6666-4666-8666-666666666661';
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666661',true);
select is((select count(*) from incidents),0::bigint,'suspension revokes all visibility');
reset role;
delete from permissions where profile_id='66666666-6666-4666-8666-666666666663';
set local role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666663',true);
select is((select count(*) from incidents),3::bigint,'owner sees all without any permissions row');
select results_eq($$delete from incidents where note='other edited' returning note$$, $$values ('other edited'::text)$$, 'owner can delete another author');
select * from finish();
rollback;
