insert into public.narration_credit_lots (household_id, source, credits, expires_at, note, payment_ref, granted_by)
select m.household_id, 'promotional', 500000, null, 'Admin testing credits (500)', 'admin-test-credits-20261108:' || m.household_id::text, u.id
from auth.users u
join public.household_members m on m.user_id = u.id and m.removed_at is null
where lower(u.email) = 'kevin@promptbox.com'
on conflict do nothing;

select l.household_id, h.name, l.credits / 1000 as credits_granted, public.narration_credits_available(l.household_id) / 1000 as credits_available_now
from public.narration_credit_lots l
join public.households h on h.id = l.household_id
where l.payment_ref like 'admin-test-credits-20261108:%';
