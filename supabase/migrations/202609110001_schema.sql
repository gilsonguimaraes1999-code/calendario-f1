begin;

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
set local search_path = public, extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_manage_users boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  incident_date date not null check (isfinite(incident_date)),
  kind text not null check (kind in ('partial', 'full_day')),
  start_time time without time zone,
  end_time time without time zone,
  duration_minutes integer generated always as (
    case when kind = 'full_day' then 1440
      else (extract(epoch from (end_time - start_time)) / 60)::integer end
  ) stored,
  note text not null check (note ~ '[^[:space:]]'),
  -- Preserve operational history when a member account is deleted.
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_valid_times check (
    (kind = 'full_day' and start_time is null and end_time is null)
    or
    (kind = 'partial' and start_time is not null and end_time is not null
      and start_time < end_time and end_time < time '24:00'
      and extract(second from start_time) = 0
      and extract(second from end_time) = 0)
  ),
  -- A database exclusion constraint also resolves simultaneous transactions;
  -- a SELECT-in-trigger conflict check would have a race on an empty date.
  constraint incidents_one_kind_per_date exclude using gist
    (incident_date with =, kind with <>)
);

create unique index incidents_one_full_day_per_date
  on public.incidents (incident_date) where kind = 'full_day';
create index incidents_date_idx on public.incidents (incident_date);
create index incidents_author_idx on public.incidents (author_id);
create index profiles_status_idx on public.profiles (status);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger permissions_updated_at before update on public.permissions
  for each row execute function private.touch_updated_at();
create trigger incidents_updated_at before update on public.incidents
  for each row execute function private.touch_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- User-editable Auth metadata supplies a display name, never authorization.
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200));
  insert into public.permissions (profile_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Enable RLS before committing any application tables, even when the security
-- migration is applied separately. Until its policies land, access fails closed.
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.incidents enable row level security;
revoke all on public.profiles, public.permissions, public.incidents from public, anon, authenticated;

commit;
