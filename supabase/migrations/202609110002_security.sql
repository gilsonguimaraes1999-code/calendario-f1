begin;

-- Definer functions use the migration owner to avoid recursive RLS. Every
-- object is qualified and the search path is empty; callers cannot redirect SQL.
create function public.current_profile()
returns public.profiles
language sql stable security definer
set search_path = ''
as $$
  select p from public.profiles p where p.id = (select auth.uid());
$$;
revoke all on function public.current_profile() from public, anon, authenticated;
grant execute on function public.current_profile() to authenticated;

create function private.is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'owner'
  );
$$;

create function private.has_permission(permission_name text)
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
        when 'can_create' then flags.can_create
        when 'can_edit' then flags.can_edit
        when 'can_delete' then flags.can_delete
        when 'can_manage_users' then flags.can_manage_users
        else false end)
    )
  );
$$;

create function private.can_manage_profile(target_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_owner() or (
    private.has_permission('can_manage_users')
    and target_id <> (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = target_id and p.role = 'member')
  );
$$;

revoke all on function private.is_owner() from public, anon, authenticated;
revoke all on function private.has_permission(text) from public, anon, authenticated;
revoke all on function private.can_manage_profile(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_owner(), private.has_permission(text), private.can_manage_profile(uuid) to authenticated;

-- Principal lifecycle is a trusted administrative operation. Keeping owners
-- protected on the client path also prevents concurrent last-owner removal.
-- This trigger is deliberately SECURITY INVOKER: current_user is the SQL role.
create function private.protect_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and old.role = 'owner' then
    if tg_op = 'DELETE' then
      raise exception 'Owner accounts require trusted administration' using errcode = '42501';
    elsif new.role <> 'owner' or new.status is distinct from old.status then
      raise exception 'Owner accounts require trusted administration' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.protect_owner() from public, anon, authenticated;
create trigger profiles_protect_owner before update or delete on public.profiles
  for each row execute function private.protect_owner();

-- Own access state remains readable before approval for the pending screen.
create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_permission('can_manage_users')));
create policy profiles_manage_update on public.profiles for update to authenticated
  using (private.can_manage_profile(id))
  with check (private.is_owner() or (role = 'member' and private.can_manage_profile(id)));
create policy profiles_manage_delete on public.profiles for delete to authenticated
  using (private.can_manage_profile(id));

create policy permissions_read on public.permissions for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.has_permission('can_manage_users')));
create policy permissions_manage_insert on public.permissions for insert to authenticated
  with check (private.can_manage_profile(profile_id));
create policy permissions_manage_update on public.permissions for update to authenticated
  using (private.can_manage_profile(profile_id))
  with check (private.can_manage_profile(profile_id));
create policy permissions_manage_delete on public.permissions for delete to authenticated
  using (private.can_manage_profile(profile_id));

create policy incidents_read on public.incidents for select to authenticated
  using ((select private.has_permission('can_view')));
create policy incidents_create on public.incidents for insert to authenticated
  with check ((select private.has_permission('can_create')) and author_id = (select auth.uid()));
create policy incidents_edit on public.incidents for update to authenticated
  using ((select private.has_permission('can_view')) and (select private.has_permission('can_edit')))
  with check ((select private.has_permission('can_view')) and (select private.has_permission('can_edit')));
create policy incidents_delete on public.incidents for delete to authenticated
  using ((select private.has_permission('can_view')) and (select private.has_permission('can_delete')));

-- Column grants make audit data and identity immutable to all client sessions.
-- INSERT uses server defaults for identity, author and timestamps.
revoke all on public.profiles, public.permissions, public.incidents from public, anon, authenticated;
grant select, delete on public.profiles to authenticated;
grant update (full_name, status, role) on public.profiles to authenticated;
grant select, delete on public.permissions to authenticated;
grant insert (profile_id, can_view, can_create, can_edit, can_delete, can_manage_users)
  on public.permissions to authenticated;
grant update (can_view, can_create, can_edit, can_delete, can_manage_users)
  on public.permissions to authenticated;
grant select, delete on public.incidents to authenticated;
grant insert (incident_date, kind, start_time, end_time, note) on public.incidents to authenticated;
grant update (incident_date, kind, start_time, end_time, note) on public.incidents to authenticated;

grant all on public.profiles, public.permissions, public.incidents to service_role;
grant execute on function public.current_profile() to service_role;

commit;
