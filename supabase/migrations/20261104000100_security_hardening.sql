revoke all on function public.active_entitlement(uuid) from public, anon, authenticated;
revoke all on function public.active_share_started(uuid, uuid) from public, anon, authenticated;
revoke all on function public.active_slot_started(uuid, uuid) from public, anon, authenticated;
revoke all on function public.child_can_hear_voice(uuid, uuid) from public, anon, authenticated;
revoke all on function public.child_can_play_segment(uuid, text, text) from public, anon, authenticated;
revoke all on function public.claim_narration_segments(text, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.commit_narration_segment(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.settle_narration_job(uuid) from public, anon, authenticated;
revoke all on function public.narration_credits_available(uuid) from public, anon, authenticated;
revoke all on function public.narration_lots(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.narrator_slot_count(uuid) from public, anon, authenticated;
revoke all on function public.sponsor_voice_included(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sponsored_access_end(uuid, uuid) from public, anon, authenticated;

revoke all on function public.is_active_member(uuid, uuid) from public, anon;
revoke all on function public.is_guardian_of(uuid, uuid) from public, anon;
grant execute on function public.is_active_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_guardian_of(uuid, uuid) to authenticated, service_role;

drop policy if exists "own profile" on public.adult_profiles;
drop policy if exists "read own profile" on public.adult_profiles;
create policy "read own profile" on public.adult_profiles
  for select using (auth.uid() = user_id);

drop policy if exists shares_owner_all on public.voice_household_shares;
drop policy if exists shares_owner_read on public.voice_household_shares;
create policy shares_owner_read on public.voice_household_shares
  for select using (granted_by = auth.uid());

drop policy if exists approvals_guardian_all on public.child_voice_approvals;
drop policy if exists approvals_guardian_read on public.child_voice_approvals;
create policy approvals_guardian_read on public.child_voice_approvals
  for select using (public.is_guardian_of(auth.uid(), child_id));

alter table public.household_kids_pins
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

update public.email_outbox
  set html = '', body = ''
  where status in ('sent', 'canceled', 'suppressed') and (html <> '' or body <> '');
