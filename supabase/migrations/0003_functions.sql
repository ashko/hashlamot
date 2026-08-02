-- השלמות — functions
--   pairing · list building · offline-safe updates · learned aisle order

-- ============================================================ pairing

-- Bootstrap. SECURITY DEFINER because at this moment the caller belongs to no
-- household, so RLS would refuse the insert that makes them belong to one.
create or replace function public.create_household(
  p_household_name text,
  p_member_name    text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  if public.current_household_id() is not null then
    raise exception 'already a member of a household';
  end if;

  insert into households (name) values (coalesce(nullif(p_household_name,''), 'הבית'))
    returning id into v_id;
  insert into members (household_id, user_id, name, role)
    values (v_id, auth.uid(), coalesce(nullif(p_member_name,''), 'מנהל'), 'admin');
  return v_id;
end $$;

-- Admin opens a short window and reads out the code. Codes are single use and
-- expire on their own, so a public repo never leaves a live door.
create or replace function public.open_pairing(p_minutes int default 10)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_hh    uuid := public.current_household_id();
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no O/0/I/1
  v_code  text := '';
  i       int;
begin
  if v_hh is null or not public.current_role_is('admin') then
    raise exception 'admin only';
  end if;

  for i in 1..8 loop
    v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
  end loop;

  update households
     set join_code = v_code,
         pairing_open_until = now() + make_interval(mins => greatest(1, least(p_minutes, 60)))
   where id = v_hh;
  return v_code;
end $$;

create or replace function public.close_pairing()
returns void
language plpgsql security definer set search_path = public
as $$
declare v_hh uuid := public.current_household_id();
begin
  if v_hh is null or not public.current_role_is('admin') then
    raise exception 'admin only';
  end if;
  update households set join_code = null, pairing_open_until = null where id = v_hh;
end $$;

create or replace function public.join_household(
  p_code text,
  p_name text,
  p_role member_role
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_hh uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;
  if public.current_household_id() is not null then
    raise exception 'already paired';
  end if;
  if p_role = 'admin' then
    raise exception 'cannot self-assign admin';
  end if;

  select id into v_hh from households
   where join_code = upper(trim(p_code))
     and pairing_open_until is not null
     and pairing_open_until > now();

  if v_hh is null then
    raise exception 'קוד לא תקין, או שחלון הצירוף נסגר';
  end if;

  insert into members (household_id, user_id, name, role)
    values (v_hh, auth.uid(), coalesce(nullif(p_name,''), 'משתמש'), p_role);

  -- Burn it the moment it works.
  update households set join_code = null, pairing_open_until = null where id = v_hh;
  return v_hh;
end $$;

-- ============================================================ quantities

-- Chooses the unit a person would say out loud.
--
-- Hebrew has natural words for quarters — רבע קילו, חצי קילו, קילו וחצי — so a
-- total lands in the larger unit whenever it falls on a quarter step, and stays
-- in the smaller one otherwise. 500g becomes "חצי קילו"; 300g stays "300 גרם",
-- because "0.3 קילו" is not something anyone says.
create or replace function public.display_quantity(p_base numeric, p_family text)
returns jsonb
language plpgsql stable set search_path = public
as $$
declare
  big_unit text; big_factor numeric;
  small_unit text; small_factor numeric;
  v numeric;
begin
  select unit, factor into big_unit, big_factor
    from units where family = p_family order by factor desc limit 1;
  select unit, factor into small_unit, small_factor
    from units where family = p_family order by factor asc limit 1;

  -- Counting families (units, packs, trays…) have a single member.
  if big_unit is null or big_unit = small_unit then
    return jsonb_build_object('value', round(p_base / coalesce(small_factor, 1), 3),
                              'unit', coalesce(small_unit, 'unit'));
  end if;

  v := p_base / big_factor;
  if v >= 0.25 and (v * 4) = floor(v * 4) then
    return jsonb_build_object('value', round(v, 3), 'unit', big_unit);
  end if;
  return jsonb_build_object('value', round(p_base / small_factor, 3), 'unit', small_unit);
end $$;

-- ============================================================ list building

-- The merge lives here, next to the data, instead of being reassembled in the
-- client every time. Same product from two recipes becomes one row; units only
-- combine inside their family, so incompatible ones survive side by side.
create or replace function public.build_list(
  p_recipe_ids uuid[],
  p_title      text default ''
) returns uuid
language plpgsql set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_order     text[];
  v_list      uuid;
  v_ids       uuid[] := coalesce(p_recipe_ids, '{}');
begin
  if v_household is null then
    raise exception 'not a member of any household';
  end if;

  select department_order into v_order from households where id = v_household;

  insert into lists (household_id, title, status, created_by)
  values (v_household,
          coalesce(nullif(p_title, ''), to_char(now(), 'DD/MM')),
          'draft', auth.uid())
  returning id into v_list;

  if array_length(v_ids, 1) > 0 then
    insert into list_recipes (list_id, recipe_id)
    select v_list, unnest(v_ids);

    with ing as (
      select ri.product_id, ri.quantity, ri.unit,
             r.id as recipe_id, r.name as recipe_name
      from recipe_ingredients ri
      join recipes r on r.id = ri.recipe_id
      where ri.recipe_id = any(v_ids)
        and r.household_id = v_household
    ),
    fam as (
      select i.*, u.family, u.factor
      from ing i join units u on u.unit = i.unit
    ),
    agg as (
      select product_id, family, sum(quantity * factor) as base
      from fam group by product_id, family
    ),
    qty as (
      select product_id, jsonb_agg(public.display_quantity(base, family)) as quantities
      from agg group by product_id
    ),
    src as (
      select product_id,
             jsonb_agg(distinct jsonb_build_object('id', recipe_id, 'name', recipe_name))
               as source_recipes
      from ing group by product_id
    )
    insert into list_items (
      list_id, household_id, product_id,
      name_snapshot, brand_snapshot, icon_snapshot, image_snapshot, department_key,
      quantities, source_recipes, sort_index
    )
    select v_list, v_household, p.id,
           p.name, p.brand, p.icon, p.image_url, p.department_key,
           qty.quantities,
           coalesce(src.source_recipes, '[]'::jsonb),
           coalesce(array_position(v_order, p.department_key), 999) * 1000
             + (row_number() over (partition by p.department_key order by p.name))::int
    from qty
    join products p on p.id = qty.product_id
    left join src on src.product_id = qty.product_id;

    update recipes
       set times_used = times_used + 1, last_used_at = now()
     where id = any(v_ids) and household_id = v_household;

    update products
       set usage_count = usage_count + 1
     where id in (select product_id from list_items
                  where list_id = v_list and product_id is not null);
  end if;

  return v_list;
end $$;

-- Anything not tied to a recipe: milk, toilet paper, or a whole quick list.
create or replace function public.add_list_item(
  p_list_id    uuid,
  p_product_id uuid,
  p_value      numeric,
  p_unit       text
) returns uuid
language plpgsql set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_order     text[];
  v_id        uuid;
begin
  if v_household is null then
    raise exception 'not a member of any household';
  end if;
  select department_order into v_order from households where id = v_household;

  insert into list_items (
    list_id, household_id, product_id,
    name_snapshot, brand_snapshot, icon_snapshot, image_snapshot, department_key,
    quantities, is_extra, sort_index
  )
  select p_list_id, v_household, p.id,
         p.name, p.brand, p.icon, p.image_url, p.department_key,
         jsonb_build_array(jsonb_build_object('value', p_value, 'unit', p_unit)),
         true,
         coalesce(array_position(v_order, p.department_key), 999) * 1000 + 500
  from products p
  where p.id = p_product_id and p.household_id = v_household
  returning id into v_id;

  update products set usage_count = usage_count + 1 where id = p_product_id;
  return v_id;
end $$;

-- ============================================================ offline-safe writes

-- Every status change from Dad's phone lands here.
--
-- The ordering guard only applies to writes from the *same* device: one phone's
-- own queued updates must never arrive out of order, but comparing timestamps
-- across two phones would mean the one with the slower clock quietly loses.
-- Two people editing the same item is not a real scenario here; a phone with a
-- skewed clock is.
--
-- Returns whether it actually applied, so a rejected write is visible to the
-- caller instead of looking exactly like success.
create or replace function public.apply_item_update(
  p_item      uuid,
  p_patch     jsonb,
  p_client_ts timestamptz
) returns boolean
language plpgsql set search_path = public
as $$
declare
  v_applied int;
begin
  update list_items li
     set status = coalesce((p_patch->>'status')::item_status, li.status),
         substitute_note = coalesce(p_patch->>'substitute_note', li.substitute_note),
         substitute_image_url =
           coalesce(p_patch->>'substitute_image_url', li.substitute_image_url),
         planner_reply = coalesce(p_patch->>'planner_reply', li.planner_reply),
         bought_at = case
           when (p_patch->>'status') = 'bought' then coalesce(li.bought_at, p_client_ts)
           when (p_patch->>'status') is not null then null
           else li.bought_at
         end,
         updated_by = auth.uid(),
         updated_at = now(),
         client_updated_at = p_client_ts
   where li.id = p_item
     and (li.updated_by is distinct from auth.uid()   -- another device: apply
          or p_client_ts >= li.client_updated_at);    -- same device: no going back

  get diagnostics v_applied = row_count;
  return v_applied > 0;
end $$;

create or replace function public.set_list_status(p_list uuid, p_status list_status)
returns void
language plpgsql set search_path = public
as $$
begin
  update lists
     set status  = p_status,
         sent_at = case when p_status = 'sent'  then coalesce(sent_at, now()) else sent_at end,
         done_at = case when p_status = 'done'  then now() else done_at end
   where id = p_list and household_id = public.current_household_id();
end $$;

-- ============================================================ learned aisle order

-- Nobody knows Dad's route through the store, and nobody should have to.
-- Every bought item is timestamped, so after a few trips the order he actually
-- walks is simply readable from the data.
create or replace function public.suggested_department_order(p_trips int default 3)
returns text[]
language plpgsql stable set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_current   text[];
  v_observed  text[];
  v_result    text[];
  d           text;
begin
  if v_household is null then return null; end if;
  select department_order into v_current from households where id = v_household;

  with recent as (
    select id from lists
    where household_id = v_household and status = 'done'
    order by done_at desc nulls last
    limit greatest(1, p_trips)
  ),
  touched as (
    select li.list_id, li.department_key, min(li.bought_at) as first_touch
    from list_items li
    join recent on recent.id = li.list_id
    where li.bought_at is not null
    group by li.list_id, li.department_key
  ),
  per_list as (
    select department_key,
           row_number() over (partition by list_id order by first_touch) as rnk
    from touched
  )
  select array_agg(department_key order by avg_rank)
    into v_observed
  from (select department_key, avg(rnk) as avg_rank
        from per_list group by department_key) s;

  if v_observed is null then return v_current; end if;

  -- Observed departments in the order he walks them, then everything he did
  -- not buy from this time, keeping their existing relative order.
  v_result := v_observed;
  foreach d in array v_current loop
    if not (d = any(v_observed)) then
      v_result := v_result || d;
    end if;
  end loop;
  return v_result;
end $$;

create or replace function public.completed_trip_count()
returns int
language sql stable set search_path = public
as $$
  select count(*)::int from lists
  where household_id = public.current_household_id() and status = 'done'
$$;

-- Dad reorders from inside the shopping screen, where the mistake is felt.
create or replace function public.set_department_order(p_order text[])
returns void
language plpgsql security definer set search_path = public
as $$
declare v_hh uuid := public.current_household_id();
begin
  if v_hh is null then
    raise exception 'not a member';
  end if;
  if not (public.current_role_is('shopper') or public.current_role_is('admin')) then
    raise exception 'not allowed';
  end if;
  update households set department_order = p_order where id = v_hh;
end $$;

-- ============================================================ grants

grant execute on function
  public.create_household(text, text),
  public.open_pairing(int),
  public.close_pairing(),
  public.join_household(text, text, member_role),
  public.current_household_id(),
  public.current_role_is(member_role),
  public.display_quantity(numeric, text),
  public.build_list(uuid[], text),
  public.add_list_item(uuid, uuid, numeric, text),
  public.apply_item_update(uuid, jsonb, timestamptz),
  public.set_list_status(uuid, list_status),
  public.suggested_department_order(int),
  public.completed_trip_count(),
  public.set_department_order(text[])
to authenticated;
