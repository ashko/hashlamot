-- השלמות — row level security
--
-- The repo is public and the anon key ships in the bundle, so RLS is the only
-- thing standing between the internet and their shopping list. Every table
-- carrying household data is locked to the caller's own household.
--
-- current_household_id() is SECURITY DEFINER on purpose: it reads `members`
-- with RLS bypassed, so the policy on `members` can call it without recursing
-- into itself. STABLE lets Postgres evaluate it once per statement.

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from members where user_id = auth.uid() limit 1
$$;

create or replace function public.current_role_is(p_role member_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from members where user_id = auth.uid() and role = p_role
  )
$$;

alter table households        enable row level security;
alter table members           enable row level security;
alter table products          enable row level security;
alter table recipes           enable row level security;
alter table recipe_ingredients enable row level security;
alter table lists             enable row level security;
alter table list_recipes      enable row level security;
alter table list_items        enable row level security;
alter table push_subscriptions enable row level security;
alter table units             enable row level security;
alter table departments       enable row level security;

-- Reference data is readable by anyone signed in, and writable by no one.
create policy units_read on units
  for select to authenticated using (true);
create policy departments_read on departments
  for select to authenticated using (true);

-- The household row itself. Only the admin may change settings on it;
-- everyone in it can read it (they need department_order).
create policy households_read on households
  for select to authenticated
  using (id = public.current_household_id());

create policy households_admin_update on households
  for update to authenticated
  using (id = public.current_household_id() and public.current_role_is('admin'))
  with check (id = public.current_household_id());

-- Members: you can always see your own row, plus everyone in your household.
create policy members_read on members
  for select to authenticated
  using (user_id = auth.uid() or household_id = public.current_household_id());

-- You may edit your own row (name, text size). Role changes go through the
-- admin-only function, not a direct update.
create policy members_self_update on members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());

create policy members_admin_delete on members
  for delete to authenticated
  using (household_id = public.current_household_id() and public.current_role_is('admin'));

-- Household-scoped content: one shape, applied uniformly.
create policy products_all on products
  for all to authenticated
  using      (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy recipes_all on recipes
  for all to authenticated
  using      (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy lists_all on lists
  for all to authenticated
  using      (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy list_items_all on list_items
  for all to authenticated
  using      (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Join tables have no household_id of their own; they inherit it via parent.
create policy recipe_ingredients_all on recipe_ingredients
  for all to authenticated
  using (exists (
    select 1 from recipes r
    where r.id = recipe_ingredients.recipe_id
      and r.household_id = public.current_household_id()))
  with check (exists (
    select 1 from recipes r
    where r.id = recipe_ingredients.recipe_id
      and r.household_id = public.current_household_id()));

create policy list_recipes_all on list_recipes
  for all to authenticated
  using (exists (
    select 1 from lists l
    where l.id = list_recipes.list_id
      and l.household_id = public.current_household_id()))
  with check (exists (
    select 1 from lists l
    where l.id = list_recipes.list_id
      and l.household_id = public.current_household_id()));

-- Push subscriptions are per-device and only ever touched by their owner.
create policy push_self on push_subscriptions
  for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());
