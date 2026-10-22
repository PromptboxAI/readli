alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check
  check (action in ('tester_plan_granted', 'tester_plan_ended', 'complimentary_issued', 'empty_family_removed'));
