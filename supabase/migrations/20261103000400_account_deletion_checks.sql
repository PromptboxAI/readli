alter table public.gifts drop constraint if exists gifts_check;
alter table public.gifts add constraint gifts_check
  check (giver_id is null or recipient_user_id is null or giver_id <> recipient_user_id);

alter table public.consent_receipts drop constraint if exists consent_receipts_check;

create or replace function public.consent_receipts_require_owner() returns trigger
language plpgsql as $$
begin
  if new.user_id is null and new.guest_session_id is null then
    raise exception 'a consent receipt needs a grown-up or a guest session';
  end if;
  return new;
end;
$$;

drop trigger if exists consent_receipts_owner on public.consent_receipts;
create trigger consent_receipts_owner before insert on public.consent_receipts
  for each row execute function public.consent_receipts_require_owner();
