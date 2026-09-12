-- Run with `supabase test db`; fixtures and changes roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'permissions', 'permissions exists');
select has_table('public', 'incidents', 'incidents exists');

-- Metadata must never grant access at signup.
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-000000000001', 'owner@example.test', '{"full_name":"Owner"}'),
 ('00000000-0000-0000-0000-000000000002', 'member@example.test', '{"full_name":"Member"}'),
 ('00000000-0000-0000-0000-000000000003', 'pending@example.test', '{"full_name":"Pending","role":"owner","status":"approved","can_view":true}'),
 ('00000000-0000-0000-0000-000000000004', 'suspended@example.test', '{}'),
 ('00000000-0000-0000-0000-000000000005', 'rejected@example.test', '{}'),
 ('00000000-0000-0000-0000-000000000006', 'manager@example.test', '{}'),
 ('00000000-0000-0000-0000-000000000007', 'other@example.test', '{}');
select is((select status from profiles where id='00000000-0000-0000-0000-000000000003'), 'pending', 'signup cannot self-approve');
select is((select role from profiles where id='00000000-0000-0000-0000-000000000003'), 'member', 'signup cannot become owner');
select is((select can_view from permissions where profile_id='00000000-0000-0000-0000-000000000003'), false, 'signup has no viewing permission');

update profiles set role='owner', status='approved' where id='00000000-0000-0000-0000-000000000001';
update profiles set status='approved' where id in ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000007');
update profiles set status='suspended' where id='00000000-0000-0000-0000-000000000004';
update profiles set status='rejected' where id='00000000-0000-0000-0000-000000000005';
update permissions set can_view=true, can_create=true where profile_id='00000000-0000-0000-0000-000000000002';
update permissions set can_view=true, can_create=true, can_edit=true, can_delete=true, can_manage_users=true
 where profile_id in ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005');
update permissions set can_manage_users=true where profile_id='00000000-0000-0000-0000-000000000006';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((public.current_profile()).id, '00000000-0000-0000-0000-000000000002'::uuid, 'current_profile reads only caller without recursive RLS');
select is((select count(*) from profiles), 1::bigint, 'ordinary member sees own profile only');
select is((select count(*) from permissions), 1::bigint, 'ordinary member sees own flags only');
select lives_ok($$insert into incidents (incident_date,kind,start_time,end_time,note) values ('2026-09-02','partial','10:00','10:20','queda')$$, 'membro com can_create cria');
select is((select duration_minutes from incidents where note='queda'), 20, 'partial duration generated in minutes');
select is((select author_id from incidents where note='queda'), '00000000-0000-0000-0000-000000000002'::uuid, 'author is authenticated caller');
select is((select created_at=updated_at from incidents where note='queda'), true, 'new incident timestamps agree');
select results_eq($$delete from incidents where note='queda' returning note$$, $$select null::text where false$$, 'denied delete affects zero rows');
select is((select count(*) from incidents where note='queda'), 1::bigint, 'denied delete preserves incident');
select results_eq($$update incidents set note='hacked' where note='queda' returning note$$, $$select null::text where false$$, 'member without can_edit changes zero rows');
select is((select count(*) from incidents where note='queda'), 1::bigint, 'denied edit preserves note');
select throws_ok($$insert into incidents (incident_date,kind,start_time,end_time,note,author_id) values ('2026-09-04','partial','10:00','10:20','spoof','00000000-0000-0000-0000-000000000001')$$, '42501', null, 'cannot forge incident author');
select throws_ok($$update incidents set author_id='00000000-0000-0000-0000-000000000001'$$, '42501', null, 'cannot rewrite authorship');
select throws_ok($$update incidents set created_at='2000-01-01'$$, '42501', null, 'cannot rewrite creation timestamp');
select throws_ok($$update incidents set duration_minutes=999$$, '428C9', null, 'literal assignment to generated duration is rejected');
select throws_ok($$update incidents set duration_minutes=default$$, '42501', null, 'client has no update grant on generated duration');
select results_eq($$update profiles set status='approved', role='owner' where id=auth.uid() returning id$$, $$select null::uuid where false$$, 'ordinary member cannot promote self');
select results_eq($$update permissions set can_delete=true where profile_id=auth.uid() returning profile_id$$, $$select null::uuid where false$$, 'ordinary member cannot grant flags');
select throws_ok($$insert into profiles(id,full_name,status,role) values ('00000000-0000-0000-0000-000000000008','Fake','approved','owner')$$, '42501', null, 'client cannot provision arbitrary profiles');

-- Owner bypasses flags, including when the permissions row is absent.
reset role;
delete from permissions where profile_id='00000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from profiles), 7::bigint, 'owner sees all profiles without flags');
select throws_ok($$update profiles set role='member' where id=auth.uid()$$, '42501', null, 'owner cannot accidentally demote principal through client API');
select throws_ok($$delete from profiles where id=auth.uid()$$, '42501', null, 'owner cannot delete principal through client API');
select lives_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-03','full_day','full')$$, 'owner creates without flags');
select is((select duration_minutes from incidents where note='full'), 1440, 'full day is 1440 minutes');
select results_eq($$update incidents set end_time='10:30' where note='queda' returning duration_minutes$$, $$values (30)$$, 'owner edits another author and duration recalculates');
select is((select updated_at>created_at from incidents where note='queda'), true, 'edit advances update timestamp');
select results_eq($$delete from incidents where note='full' returning note$$, $$values ('full'::text)$$, 'owner deletes without flags');
select lives_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-03','full_day','full')$$, 'recreate full-day fixture');

-- Time and date invariants must apply even to the owner.
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-05','partial','11:00','10:00','invalid')$$, '23514', null, 'end must be after start');
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-05','partial','10:00','10:00','invalid')$$, '23514', null, 'zero-duration partial rejected');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-05','partial','invalid')$$, '23514', null, 'partial requires times');
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-05','full_day','00:00','23:59','invalid')$$, '23514', null, 'full day forbids times');
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-05','partial','10:00:01','10:20','invalid')$$, '23514', null, 'time precision matches HH:MM domain');
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-05','partial','23:00','24:00','invalid')$$, '23514', null, '24:00 is outside HH:MM domain');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-05','full_day','   ')$$, '23514', null, 'blank note rejected');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-05','full_day',E'\t\n')$$, '23514', null, 'whitespace-only note rejected');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-05','unknown','invalid')$$, '23514', null, 'unknown incident kind rejected');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-02','full_day','conflict')$$, '23P01', null, 'full day cannot follow partial');
select throws_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-03','partial','10:00','10:20','conflict')$$, '23P01', null, 'partial cannot follow full day');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-03','full_day','duplicate')$$, '23505', null, 'only one full-day incident per date');
select lives_ok($$insert into incidents(incident_date,kind,start_time,end_time,note) values ('2026-09-02','partial','10:10','10:40','overlap')$$, 'multiple overlapping partials allowed');
select throws_ok($$update incidents set kind='full_day',start_time=null,end_time=null where note='queda'$$, '23P01', null, 'kind edit cannot conflict with another partial');
select throws_ok($$update incidents set incident_date='2026-09-03' where note='queda'$$, '23P01', null, 'date edit cannot conflict with full day');
select throws_ok($$update incidents set end_time='09:00' where note='queda'$$, '23514', null, 'time constraint also guards edits');

-- Flags are independent; approval is always required for members.
reset role;
update permissions set can_create=false,can_edit=true,can_delete=true,can_view_all=true where profile_id='00000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'can_view does not imply can_create');
select results_eq($$update incidents set note='edited' where note='overlap' returning note$$, $$values ('edited'::text)$$, 'can_edit permits editing another author');
select results_eq($$delete from incidents where note='edited' returning note$$, $$values ('edited'::text)$$, 'can_delete permits deletion');
reset role;
update permissions set can_view=false where profile_id='00000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from incidents), 0::bigint, 'without can_view operational rows are hidden');
select results_eq($$update incidents set note='hidden edit' where note='queda' returning note$$, $$select null::text where false$$, 'hidden rows cannot be edited');
select results_eq($$delete from incidents where note='queda' returning note$$, $$select null::text where false$$, 'hidden rows cannot be deleted');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((public.current_profile()).status, 'pending', 'pending caller can read own access status');
select is((select count(*) from incidents), 0::bigint, 'pending member with all flags sees no incidents');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'pending member with create flag cannot create');
select is((select count(*) from profiles), 1::bigint, 'pending manager flag does not expose directory');
select results_eq($$update profiles set status='approved' where id=auth.uid() returning id$$, $$select null::uuid where false$$, 'pending cannot self-approve');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select is((select count(*) from incidents), 0::bigint, 'suspended member with all flags sees no incidents');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'suspended member cannot create');
select results_eq($$delete from incidents returning id$$, $$select null::uuid where false$$, 'suspended cannot delete');
select results_eq($$update incidents set note='blocked' returning id$$, $$select null::uuid where false$$, 'suspended cannot edit');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);
select is((select count(*) from incidents), 0::bigint, 'rejected member with all flags sees no incidents');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'rejected member cannot create');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', true);
select is((select count(*) from profiles), 7::bigint, 'approved user manager can read directory');
select is((select count(*) from incidents), 0::bigint, 'can_manage_users does not imply calendar access');
select results_eq($$update profiles set status='approved' where id='00000000-0000-0000-0000-000000000003' returning status$$, $$values ('approved'::text)$$, 'manager approves a member');
select results_eq($$update permissions set can_view=true where profile_id='00000000-0000-0000-0000-000000000007' returning can_view$$, $$values (true)$$, 'manager edits another member flags');
select results_eq($$update profiles set status='suspended' where id='00000000-0000-0000-0000-000000000001' returning id$$, $$select null::uuid where false$$, 'manager cannot suspend owner');
select results_eq($$delete from profiles where id='00000000-0000-0000-0000-000000000001' returning id$$, $$select null::uuid where false$$, 'manager cannot delete owner');
select throws_ok($$update profiles set role='owner' where id='00000000-0000-0000-0000-000000000007'$$, '42501', null, 'manager cannot mint owners');
select results_eq($$update permissions set can_delete=true where profile_id=auth.uid() returning profile_id$$, $$select null::uuid where false$$, 'manager cannot grant self extra permissions');

-- Unknown JWT subject and revoked rows fail closed.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
select ok((public.current_profile()).id is null, 'missing profile returns null');
select is((select count(*) from incidents), 0::bigint, 'missing profile cannot see incidents');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'missing profile cannot create');
reset role;
delete from permissions where profile_id='00000000-0000-0000-0000-000000000007';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000007', true);
select is((select count(*) from incidents), 0::bigint, 'member without permission row fails closed');

-- Deleting a member preserves incident history and clears dangling authorship.
reset role;
insert into incidents(incident_date,kind,note,author_id)
 values ('2026-09-08','full_day','departed member','00000000-0000-0000-0000-000000000007');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select results_eq($$delete from profiles where id='00000000-0000-0000-0000-000000000007' returning id$$,
 $$values ('00000000-0000-0000-0000-000000000007'::uuid)$$, 'owner can delete member profile');
select is((select count(*) from incidents where note='departed member'), 1::bigint, 'member deletion preserves operational history');
select ok((select author_id is null from incidents where note='departed member'), 'deleted member author becomes null');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from incidents$$, '42501', null, 'anonymous cannot read incidents');
select throws_ok($$select * from profiles$$, '42501', null, 'anonymous cannot read profiles');
select throws_ok($$select * from permissions$$, '42501', null, 'anonymous cannot read permissions');
select throws_ok($$select public.current_profile()$$, '42501', null, 'anonymous cannot call profile RPC');
select throws_ok($$insert into incidents(incident_date,kind,note) values ('2026-09-06','full_day','denied')$$, '42501', null, 'anonymous cannot create');
reset role;

select * from finish();
rollback;
