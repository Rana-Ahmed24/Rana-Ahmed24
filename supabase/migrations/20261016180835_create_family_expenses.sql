-- Dedicated family-expenses project only. Version matches the applied remote migration.
-- No personal accounts or public API access.
begin;

create table public.expenses (
  id uuid primary key,
  expense_date date not null check (expense_date >= date '2000-01-01'),
  amount_piastres integer not null check (amount_piastres between 1 and 999999999),
  description text not null check (length(btrim(description)) between 1 and 160),
  category text not null check (category in ('Groceries', 'Food & Drinks', 'Transport', 'Bills', 'Health', 'Shopping', 'Other')),
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  version integer not null default 1 check (version > 0)
);

create index expenses_date_idx on public.expenses (expense_date, created_at, id);
alter table public.expenses enable row level security;
revoke all on table public.expenses from public, anon, authenticated;
grant select, insert, update, delete on table public.expenses to service_role;
-- Deliberately no anon/authenticated RLS policies. Only the checked server API
-- can use the server-only secret key to read or mutate this dedicated ledger.

create function public.touch_expense() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  new.version := old.version + 1;
  return new;
end;
$$;
revoke all on function public.touch_expense() from public, anon, authenticated;
grant execute on function public.touch_expense() to service_role;
create trigger touch_expense before update on public.expenses
  for each row execute function public.touch_expense();

create function public.list_expenses(p_month text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  start_date date;
  result jsonb;
begin
  if p_month is not null then
    if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Invalid month' using errcode = '22007';
    end if;
    start_date := (p_month || '-01')::date;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.expense_date, e.created_at, e.id), '[]'::jsonb)
    into result from public.expenses e
    where start_date is null or (e.expense_date >= start_date and e.expense_date < (start_date + interval '1 month')::date);
  return result;
end;
$$;
revoke all on function public.list_expenses(text) from public, anon, authenticated;
grant execute on function public.list_expenses(text) to service_role;

commit;
