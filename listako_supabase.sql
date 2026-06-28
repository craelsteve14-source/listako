-- ============================================================
-- ListaKo — Complete Supabase Setup (verified against live DB)
-- Project: jbkqheprkehhjtrhwggf  (region ap-southeast-1)
-- Safe to re-run: uses IF NOT EXISTS and drops/recreates policies.
-- Paste this into Supabase -> SQL Editor -> Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1) TABLES
--    "IF NOT EXISTS" means: only create the table if it is
--    missing. Re-running will NOT delete your existing data.
-- ------------------------------------------------------------

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid,
  address text,
  phone text,
  status text default 'pending',          -- pending | approved | rejected | suspended
  plan text default 'trial',               -- trial | basic | pro | business
  trial_ends_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text,
  -- discount control panel settings
  discount_enabled boolean default true,
  discount_types_allowed text default 'both',     -- both | percent | fixed
  max_discount_percent numeric default 20,
  max_discount_fixed numeric default 500,
  discount_min_quantity integer default 3,
  discount_min_amount numeric default 0,
  discount_start_time text,
  discount_end_time text,
  manager_approval_threshold numeric default 15,
  senior_pwd_discount_percent numeric default 20,
  suki_discount_percent numeric default 0,
  discount_requires_reason boolean default true,
  discount_notify_owner boolean default true,
  max_discounts_per_cashier_per_day integer default 50,
  created_at timestamptz default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key,                     -- equals auth.users.id
  business_id uuid,
  branch_id uuid,
  full_name text not null,
  role text not null default 'cashier',    -- owner | branch_manager | inventory_staff | cashier
  approved_discount_percent numeric,       -- manager approval token (value)
  approved_discount_at timestamptz,        -- manager approval token (time, 30-min window)
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  barcode text,
  price numeric not null default 0,
  stock_quantity integer not null default 0,
  low_stock_threshold integer default 10,
  status text default 'active',
  no_discount boolean default false,       -- exclude product from discounts
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  branch_id uuid,
  cashier_id uuid,
  receipt_number text,                     -- auto-filled by trigger below
  original_amount numeric,
  discount_type text,
  discount_value numeric default 0,
  discount_amount numeric default 0,
  discount_reason text,
  total_amount numeric not null default 0,
  payment_method text,                     -- cash | gcash | maya | card | utang
  amount_tendered numeric,
  change_amount numeric,
  reference_number text,                   -- e-wallet ref (gcash/maya)
  customer_name text,
  customer_phone text,
  status text default 'completed',         -- completed | voided
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  product_id uuid,
  product_name text,
  quantity integer not null default 1,
  unit_price numeric not null default 0,
  subtotal numeric not null default 0
);

create table if not exists utang_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  branch_id uuid,
  transaction_id uuid,
  customer_name text not null,
  customer_phone text,
  amount numeric not null default 0,
  amount_paid numeric default 0,
  balance numeric,
  due_date date,
  status text default 'unpaid',            -- unpaid | partial | paid
  notes text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  branch_id uuid,
  cashier_id uuid,
  report_date date not null default current_date,
  total_sales numeric default 0,
  total_transactions integer default 0,
  total_cash numeric default 0,
  total_gcash numeric default 0,
  total_maya numeric default 0,
  total_card numeric default 0,
  total_utang numeric default 0,
  total_voided numeric default 0,
  expected_cash numeric,
  counted_cash numeric,
  difference numeric,
  status text,                             -- exact | over | short | closed
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists discount_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  branch_id uuid,
  transaction_id uuid,
  cashier_id uuid,
  discount_type text,
  discount_value numeric,
  discount_amount numeric,
  discount_reason text,
  customer_type text,                      -- regular | senior | pwd
  approved_by uuid,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  recipient_id uuid,                       -- null = broadcast to whole business
  sender_id uuid,
  transaction_id uuid,
  action_taken text,
  created_at timestamptz default now()
);

create table if not exists super_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2) FUNCTIONS
-- ------------------------------------------------------------

-- is_super_admin(): true if the logged-in user is in super_admins.
-- SECURITY DEFINER lets it read the table regardless of RLS.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from super_admins where user_id = auth.uid());
$$;

-- generate_receipt_number(): a BEFORE INSERT trigger function that
-- fills receipt_number like RCP-20260628-AB12CD if it is empty.
create or replace function public.generate_receipt_number()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.receipt_number is null or new.receipt_number = '' then
    new.receipt_number := 'RCP-' ||
      to_char(now() at time zone 'Asia/Manila', 'YYYYMMDD') || '-' ||
      upper(substring(gen_random_uuid()::text, 1, 6));
  end if;
  return new;
end;
$$;

-- set_trial_on_business_insert(): a BEFORE INSERT trigger that gives
-- every new business a 7-day free trial automatically.
create or replace function public.set_trial_on_business_insert()
returns trigger
language plpgsql
as $$
begin
  if new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '7 days';
  end if;
  return new;
end;
$$;

-- decrement_stock(): safely subtract sold quantity from a product.
-- GREATEST(0, ...) means stock never goes below zero.
-- SECURITY DEFINER means it runs with the function owner's rights,
-- so a cashier can deduct stock without needing UPDATE on products.
create or replace function public.decrement_stock(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set stock_quantity = greatest(0, stock_quantity - p_quantity)
  where id = p_product_id;
end;
$$;

-- ------------------------------------------------------------
-- 3) TRIGGERS  (drop-then-create so re-running is safe)
-- ------------------------------------------------------------

drop trigger if exists trigger_receipt_number on transactions;
create trigger trigger_receipt_number
  before insert on transactions
  for each row execute function generate_receipt_number();

drop trigger if exists trigger_set_trial on businesses;
create trigger trigger_set_trial
  before insert on businesses
  for each row execute function set_trial_on_business_insert();

-- ------------------------------------------------------------
-- 4) ROW LEVEL SECURITY
--    Turn RLS on for every table, then create the policies.
--    The DO $$ ... $$ block first deletes ALL old policies so you
--    never get "policy already exists" errors when re-running.
-- ------------------------------------------------------------

alter table businesses        enable row level security;
alter table branches          enable row level security;
alter table profiles          enable row level security;
alter table products          enable row level security;
alter table transactions      enable row level security;
alter table transaction_items enable row level security;
alter table utang_records     enable row level security;
alter table daily_reports     enable row level security;
alter table discount_logs     enable row level security;
alter table notifications     enable row level security;
alter table super_admins      enable row level security;

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Helper expression used below:
--   a user "belongs" to a business if their profile.business_id matches.

-- businesses: owner sees their own; super admin sees all.
create policy businesses_all on businesses for all
  using (
    owner_id = auth.uid()
    or id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    owner_id = auth.uid()
    or public.is_super_admin()
  );

-- branches: anyone in the same business; super admin all.
create policy branches_all on branches for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- profiles: SEPARATE policies (NOT "for all"), because INSERT happens
-- during signup before business_id is set.
create policy profiles_insert on profiles for insert
  with check (id = auth.uid());
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );
create policy profiles_update on profiles for update
  using (
    id = auth.uid()
    or business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- products: same business; super admin all.
create policy products_all on products for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- transactions: same business; super admin all.
create policy transactions_all on transactions for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- transaction_items: tied to a transaction in the user's business.
create policy transaction_items_all on transaction_items for all
  using (
    transaction_id in (
      select id from transactions
      where business_id in (select business_id from profiles where id = auth.uid())
    )
    or public.is_super_admin()
  )
  with check (
    transaction_id in (
      select id from transactions
      where business_id in (select business_id from profiles where id = auth.uid())
    )
    or public.is_super_admin()
  );

-- utang_records: same business; super admin all.
create policy utang_records_all on utang_records for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- daily_reports: same business; super admin all.
create policy daily_reports_all on daily_reports for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- discount_logs: same business; super admin all.
create policy discount_logs_all on discount_logs for all
  using (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- notifications: broadcast (recipient_id IS NULL) OR addressed to me,
-- within my business; super admin all.
create policy notifications_all on notifications for all
  using (
    (
      (recipient_id is null or recipient_id = auth.uid())
      and business_id in (select business_id from profiles where id = auth.uid())
    )
    or public.is_super_admin()
  )
  with check (
    business_id in (select business_id from profiles where id = auth.uid())
    or public.is_super_admin()
  );

-- super_admins: a user may read only their own row.
create policy super_admins_select on super_admins for select
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 5) SEED THE SUPER ADMIN (run once)
--    Replace the UUID if needed. This links Crael's auth user to
--    the super_admins table so the Admin tab unlocks.
--    Find the UUID in Supabase -> Authentication -> Users.
-- ------------------------------------------------------------
-- insert into super_admins (user_id, email)
-- select id, email from auth.users where email = 'craelsteve14@gmail.com'
-- on conflict do nothing;

-- ============================================================
-- DONE. Confirm in Table Editor that all 11 tables exist and
-- that RLS shows "Enabled" on each one.
-- ============================================================
