begin;

alter table public.incidents
  drop constraint if exists incidents_note_check;

alter table public.incidents
  alter column note set default '';

commit;

