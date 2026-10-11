alter table public.households alter column created_by drop not null;
alter table public.households drop constraint if exists households_created_by_fkey;
alter table public.households add constraint households_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.voice_household_shares alter column granted_by drop not null;
alter table public.voice_household_shares drop constraint if exists voice_household_shares_granted_by_fkey;
alter table public.voice_household_shares add constraint voice_household_shares_granted_by_fkey
  foreign key (granted_by) references auth.users (id) on delete set null;
alter table public.voice_household_shares drop constraint if exists voice_household_shares_revoked_by_fkey;
alter table public.voice_household_shares add constraint voice_household_shares_revoked_by_fkey
  foreign key (revoked_by) references auth.users (id) on delete set null;

alter table public.child_voice_approvals alter column approved_by drop not null;
alter table public.child_voice_approvals drop constraint if exists child_voice_approvals_approved_by_fkey;
alter table public.child_voice_approvals add constraint child_voice_approvals_approved_by_fkey
  foreign key (approved_by) references auth.users (id) on delete set null;
alter table public.child_voice_approvals drop constraint if exists child_voice_approvals_revoked_by_fkey;
alter table public.child_voice_approvals add constraint child_voice_approvals_revoked_by_fkey
  foreign key (revoked_by) references auth.users (id) on delete set null;

alter table public.narrator_slot_assignments alter column activated_by drop not null;
alter table public.narrator_slot_assignments drop constraint if exists narrator_slot_assignments_activated_by_fkey;
alter table public.narrator_slot_assignments add constraint narrator_slot_assignments_activated_by_fkey
  foreign key (activated_by) references auth.users (id) on delete set null;
alter table public.narrator_slot_assignments drop constraint if exists narrator_slot_assignments_released_by_fkey;
alter table public.narrator_slot_assignments add constraint narrator_slot_assignments_released_by_fkey
  foreign key (released_by) references auth.users (id) on delete set null;

alter table public.narration_jobs alter column requested_by drop not null;
alter table public.narration_jobs drop constraint if exists narration_jobs_requested_by_fkey;
alter table public.narration_jobs add constraint narration_jobs_requested_by_fkey
  foreign key (requested_by) references auth.users (id) on delete set null;

alter table public.gifts alter column giver_id drop not null;
alter table public.gifts drop constraint if exists gifts_giver_id_fkey;
alter table public.gifts add constraint gifts_giver_id_fkey
  foreign key (giver_id) references auth.users (id) on delete set null;

alter table public.plan_settings drop constraint if exists plan_settings_updated_by_fkey;
alter table public.plan_settings add constraint plan_settings_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;

alter table public.narration_credit_lots drop constraint if exists narration_credit_lots_granted_by_fkey;
alter table public.narration_credit_lots add constraint narration_credit_lots_granted_by_fkey
  foreign key (granted_by) references auth.users (id) on delete set null;

alter table public.book_editions drop constraint if exists book_editions_reviewed_by_fkey;
alter table public.book_editions add constraint book_editions_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users (id) on delete set null;
