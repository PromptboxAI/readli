
alter table public.plan_settings
  add column family_annual_price_cents integer not null default 17999 check (family_annual_price_cents > 0),
  alter column family_monthly_price_cents set default 1999,
  alter column extra_slot_price_cents set default 599,
  alter column extra_slot_price_approved set default true;

update public.plan_settings
set family_monthly_price_cents = 1999, extra_slot_price_cents = 599, extra_slot_price_approved = true, updated_at = now()
where family_monthly_price_cents = 1499 and extra_slot_price_cents = 299 and not extra_slot_price_approved;

update public.gift_plans g
set price_cents = v.new_cents, updated_at = now()
from (values ('prepaid_1m', 1499, 1999), ('prepaid_3m', 4497, 5997), ('prepaid_12m', 14999, 17999), ('sponsored_monthly', 1499, 1999))
  as v (id, old_cents, new_cents)
where g.id = v.id and g.price_cents = v.old_cents;
