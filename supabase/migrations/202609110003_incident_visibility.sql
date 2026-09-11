begin;

alter table public.permissions add column can_view_all boolean not null default false;
grant insert (can_view_all), update (can_view_all) on public.permissions to authenticated;

create or replace function private.has_permission(permission_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    left join public.permissions flags on flags.profile_id = p.id
    where p.id = (select auth.uid()) and (
      p.role = 'owner' or (p.status = 'approved' and case permission_name
        when 'can_view' then flags.can_view
        when 'can_view_all' then flags.can_view_all
        when 'can_create' then flags.can_create
        when 'can_edit' then flags.can_edit
        when 'can_delete' then flags.can_delete
        when 'can_manage_users' then flags.can_manage_users
        else false end)
    )
  );
$$;

-- Visibility applies to every read and to both sides of each UPDATE.
-- NULL authors are historical records, visible only with all-incidents access.
alter policy incidents_read on public.incidents
  using ((select private.has_permission('can_view')) and
    (author_id = (select auth.uid()) or (select private.has_permission('can_view_all'))));
alter policy incidents_edit on public.incidents
  using ((select private.has_permission('can_view')) and (select private.has_permission('can_edit')) and
    (author_id = (select auth.uid()) or (select private.has_permission('can_view_all'))))
  with check ((select private.has_permission('can_view')) and (select private.has_permission('can_edit')) and
    (author_id = (select auth.uid()) or (select private.has_permission('can_view_all'))));
alter policy incidents_delete on public.incidents
  using ((select private.has_permission('can_view')) and (select private.has_permission('can_delete')) and
    (author_id = (select auth.uid()) or (select private.has_permission('can_view_all'))));

commit;
