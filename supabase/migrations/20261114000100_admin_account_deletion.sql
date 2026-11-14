alter table public.household_entitlements drop constraint if exists household_entitlements_granted_by_fkey;
alter table public.household_entitlements add constraint household_entitlements_granted_by_fkey
  foreign key (granted_by) references auth.users (id) on delete set null;

alter table public.admin_actions alter column admin_id drop not null;
alter table public.admin_actions drop constraint if exists admin_actions_admin_id_fkey;
alter table public.admin_actions add constraint admin_actions_admin_id_fkey
  foreign key (admin_id) references auth.users (id) on delete set null;
