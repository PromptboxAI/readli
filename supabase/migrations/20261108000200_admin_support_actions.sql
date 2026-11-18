alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action ~ '^[a-z][a-z_]{2,63}$');
