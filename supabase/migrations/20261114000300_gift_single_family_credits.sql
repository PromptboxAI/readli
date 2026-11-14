insert into public.email_switches (email_id, enabled) values
  ('S1', true), ('S2', true), ('S3', true), ('S4', true), ('S5', true), ('S6', true), ('S7', true)
on conflict (email_id) do nothing;

with solo as (
  select s.id
  from public.sponsorship_seats s
  join public.sponsorships sp on sp.id = s.sponsorship_id
  where s.status in ('invited', 'active')
    and sp.status not in ('ended', 'refunded')
    and coalesce(s.next_credit_share, s.credit_share) < 40
    and not exists (
      select 1 from public.sponsorship_seats o
      where o.sponsorship_id = s.sponsorship_id and o.id <> s.id
        and o.status in ('invited', 'active', 'removal_scheduled')
    )
)
update public.sponsorship_seats
set credit_share = 40, next_credit_share = null, next_credits_from = null
where id in (select id from solo);

update public.household_entitlements e
set monthly_credits = s.credit_share, next_monthly_credits = null, next_credits_from = null
from public.sponsorship_seats s
where e.sponsorship_id = s.sponsorship_id
  and e.household_id = s.household_id
  and e.source = 'sponsored'
  and e.status = 'active'
  and s.status = 'active'
  and s.credit_share = 40
  and e.monthly_credits is distinct from 40;
