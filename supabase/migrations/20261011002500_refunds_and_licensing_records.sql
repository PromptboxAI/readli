alter table public.narration_credit_lots
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_cents integer check (refunded_cents is null or refunded_cents > 0),
  add column if not exists refund_ref text;
alter table public.narration_credit_lots drop constraint if exists narration_credit_lots_refund_complete;
alter table public.narration_credit_lots add constraint narration_credit_lots_refund_complete
  check ((refunded_at is null) = (refunded_cents is null) and (refunded_at is null) = (refund_ref is null));
comment on column public.narration_credit_lots.refunded_at is 'A refunded pack is closed: expires_at is set to the same time so its credits cannot be spent. The lot and its ledger stay on record.';

alter table public.lifecycle_audit_log drop constraint if exists lifecycle_audit_log_action_check;
alter table public.lifecycle_audit_log add constraint lifecycle_audit_log_action_check check (action in (
  'voice_withdrawn', 'voice_version_upgraded', 'clone_created', 'clone_retired', 'clone_reactivated',
  'voice_unlinked', 'voice_relinked', 'legal_removal', 'plan_changed', 'jobs_stopped',
  'recovery_started', 'recovery_notice', 'recovery_restored', 'recovery_held', 'recovery_deleted',
  'safeguard_stopped', 'household_cleaned', 'recording_deletion_requested', 'recordings_deleted',
  'account_deleted', 'exception_opened', 'exception_resolved', 'run_started', 'run_finished', 'email_suppressed',
  'plan_change_requested', 'credit_pack_refunded', 'credits_forfeited'
));

alter table public.voice_rights_agreements add column if not exists jurisdiction text
  check (jurisdiction is null or jurisdiction ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$');
comment on column public.voice_rights_agreements.jurisdiction is 'Where the contributor was when this row was recorded (country, or country-region such as US-IL), from the request location. Used for licensing eligibility.';

create or replace view public.voice_rights_current with (security_invoker = true) as
  select distinct on (contributor_id) *
  from public.voice_rights_agreements
  order by contributor_id, agreed_at desc, id desc;

alter table public.plan_settings add column if not exists dataset_licensing_enabled boolean not null default false;
comment on column public.plan_settings.dataset_licensing_enabled is 'Launch gate for third-party dataset licensing. Off until separately approved; while off, no recording can be added to a licensed dataset.';

create table public.licensing_restricted_jurisdictions (
  code text primary key check (code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  reason text not null,
  added_at timestamptz not null default now()
);
insert into public.licensing_restricted_jurisdictions (code, reason) values
  ('US-IL', 'Illinois BIPA: written release, published retention schedule, and no profiting from biometric identifiers'),
  ('US-TX', 'Texas CUBI: consent and limits on selling or disclosing biometric identifiers'),
  ('US-WA', 'Washington RCW 19.375: consent and limits on selling biometric identifiers')
on conflict (code) do nothing;
alter table public.licensing_restricted_jurisdictions enable row level security;
comment on table public.licensing_restricted_jurisdictions is 'Jurisdictions excluded from third-party dataset licensing. Only US locations not listed here are eligible; unknown locations are never eligible. Counsel decides changes.';

create table public.voice_license_agreements (
  id uuid primary key default gen_random_uuid(),
  licensee text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'ended')),
  signed_at timestamptz,
  ends_at timestamptz,
  approved_uses text not null,
  security_obligations text not null,
  retention_terms text not null,
  onward_transfer_terms text not null,
  sublicensing_allowed boolean not null default false,
  sublicensing_terms text,
  impersonation_prohibited boolean not null default true check (impersonation_prohibited),
  document_ref text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (status = 'draft' or signed_at is not null),
  check (not sublicensing_allowed or sublicensing_terms is not null)
);
alter table public.voice_license_agreements enable row level security;
comment on table public.voice_license_agreements is 'Commercial training licenses for original recordings. Each must define approved uses, security, retention, onward transfer, sublicensing and a ban on unauthorized voice impersonation.';

create view public.voice_recordings_licensable with (security_invoker = true) as
  select u.*, c.jurisdiction
  from public.voice_recordings_usable u
  join public.voice_rights_agreements c on c.id = u.current_agreement_id
  where u.third_party_licensing
    and u.readli_development_rights
    and c.jurisdiction like 'US-%'
    and not exists (select 1 from public.licensing_restricted_jurisdictions r where r.code = c.jurisdiction or r.code = split_part(c.jurisdiction, '-', 1));
comment on view public.voice_recordings_licensable is 'Original adult recordings whose contributor currently authorizes independent third-party licensing from an eligible jurisdiction. Children, guest demos and generated narration never appear (they are not in voice_recordings_usable).';

create table public.voice_dataset_inclusions (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.voice_license_agreements (id),
  session_id uuid references public.voice_training_sessions (id) on delete set null,
  contributor_id uuid references auth.users (id) on delete set null,
  agreement_id uuid not null references public.voice_rights_agreements (id),
  agreement_version text not null,
  jurisdiction text not null,
  included_at timestamptz not null default now(),
  disclosed_at timestamptz,
  removed_at timestamptz,
  removal_reason text,
  recorded_by uuid references auth.users (id) on delete set null,
  unique (license_id, session_id),
  check ((removed_at is null) = (removal_reason is null))
);
create index voice_dataset_inclusions_contributor on public.voice_dataset_inclusions (contributor_id);
alter table public.voice_dataset_inclusions enable row level security;
comment on table public.voice_dataset_inclusions is 'Which recordings went into which licensed dataset, under which consent row, version and jurisdiction, and when they were disclosed or removed.';

create or replace function public.voice_dataset_inclusion_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ok record;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'disclosed_at' - 'removed_at' - 'removal_reason' - 'contributor_id' - 'session_id')
       is distinct from (to_jsonb(old) - 'disclosed_at' - 'removed_at' - 'removal_reason' - 'contributor_id' - 'session_id') then
      raise exception 'voice_dataset_inclusions: only disclosure and removal can change';
    end if;
    return new;
  end if;
  if not coalesce((select dataset_licensing_enabled from public.plan_settings limit 1), false) then
    raise exception 'Dataset licensing is not launched';
  end if;
  if not exists (select 1 from public.voice_license_agreements a where a.id = new.license_id and a.status = 'active') then
    raise exception 'The license agreement is not active';
  end if;
  select l.contributor_id, l.current_agreement_id, l.current_agreement_version, l.jurisdiction into ok
    from public.voice_recordings_licensable l where l.session_id = new.session_id limit 1;
  if ok.current_agreement_id is null then
    raise exception 'This recording has no valid third-party licensing authorization';
  end if;
  new.contributor_id := ok.contributor_id;
  new.agreement_id := ok.current_agreement_id;
  new.agreement_version := ok.current_agreement_version;
  new.jurisdiction := ok.jurisdiction;
  return new;
end;
$$;

create trigger voice_dataset_inclusions_guard
  before insert or update on public.voice_dataset_inclusions
  for each row execute function public.voice_dataset_inclusion_guard();

create or replace function public.voice_dataset_inclusions_no_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'voice_dataset_inclusions is a permanent record; set removed_at instead';
end;
$$;

create trigger voice_dataset_inclusions_keep
  before delete on public.voice_dataset_inclusions
  for each row execute function public.voice_dataset_inclusions_no_delete();

revoke all on public.voice_recordings_licensable from anon, authenticated;
revoke all on public.licensing_restricted_jurisdictions from anon, authenticated;
revoke all on public.voice_license_agreements from anon, authenticated;
revoke all on public.voice_dataset_inclusions from anon, authenticated;
revoke all on function public.voice_dataset_inclusion_guard() from public, anon, authenticated;
