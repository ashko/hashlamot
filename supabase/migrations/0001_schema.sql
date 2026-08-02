-- השלמות — schema
-- One household, three members: admin (you), planner (Mom), shopper (Dad).

create extension if not exists pgcrypto;

create type item_status  as enum ('pending', 'bought', 'missing', 'substituted');
create type member_role  as enum ('planner', 'shopper', 'admin');
create type list_status   as enum ('draft', 'sent', 'shopping', 'done');

-- ---------------------------------------------------------------- households

create table households (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  -- Pairing is closed by default. The repo is public, so a permanently-live
  -- join code would be the one guessable way in. The admin opens a short
  -- window when setting up a device, and it shuts again on its own.
  join_code          text,
  pairing_open_until timestamptz,
  department_order   text[] not null default array[
    'produce','bakery','deli','butcher','dairy','canned','grains',
    'spices','oils','snacks','drinks','frozen','cleaning','pharma','other'
  ],
  created_at         timestamptz not null default now()
);

create unique index households_join_code_idx
  on households (join_code) where join_code is not null;

create table members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  role         member_role not null,
  text_scale   text not null default 'large',   -- normal | large | xlarge
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);
create index members_user_idx on members (user_id);

-- ---------------------------------------------------------------- reference

-- Units only ever combine inside a family. Each count-style unit is its own
-- family so "3 units" and "2 packs" never silently merge into one number.
create table units (
  unit     text primary key,
  family   text not null,
  factor   numeric not null,
  label_he text not null
);

insert into units (unit, family, factor, label_he) values
  ('kg',    'mass',        1000, 'ק״ג'),
  ('g',     'mass',           1, 'גרם'),
  ('l',     'volume',      1000, 'ליטר'),
  ('ml',    'volume',         1, 'מ״ל'),
  ('unit',  'count_unit',     1, 'יחידות'),
  ('pack',  'count_pack',     1, 'חבילות'),
  ('box',   'count_box',      1, 'קופסאות'),
  ('bunch', 'count_bunch',    1, 'צרורות'),
  ('bag',   'count_bag',      1, 'שקיות'),
  ('tray',  'count_tray',     1, 'תבניות'),
  ('bottle','count_bottle',   1, 'בקבוקים'),
  ('can',   'count_can',      1, 'פחיות');

create table departments (
  key      text primary key,
  name_he  text not null,
  icon     text not null,
  position int  not null
);

insert into departments (key, name_he, icon, position) values
  ('produce',  'פירות וירקות',            '🥬',  1),
  ('bakery',   'מאפייה ולחמים',           '🥖',  2),
  ('deli',     'גבינות ומעדנייה',         '🧀',  3),
  ('butcher',  'בשר, עוף ודגים',          '🍗',  4),
  ('dairy',    'חלב וביצים',              '🥛',  5),
  ('canned',   'שימורים ומזון יבש',       '🥫',  6),
  ('grains',   'אורז, פסטה וקטניות',      '🍚',  7),
  ('spices',   'תבלינים, אפייה וסוכר',    '🧂',  8),
  ('oils',     'שמן, רטבים וממרחים',      '🫒',  9),
  ('snacks',   'חטיפים ומתוקים',          '🍫', 10),
  ('drinks',   'משקאות, קפה ותה',         '☕', 11),
  ('frozen',   'קפואים',                  '🧊', 12),
  ('cleaning', 'ניקיון, כביסה וחד״פ',     '🧻', 13),
  ('pharma',   'טואלטיקה ופארם',          '🧴', 14),
  ('other',    'שונות',                   '📦', 15);

-- ---------------------------------------------------------------- catalog

create table products (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households on delete cascade,
  name          text not null,
  brand         text not null default '',
  -- Seed products carry an emoji, not a sourced photo. Real photos accumulate
  -- from their own camera, only where the variant actually matters.
  icon          text not null default '📦',
  image_url     text,
  department_key text not null references departments (key),
  default_unit  text not null references units (unit) default 'unit',
  default_qty   numeric not null default 1,
  aliases       text[] not null default '{}',
  usage_count   int  not null default 0,
  is_seed       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index products_household_idx on products (household_id);
-- Ranked by what she actually buys, not alphabetically. This is the only index
-- the app needs: the catalog is a few hundred rows, so it is loaded once and
-- searched in the browser, which is also what makes search work with no signal.
create index products_usage_idx on products (household_id, usage_count desc);

-- ---------------------------------------------------------------- recipes

create table recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name         text not null,
  icon         text not null default '🍽️',
  image_url    text,
  note         text not null default '',
  times_used   int not null default 0,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);
create index recipes_household_idx on recipes (household_id);

create table recipe_ingredients (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references recipes on delete cascade,
  product_id uuid not null references products on delete restrict,
  quantity   numeric not null default 1,
  unit       text not null references units (unit),
  note       text not null default '',
  position   int not null default 0
);
create index recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);

-- ---------------------------------------------------------------- lists

create table lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  title        text not null,
  status       list_status not null default 'draft',
  created_by   uuid references auth.users,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  done_at      timestamptz
);
create index lists_household_idx on lists (household_id, created_at desc);

create table list_recipes (
  list_id   uuid references lists on delete cascade,
  recipe_id uuid references recipes on delete cascade,
  primary key (list_id, recipe_id)
);

create table list_items (
  id             uuid primary key default gen_random_uuid(),
  list_id        uuid not null references lists on delete cascade,
  household_id   uuid not null references households on delete cascade,
  product_id     uuid references products on delete set null,

  -- Snapshots, not lookups. Renaming a product next month must not rewrite
  -- what last month's list said.
  name_snapshot  text not null,
  brand_snapshot text not null default '',
  icon_snapshot  text not null default '📦',
  image_snapshot text,
  department_key text not null references departments (key),

  quantities     jsonb not null default '[]',  -- [{"value":1.5,"unit":"kg"}]
  source_recipes jsonb not null default '[]',  -- [{"id":"…","name":"שניצל"}]
  is_extra       boolean not null default false,
  sort_index     int not null default 0,

  status               item_status not null default 'pending',
  substitute_note      text not null default '',
  substitute_image_url text,
  planner_reply        text not null default '',

  bought_at         timestamptz,   -- feeds the learned aisle order
  updated_by        uuid references auth.users,
  updated_at        timestamptz not null default now(),
  -- Ordering guard for offline writes, compared against the *client's* clock.
  -- It starts at epoch on purpose: defaulting to now() stamped every new row
  -- with server time, so a phone running even a minute slow had its first
  -- marks rejected — silently, which is the worst way to lose them.
  client_updated_at timestamptz not null default 'epoch'
);
create index list_items_list_idx on list_items (list_id, sort_index);

-- ---------------------------------------------------------------- push

create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  household_id uuid not null references households on delete cascade,
  endpoint     text unique not null,
  p256dh       text not null,
  auth         text not null,
  created_at   timestamptz not null default now()
);

-- Realtime: Dad's screen and Mom's tracking both follow list_items.
-- Guarded so re-running the file is not an error.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'list_items') then
    alter publication supabase_realtime add table list_items;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'lists') then
    alter publication supabase_realtime add table lists;
  end if;
end $$;
