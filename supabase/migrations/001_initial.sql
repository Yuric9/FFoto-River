-- FFOTO RIVER - SCHEMA COMPLETO
create extension if not exists "uuid-ossp";

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  date date not null,
  location text,
  price_unit decimal(10,2) not null default 10.00,
  price_pack decimal(10,2) not null default 8.00,
  pack_min_qty int not null default 10,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists photos (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade not null,
  original_path text not null,
  preview_path text not null,
  filename text not null,
  is_available boolean default true,
  created_at timestamptz default now()
);
create index if not exists idx_photos_event on photos(event_id);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) not null,
  customer_name text not null,
  customer_email text not null,
  customer_whatsapp text not null,
  photo_count int not null,
  total_amount decimal(10,2) not null,
  status text not null default 'pending' check (status in ('pending','paid','expired','cancelled')),
  pix_txid text unique,
  pix_qrcode text,
  download_token text unique not null default encode(gen_random_bytes(32), 'hex'),
  paid_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  photo_id uuid references photos(id) not null,
  price_paid decimal(10,2) not null,
  unique(order_id, photo_id)
);

-- Storage buckets
insert into storage.buckets (id, name, public) values ('originais', 'originais', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('provas', 'provas', true) on conflict (id) do nothing;

-- RLS
alter table events enable row level security;
alter table photos enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "public can view active events" on events;
create policy "public can view active events" on events for select using (is_active = true);

drop policy if exists "public can view available photos" on photos;
create policy "public can view available photos" on photos for select using (is_available = true);

drop policy if exists "service_role full access orders" on orders;
create policy "service_role full access orders" on orders for all using (auth.role() = 'service_role');

drop policy if exists "service_role full access items" on order_items;
create policy "service_role full access items" on order_items for all using (auth.role() = 'service_role');

-- View dashboard
create or replace view sales_dashboard as
select 
  e.id as event_id,
  e.title,
  e.slug,
  count(distinct o.id) filter (where o.status = 'paid') as pedidos_pagos,
  coalesce(sum(o.total_amount) filter (where o.status = 'paid'),0) as faturado,
  coalesce(sum(o.photo_count) filter (where o.status = 'paid'),0) as fotos_vendidas
from events e
left join orders o on o.event_id = e.id
group by e.id;