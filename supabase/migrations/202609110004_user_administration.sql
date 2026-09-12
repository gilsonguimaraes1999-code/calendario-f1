-- All exposed RPCs authorize the calling verified JWT. No service-role client is
-- involved. Keep owner/self protection stronger than last-owner counting.
create function private.access_user_json(target_id uuid) returns jsonb
language sql stable set search_path = '' as $$
 select jsonb_build_object('id',p.id,'full_name',p.full_name,'email',coalesce(u.email,''),
 'role',p.role,'status',p.status,'permissions',jsonb_build_object(
 'can_view',p.role='owner' or coalesce(a.can_view,false),
 'can_view_all',p.role='owner' or coalesce(a.can_view_all,false),
 'can_create',p.role='owner' or coalesce(a.can_create,false),
 'can_edit',p.role='owner' or coalesce(a.can_edit,false),
 'can_delete',p.role='owner' or coalesce(a.can_delete,false),
 'can_manage_users',p.role='owner' or coalesce(a.can_manage_users,false)))
 from public.profiles p join auth.users u on u.id=p.id
 left join public.permissions a on a.profile_id=p.id where p.id=target_id;
$$;
revoke all on function private.access_user_json(uuid) from public,anon,authenticated;

create function private.lock_managed_user(target_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
 -- Stable order prevents two managers editing each other from deadlocking.
 -- Locks keep status/role/permission revocations from racing the mutation.
 perform id from public.profiles where id in (auth.uid(),target_id) order by id for update;
 perform profile_id from public.permissions where profile_id in (auth.uid(),target_id) order by profile_id for update;
 if auth.uid() is null or not private.has_permission('can_manage_users') then
   raise exception 'forbidden' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=target_id) then
   raise exception 'not_found' using errcode='P0002';
 end if;
 if target_id=auth.uid() or exists(select 1 from public.profiles where id=target_id and role='owner') then
   raise exception 'protected_user' using errcode='P0001';
 end if;
end;
$$;
revoke all on function private.lock_managed_user(uuid) from public,anon,authenticated;

create function public.list_access_users(page_offset integer default 0,page_size integer default 500) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.has_permission('can_manage_users') then
   raise exception 'forbidden' using errcode='42501';
 end if;
 if page_offset is null or page_size is null or page_offset<0 or page_size<1 or page_size>500 then
   raise exception 'invalid pagination' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(private.access_user_json(id) order by id),'[]'::jsonb) into result
 from (select id from public.profiles order by id limit page_size offset page_offset) p;
 return result;
end;
$$;

create function public.update_access_user(target_id uuid,changes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare flags jsonb;
begin
 perform private.lock_managed_user(target_id);
 if changes is null or jsonb_typeof(changes)<>'object' or changes='{}'::jsonb then
   raise exception 'invalid changes' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(changes) k where k not in ('full_name','status','permissions')) then
   raise exception 'unknown field' using errcode='22023';
 end if;
 if changes ? 'full_name' and (jsonb_typeof(changes->'full_name')<>'string' or length(btrim(changes->>'full_name')) not between 1 and 200) then
   raise exception 'invalid name' using errcode='22023';
 end if;
 if changes ? 'status' and (jsonb_typeof(changes->'status')<>'string' or changes->>'status' not in ('pending','approved','rejected','suspended')) then
   raise exception 'invalid status' using errcode='22023';
 end if;
 if changes ? 'permissions' then
   flags:=changes->'permissions';
   if jsonb_typeof(flags)<>'object' then raise exception 'invalid permissions' using errcode='22023'; end if;
   if (select count(*) from jsonb_object_keys(flags))<>6
     or not flags ?& array['can_view','can_view_all','can_create','can_edit','can_delete','can_manage_users']
     or exists(select 1 from jsonb_each(flags) item where jsonb_typeof(item.value)<>'boolean') then
     raise exception 'invalid permissions' using errcode='22023';
   end if;
 end if;
 update public.profiles set full_name=case when changes ? 'full_name' then btrim(changes->>'full_name') else full_name end,
   status=case when changes ? 'status' then changes->>'status' else status end where id=target_id;
 if flags is not null then
   insert into public.permissions(profile_id,can_view,can_view_all,can_create,can_edit,can_delete,can_manage_users)
   values(target_id,(flags->>'can_view')::boolean,(flags->>'can_view_all')::boolean,(flags->>'can_create')::boolean,(flags->>'can_edit')::boolean,(flags->>'can_delete')::boolean,(flags->>'can_manage_users')::boolean)
   on conflict(profile_id) do update set can_view=excluded.can_view,can_view_all=excluded.can_view_all,
   can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete,can_manage_users=excluded.can_manage_users;
 end if;
 return private.access_user_json(target_id);
end;
$$;

create function public.delete_access_user(target_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
 perform private.lock_managed_user(target_id);
 -- Auth/profile/permissions removal is atomic. Incident authors become NULL
 -- through the existing FK, retaining the operational history.
 delete from auth.users where id=target_id;
 if not found then raise exception 'not_found' using errcode='P0002'; end if;
 return target_id;
end;
$$;
revoke all on function public.list_access_users(integer,integer) from public,anon;
revoke all on function public.update_access_user(uuid,jsonb) from public,anon;
revoke all on function public.delete_access_user(uuid) from public,anon;
grant execute on function public.list_access_users(integer,integer) to authenticated;
grant execute on function public.update_access_user(uuid,jsonb) to authenticated;
grant execute on function public.delete_access_user(uuid) to authenticated;
