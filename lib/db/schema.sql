-- Velmère production persistence preparation for Supabase/Postgres.
-- Run this in Supabase SQL editor when you are ready to replace demo fallback data.

create table if not exists public.velmere_square_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  locale text not null default 'en',
  title text not null,
  body text not null,
  author_name text not null,
  author_handle text not null,
  author_type text not null default 'community',
  image_url text,
  tags text[] not null default '{}',
  views integer not null default 0,
  likes integer not null default 0,
  comments_count integer not null default 0,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  created_at_label text
);

create table if not exists public.velmere_square_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.velmere_square_posts(id) on delete cascade,
  author_name text not null,
  body text not null,
  moderation_status text not null default 'pending',
  created_at timestamptz not null default now(),
  created_at_label text
);

-- Profile rows must be keyed by the authenticated session/user id; do not mutate a shared default profile in production.
create table if not exists public.velmere_profiles (
  id text primary key,
  display_name text not null default 'Velmère Member',
  handle text not null default 'velmere.member',
  bio text not null default '',
  last_name_change timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.velmere_square_posts enable row level security;
alter table public.velmere_square_comments enable row level security;
alter table public.velmere_profiles enable row level security;

drop policy if exists "Public can read approved Velmere Square posts" on public.velmere_square_posts;
drop policy if exists "Public can read visible Velmere Square comments" on public.velmere_square_comments;
drop policy if exists "Public can read approved Velmere Square comments" on public.velmere_square_comments;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_square_posts' and policyname = 'Public can read approved Velmere Square posts') then
    create policy "Public can read approved Velmere Square posts"
      on public.velmere_square_posts for select
      to anon, authenticated
      using (moderation_status = 'approved');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_square_comments' and policyname = 'Public can read approved Velmere Square comments') then
    create policy "Public can read approved Velmere Square comments"
      on public.velmere_square_comments for select
      to anon, authenticated
      using (moderation_status = 'approved');
  end if;
end $$;

-- Production commerce order persistence.
create table if not exists public.velmere_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  status text not null default 'checkout_completed',
  locale text not null default 'en',
  wallet_address text,
  currency text,
  amount_total integer not null default 0,
  amount_subtotal integer,
  amount_tax integer,
  customer_email text,
  customer_name text,
  customer_phone text,
  customer_details jsonb,
  shipping_details jsonb,
  billing_details jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.velmere_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.velmere_orders(id) on delete cascade,
  line_index integer not null default 0,
  product_id text not null,
  variant_id text,
  selected_size text,
  quantity integer not null default 1,
  title text,
  unit_amount integer,
  currency text,
  provider text,
  provider_variant_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(order_id, line_index)
);

alter table public.velmere_orders enable row level security;
alter table public.velmere_order_items enable row level security;

create index if not exists velmere_orders_stripe_session_id_idx on public.velmere_orders(stripe_session_id);
create index if not exists velmere_orders_customer_email_idx on public.velmere_orders(customer_email);
create index if not exists velmere_order_items_order_id_idx on public.velmere_order_items(order_id);


-- Stripe webhook idempotency ledger. Keep RLS enabled and use only server/service-role writes.
create table if not exists public.velmere_stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.velmere_stripe_webhook_events enable row level security;
create index if not exists velmere_stripe_webhook_events_processed_at_idx on public.velmere_stripe_webhook_events(processed_at);

-- PASS2025: server-side paid VLM service entitlements.
-- These rows are created by Stripe webhooks or checkout verification after payment_status=paid.
create table if not exists public.velmere_vlm_paid_entitlements (
  id text primary key,
  stripe_session_id text not null,
  stripe_customer_id text,
  product_id text not null,
  access_scope text not null,
  status text not null default 'active',
  context_hash text not null,
  context jsonb not null default '{}'::jsonb,
  locale text not null default 'en',
  amount_total integer,
  currency text,
  customer_email text,
  customer_name text,
  payment_status text,
  source text not null default 'stripe_webhook',
  audit_queue_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stripe_session_id, product_id, context_hash)
);

create table if not exists public.velmere_vlm_audit_human_queue (
  id text primary key,
  entitlement_id text references public.velmere_vlm_paid_entitlements(id) on delete set null,
  stripe_session_id text unique not null,
  status text not null default 'analysis_queue',
  locale text not null default 'en',
  project_name text,
  asset_id text,
  request_id text,
  customer_email text,
  context jsonb not null default '{}'::jsonb,
  private_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.velmere_vlm_paid_entitlements enable row level security;
alter table public.velmere_vlm_audit_human_queue enable row level security;

alter table public.velmere_vlm_paid_entitlements add column if not exists audit_queue_id text;
create index if not exists velmere_vlm_paid_entitlements_session_idx on public.velmere_vlm_paid_entitlements(stripe_session_id);
create index if not exists velmere_vlm_paid_entitlements_context_idx on public.velmere_vlm_paid_entitlements(product_id, context_hash, status);
create index if not exists velmere_vlm_paid_entitlements_customer_idx on public.velmere_vlm_paid_entitlements(customer_email);
create index if not exists velmere_vlm_audit_human_queue_status_idx on public.velmere_vlm_audit_human_queue(status, updated_at);

-- ============================================================================
-- PASS2073-2074 TOPKA FOUNDATION: production catalog/admin/order/security schema
-- ============================================================================
-- This block is idempotent. It is the production truth backbone for Velmère.
-- Use Supabase/Postgres service-role only on server routes. Public clients should
-- read only redacted customer-safe views or API responses.

create table if not exists public.velmere_products (
  id text primary key,
  slug text unique not null,
  provider text not null default 'manual',
  provider_product_id text,
  status text not null default 'draft',
  fulfilment_mode text not null default 'disabled',
  title jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  short_description jsonb not null default '{}'::jsonb,
  truth jsonb,
  price_amount integer not null default 0,
  price_currency text not null default 'EUR',
  images jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  collection text,
  is_vlm_locked boolean not null default false,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_products_status_check check (status in ('draft','coming_soon','active','sold_out','archived','vlm_locked')),
  constraint velmere_products_provider_check check (provider in ('manual','printful','tapstitch','external')),
  constraint velmere_products_fulfilment_mode_check check (fulfilment_mode in ('disabled','external_link','manual','automatic')),
  constraint velmere_products_currency_check check (price_currency = 'EUR')
);

create table if not exists public.velmere_product_variants (
  id text primary key,
  product_id text not null references public.velmere_products(id) on delete cascade,
  title text not null,
  size text,
  color text,
  sku text,
  provider_variant_id text,
  provider_status text not null default 'unknown',
  stock_quantity integer,
  price_amount integer,
  price_currency text not null default 'EUR',
  available boolean,
  raw_provider_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_product_variants_provider_status_check check (provider_status in ('synced','unsynced','unknown')),
  constraint velmere_product_variants_currency_check check (price_currency = 'EUR')
);

create table if not exists public.velmere_product_publication_state (
  product_id text primary key references public.velmere_products(id) on delete cascade,
  slug text,
  final_status text not null,
  customer_visibility text not null default 'preview',
  readiness_score integer not null default 0,
  readiness_snapshot jsonb not null default '{}'::jsonb,
  batch_trace_id text not null,
  idempotency_key text,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint velmere_product_publication_state_status_check check (final_status in ('draft','coming_soon','active','sold_out','archived','vlm_locked')),
  constraint velmere_product_publication_state_visibility_check check (customer_visibility in ('hidden','preview','purchasable'))
);

create table if not exists public.velmere_product_brain_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text references public.velmere_products(id) on delete cascade,
  draft_id text,
  ai_result jsonb not null default '{}'::jsonb,
  operator_patch jsonb not null default '{}'::jsonb,
  final_result jsonb not null default '{}'::jsonb,
  readiness_score integer not null default 0,
  status text not null default 'review',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_product_brain_reviews_status_check check (status in ('draft','review','approved','blocked','published'))
);

create table if not exists public.velmere_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.velmere_orders(id) on delete cascade,
  order_public_id text,
  event_type text not null,
  severity text not null default 'info',
  source text not null default 'system',
  message text not null,
  redacted_payload jsonb not null default '{}'::jsonb,
  receipt_id text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  constraint velmere_order_events_severity_check check (severity in ('info','warning','error','critical'))
);

create table if not exists public.velmere_fulfilment_retry_queue (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.velmere_orders(id) on delete set null,
  provider text not null,
  action text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_message text,
  redacted_payload jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_fulfilment_retry_queue_status_check check (status in ('queued','running','succeeded','failed','discarded','blocked'))
);

create table if not exists public.velmere_fulfilment_incidents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.velmere_orders(id) on delete set null,
  retry_queue_id uuid references public.velmere_fulfilment_retry_queue(id) on delete set null,
  status text not null default 'open',
  severity text not null default 'warning',
  assigned_role text not null default 'operator',
  incident_type text not null,
  decision text,
  operator_note text,
  support_packet jsonb not null default '{}'::jsonb,
  redacted_snapshot jsonb not null default '{}'::jsonb,
  receipt_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_fulfilment_incidents_status_check check (status in ('open','in_review','resolved','escalated','blocked')),
  constraint velmere_fulfilment_incidents_severity_check check (severity in ('info','warning','error','critical'))
);

create table if not exists public.velmere_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_role text,
  action text not null,
  target_type text not null,
  target_id text,
  redacted_payload jsonb not null default '{}'::jsonb,
  request_id text,
  receipt_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.velmere_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  actor_email text,
  role text not null default 'viewer',
  session_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint velmere_admin_sessions_role_check check (role in ('owner','operator','support','viewer'))
);

create table if not exists public.velmere_admin_roles (
  actor_id text primary key,
  actor_email text unique,
  role text not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_admin_roles_role_check check (role in ('owner','operator','support','viewer')),
  constraint velmere_admin_roles_status_check check (status in ('active','disabled'))
);

create table if not exists public.velmere_source_receipts (
  id text primary key,
  source_type text not null,
  source_name text not null,
  target_type text not null,
  target_id text not null,
  method_version text not null,
  captured_at timestamptz not null default now(),
  freshness_seconds integer,
  confidence numeric(5,2),
  redacted_evidence jsonb not null default '{}'::jsonb,
  checksum text not null
);

create table if not exists public.velmere_provider_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_product_id text,
  provider_variant_id text,
  status text not null default 'captured',
  reliability_score integer not null default 0,
  stock_certainty integer not null default 0,
  mapping_completeness integer not null default 0,
  redacted_snapshot jsonb not null default '{}'::jsonb,
  raw_payload_hash text,
  captured_at timestamptz not null default now(),
  constraint velmere_provider_snapshots_provider_check check (provider in ('printful','tapstitch','manual','external'))
);

alter table public.velmere_products enable row level security;
alter table public.velmere_product_variants enable row level security;
alter table public.velmere_product_publication_state enable row level security;
alter table public.velmere_product_brain_reviews enable row level security;
alter table public.velmere_order_events enable row level security;
alter table public.velmere_fulfilment_retry_queue enable row level security;
alter table public.velmere_fulfilment_incidents enable row level security;
alter table public.velmere_audit_logs enable row level security;
alter table public.velmere_admin_sessions enable row level security;
alter table public.velmere_admin_roles enable row level security;
alter table public.velmere_source_receipts enable row level security;
alter table public.velmere_provider_snapshots enable row level security;

create index if not exists velmere_products_status_idx on public.velmere_products(status, updated_at desc);
create index if not exists velmere_product_variants_product_id_idx on public.velmere_product_variants(product_id);
create index if not exists velmere_product_publication_state_status_idx on public.velmere_product_publication_state(final_status, updated_at desc);
create index if not exists velmere_product_brain_reviews_product_idx on public.velmere_product_brain_reviews(product_id, updated_at desc);
create index if not exists velmere_order_events_order_idx on public.velmere_order_events(order_id, created_at desc);
create index if not exists velmere_fulfilment_retry_queue_status_idx on public.velmere_fulfilment_retry_queue(status, next_attempt_at);
create index if not exists velmere_fulfilment_incidents_status_idx on public.velmere_fulfilment_incidents(status, updated_at desc);
create index if not exists velmere_audit_logs_target_idx on public.velmere_audit_logs(target_type, target_id, created_at desc);
create index if not exists velmere_source_receipts_target_idx on public.velmere_source_receipts(target_type, target_id, captured_at desc);
create index if not exists velmere_provider_snapshots_provider_idx on public.velmere_provider_snapshots(provider, captured_at desc);


-- ============================================================================
-- PASS2075-2079 TOPKA TRUTH: durable order, webhook, provider sandbox backbone
-- ============================================================================
-- These tables are server-only. They store redacted operational state, not raw
-- customer PII, raw provider payloads, or secrets.

create table if not exists public.velmere_order_drafts (
  id text primary key,
  status text not null default 'draft',
  locale text not null default 'en',
  cart_hash text not null,
  expected_amount_total bigint not null,
  expected_currency text not null,
  stripe_session_id text unique,
  stripe_livemode boolean,
  stripe_payment_intent_id text,
  wallet_fingerprint text,
  line_items jsonb not null default '[]'::jsonb,
  guard_summary jsonb not null default '{}'::jsonb,
  replay_snapshot jsonb not null default '{}'::jsonb,
  source_route text not null default 'unknown',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_order_drafts_status_check check (status in ('draft','checkout_started','paid','fulfilment_pending','manual_fulfilment_required','fulfilment_created','fulfilled','cancelled','failed','refunded')),
  constraint velmere_order_drafts_expected_amount_check check (expected_amount_total >= 0),
  constraint velmere_order_drafts_expected_currency_check check (expected_currency ~ '^[A-Z]{3}$')
);

create table if not exists public.velmere_order_state_events (
  id uuid primary key default gen_random_uuid(),
  order_draft_id text not null references public.velmere_order_drafts(id) on delete cascade,
  event_type text not null,
  status_before text,
  status_after text,
  stripe_session_id text,
  stripe_event_id text,
  provider text,
  provider_order_id text,
  severity text not null default 'info',
  source_route text not null,
  idempotency_key text unique,
  redacted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint velmere_order_state_events_severity_check check (severity in ('info','review','warning','error','critical'))
);

create table if not exists public.velmere_provider_contracts (
  id text primary key,
  provider text not null,
  mode text not null default 'sandbox',
  capabilities text[] not null default '{}',
  required_env text[] not null default '{}',
  status text not null default 'contract_ready',
  redacted_config jsonb not null default '{}'::jsonb,
  method_version text not null default 'velmere.provider-contract.v1',
  updated_at timestamptz not null default now(),
  constraint velmere_provider_contracts_provider_check check (provider in ('printful','tapstitch','manual')),
  constraint velmere_provider_contracts_mode_check check (mode in ('sandbox','live','disabled'))
);

create table if not exists public.velmere_provider_sandbox_runs (
  id text primary key,
  provider text not null,
  order_draft_id text,
  status text not null,
  can_execute boolean not null default false,
  reason_codes text[] not null default '{}',
  redacted_request jsonb not null default '{}'::jsonb,
  redacted_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint velmere_provider_sandbox_runs_provider_check check (provider in ('printful','tapstitch','manual')),
  constraint velmere_provider_sandbox_runs_status_check check (status in ('ready','blocked','executed','failed','skipped'))
);

alter table public.velmere_order_drafts enable row level security;
alter table public.velmere_order_state_events enable row level security;
alter table public.velmere_provider_contracts enable row level security;
alter table public.velmere_provider_sandbox_runs enable row level security;

create index if not exists velmere_order_drafts_status_idx on public.velmere_order_drafts(status, updated_at desc);
create index if not exists velmere_order_drafts_stripe_session_idx on public.velmere_order_drafts(stripe_session_id);
create unique index if not exists velmere_order_drafts_payment_intent_idx on public.velmere_order_drafts(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create index if not exists velmere_order_state_events_order_idx on public.velmere_order_state_events(order_draft_id, created_at desc);
create index if not exists velmere_provider_contracts_provider_idx on public.velmere_provider_contracts(provider, updated_at desc);
create index if not exists velmere_provider_sandbox_runs_provider_idx on public.velmere_provider_sandbox_runs(provider, created_at desc);


-- ============================================================================
-- PASS2080-2084 TOPKA SECURITY/OPERATOR: admin sessions, audit, rate, incidents
-- ============================================================================
create table if not exists public.velmere_write_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  profile text not null,
  actor_id text,
  client_fingerprint text not null,
  decision text not null,
  limit_count integer not null,
  remaining integer not null,
  reset_at timestamptz not null,
  mode text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.velmere_overlay_qa_receipts (
  id text primary key,
  surface_id text not null,
  surface_type text not null,
  scroll_lock boolean not null default true,
  focus_trap boolean not null default true,
  esc_close boolean not null default true,
  outside_close boolean not null default true,
  reduced_motion_respected boolean not null default true,
  mobile_viewport_safe boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.velmere_write_rate_limit_events enable row level security;
alter table public.velmere_overlay_qa_receipts enable row level security;
create index if not exists velmere_write_rate_limit_events_route_idx on public.velmere_write_rate_limit_events(route, created_at desc);
create index if not exists velmere_overlay_qa_receipts_surface_idx on public.velmere_overlay_qa_receipts(surface_id, created_at desc);

-- PASS2083 public incident case id for deterministic support-safe upsert.
alter table public.velmere_fulfilment_incidents add column if not exists case_id text;
create unique index if not exists velmere_fulfilment_incidents_case_id_idx on public.velmere_fulfilment_incidents(case_id);

-- PASS2223 operator reminder: production Advanced must fail closed.
-- Apply supabase/migrations/20260618000001_2223_advanced_entitlement_fail_closed.sql before paid launch.

-- PASS2360: Audit Watch account-message delivery spine.
-- Stores Basic/Advanced audit status messages that are visible in the customer account.
-- Email sending is intentionally marked as pending unless a real mail provider is connected.
create table if not exists public.velmere_audit_account_messages (
  id text primary key,
  message_id text unique not null,
  request_id text not null,
  account_id text not null default 'preview:local-member-preview',
  contact_email text,
  locale text not null default 'en',
  review_level text,
  project_name text,
  contract_address text,
  package_label text not null,
  message_status text not null default 'queued',
  delivery_channel text not null default 'account',
  delivery_status text not null default 'delivered_to_account',
  operator_status text not null default 'intake',
  operator_note text,
  pdf_route text,
  customer_safe_report jsonb not null default '{}'::jsonb,
  action_log jsonb not null default '[]'::jsonb,
  delivered_at timestamptz,
  public_report_route text,
  admin_route text,
  export_route text,
  message jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_audit_account_messages_locale_check check (locale in ('pl','en','de')),
  constraint velmere_audit_account_messages_delivery_channel_check check (delivery_channel in ('account','account_and_email_pending')),
  constraint velmere_audit_account_messages_delivery_status_check check (delivery_status in ('queued','delivered_to_account','analysis_queue','ready_for_download')),
  constraint velmere_audit_account_messages_operator_status_check check (operator_status in ('intake','analysis_queue','automated_analysis','needs_evidence','pdf_attached','customer_safe_ready','delivered','blocked_redaction')),
  constraint velmere_audit_account_messages_message_status_check check (message_status in ('received','queued','analysis_queue','ready','needs_evidence'))
);

alter table public.velmere_audit_account_messages enable row level security;
create index if not exists velmere_audit_account_messages_account_idx on public.velmere_audit_account_messages(account_id, created_at desc);
create index if not exists velmere_audit_account_messages_contact_idx on public.velmere_audit_account_messages(contact_email, created_at desc);
create index if not exists velmere_audit_account_messages_request_idx on public.velmere_audit_account_messages(request_id);
create index if not exists velmere_audit_account_messages_delivery_idx on public.velmere_audit_account_messages(delivery_status, updated_at desc);


-- PASS2361: Operator actions and customer-safe audit report delivery.
alter table public.velmere_audit_account_messages add column if not exists operator_status text not null default 'intake';
alter table public.velmere_audit_account_messages add column if not exists operator_note text;
alter table public.velmere_audit_account_messages add column if not exists pdf_route text;
alter table public.velmere_audit_account_messages add column if not exists customer_safe_report jsonb not null default '{}'::jsonb;
alter table public.velmere_audit_account_messages add column if not exists action_log jsonb not null default '[]'::jsonb;
alter table public.velmere_audit_account_messages add column if not exists delivered_at timestamptz;
create index if not exists velmere_audit_account_messages_operator_status_idx on public.velmere_audit_account_messages(operator_status, updated_at desc);


-- PASS2363: Supabase Auth / Google login account spine.
-- Account rows and audit messages should use a stable account_id resolved from cookie/header/session,
-- not a shared local-member-preview bucket. Real Google OAuth remains fail-closed until provider secrets exist.
create table if not exists public.velmere_account_sessions (
  id text primary key,
  account_id text not null,
  provider text not null default 'preview',
  email text,
  display_name text not null default 'Velmère Member',
  handle text not null default '@velmere.member',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint velmere_account_sessions_provider_check check (provider in ('email','google_preview','preview','server'))
);

alter table public.velmere_account_sessions enable row level security;
create index if not exists velmere_account_sessions_account_idx on public.velmere_account_sessions(account_id, last_seen_at desc);
create index if not exists velmere_account_sessions_email_idx on public.velmere_account_sessions(email, last_seen_at desc);

alter table public.velmere_audit_account_messages alter column account_id set default 'preview:local-member-preview';
create index if not exists velmere_profiles_id_updated_idx on public.velmere_profiles(id, updated_at desc);

-- PASS2366: Durable payment evidence store for admin replay board.
-- Stores only operator-safe payment proof references and links them to auditQueueId/accountMessageId.
-- Never store raw Stripe payloads, raw Stripe-Signature headers, card data, BLIK codes, secrets, raw IPs or unredacted customer PII here.
create table if not exists public.velmere_payment_runtime_evidence (
  id text primary key,
  area text not null default 'release_gate',
  status text not null default 'manual',
  label text not null,
  summary text not null,
  evidence_ref text not null,
  operator_id text not null default 'security-admin',
  scenario_id text,
  audit_queue_id text,
  account_message_id text,
  account_id text,
  stripe_event_id text,
  stripe_session_id text,
  entitlement_id text,
  safe_notes text,
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_payment_runtime_evidence_area_check check (area in ('checkout','stripe_webhook','idempotency','order_persistence','fulfilment','refund_support','vlm_service','release_gate')),
  constraint velmere_payment_runtime_evidence_status_check check (status in ('pass','fail','manual','blocked'))
);

alter table public.velmere_payment_runtime_evidence enable row level security;
create index if not exists velmere_payment_runtime_evidence_status_idx on public.velmere_payment_runtime_evidence(status, created_at desc);
create index if not exists velmere_payment_runtime_evidence_area_idx on public.velmere_payment_runtime_evidence(area, created_at desc);
create index if not exists velmere_payment_runtime_evidence_scenario_idx on public.velmere_payment_runtime_evidence(scenario_id, created_at desc);
create index if not exists velmere_payment_runtime_evidence_audit_queue_idx on public.velmere_payment_runtime_evidence(audit_queue_id, created_at desc);
create index if not exists velmere_payment_runtime_evidence_account_message_idx on public.velmere_payment_runtime_evidence(account_message_id, created_at desc);
create index if not exists velmere_payment_runtime_evidence_account_idx on public.velmere_payment_runtime_evidence(account_id, created_at desc);

alter table public.velmere_audit_account_messages add column if not exists payment_evidence_refs jsonb not null default '[]'::jsonb;
alter table public.velmere_audit_account_messages add column if not exists audit_queue_id text;
create index if not exists velmere_audit_account_messages_audit_queue_idx on public.velmere_audit_account_messages(audit_queue_id, updated_at desc);

-- PASS2377: Final delivery immutable receipt ledger.
-- Written only after final-delivery gate passes. Customer-visible data is redacted.
create table if not exists public.velmere_audit_delivery_receipts (
  id text primary key,
  receipt_id text unique not null,
  status text not null default 'delivered',
  locale text not null default 'en',
  delivered_at timestamptz not null,
  operator_id text not null default 'security-admin',
  message_id text,
  request_id text,
  audit_queue_id text,
  account_message_id text,
  account_id text,
  report_id text,
  customer_safe_report_status text,
  gate_snapshot jsonb not null default '{}'::jsonb,
  customer_safe_links jsonb not null default '{}'::jsonb,
  checksum text not null,
  safe_boundary text not null,
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint velmere_audit_delivery_receipts_status_check check (status in ('delivered','blocked','manual_review')),
  constraint velmere_audit_delivery_receipts_locale_check check (locale in ('pl','en','de'))
);

alter table public.velmere_audit_delivery_receipts enable row level security;
create index if not exists velmere_audit_delivery_receipts_message_idx on public.velmere_audit_delivery_receipts(message_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_request_idx on public.velmere_audit_delivery_receipts(request_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_audit_queue_idx on public.velmere_audit_delivery_receipts(audit_queue_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_account_message_idx on public.velmere_audit_delivery_receipts(account_message_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_account_idx on public.velmere_audit_delivery_receipts(account_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_status_idx on public.velmere_audit_delivery_receipts(status, delivered_at desc);

-- PASS2469: Liquidation snapshot replay store for Advanced squeeze proof lineage.
-- Stores redacted, fingerprint-addressable replay records only. Do not store raw WebSocket payloads, raw IPs, customer PII, secrets, API keys, leverage instructions or trading instructions here.
create table if not exists public.velmere_liquidation_snapshot_replays (
  replay_id text primary key,
  symbol text not null,
  venue text not null,
  snapshot_id text not null,
  snapshot_fingerprint text not null,
  ledger_fingerprint text not null,
  replay_fingerprint text not null,
  state text not null default 'fresh',
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null,
  age_seconds integer not null default 0,
  max_age_seconds integer not null default 900,
  event_count integer not null default 0,
  long_liquidation_count integer not null default 0,
  short_liquidation_count integer not null default 0,
  dominant_side text not null default 'unknown',
  total_notional_usd numeric,
  largest_event_notional_usd numeric,
  source text not null default 'supabase',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_liquidation_snapshot_replays_state_check check (state in ('fresh','expired','invalid')),
  constraint velmere_liquidation_snapshot_replays_side_check check (dominant_side in ('long_liquidated','short_liquidated','mixed','unknown')),
  constraint velmere_liquidation_snapshot_replays_source_check check (source in ('memory','supabase','adapter_contract'))
);

alter table public.velmere_liquidation_snapshot_replays enable row level security;
create index if not exists velmere_liquidation_snapshot_replays_symbol_observed_idx on public.velmere_liquidation_snapshot_replays(symbol, observed_at desc);
create index if not exists velmere_liquidation_snapshot_replays_venue_observed_idx on public.velmere_liquidation_snapshot_replays(venue, observed_at desc);
create unique index if not exists velmere_liquidation_snapshot_replays_replay_fingerprint_idx on public.velmere_liquidation_snapshot_replays(replay_fingerprint);
create index if not exists velmere_liquidation_snapshot_replays_snapshot_fingerprint_idx on public.velmere_liquidation_snapshot_replays(snapshot_fingerprint);
create index if not exists velmere_liquidation_snapshot_replays_ledger_fingerprint_idx on public.velmere_liquidation_snapshot_replays(ledger_fingerprint);
create index if not exists velmere_liquidation_snapshot_replays_state_expires_idx on public.velmere_liquidation_snapshot_replays(state, expires_at desc);

-- PASS2473: Runtime receipt capture store for 180-output live proof.
-- Stores fingerprints only. Do not store raw screenshots, raw PDF bytes, raw API payload bodies, PII, secrets, wallet data, trading instructions or leverage instructions here.
create table if not exists public.velmere_tier_runtime_receipt_captures (
  receipt_id text primary key,
  receipt_key text unique not null,
  cell_id text not null,
  asset_symbol text not null,
  surface text not null,
  tier text not null,
  kind text not null,
  state text not null default 'captured',
  route_plan text not null,
  cell_fingerprint text not null,
  runtime_receipt_fingerprint text not null,
  captured_fingerprint text not null,
  content_fingerprint text not null,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  operator_id text not null default 'operator-runtime-capture',
  source text not null default 'manual_replay',
  redaction_boundary text not null,
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_tier_runtime_receipt_captures_surface_check check (surface in ('pdf','shield','real_markets')),
  constraint velmere_tier_runtime_receipt_captures_tier_check check (tier in ('basic','pro','advanced')),
  constraint velmere_tier_runtime_receipt_captures_kind_check check (kind in ('api_payload','browser_screenshot','pdf_hash','angel_replay')),
  constraint velmere_tier_runtime_receipt_captures_state_check check (state in ('captured','invalid')),
  constraint velmere_tier_runtime_receipt_captures_source_check check (source in ('api_payload','browser_screenshot','pdf_hash','angel_replay','manual_replay'))
);

alter table public.velmere_tier_runtime_receipt_captures enable row level security;
create index if not exists velmere_tier_runtime_receipt_captures_asset_idx on public.velmere_tier_runtime_receipt_captures(asset_symbol, received_at desc);
create index if not exists velmere_tier_runtime_receipt_captures_cell_idx on public.velmere_tier_runtime_receipt_captures(cell_id, received_at desc);
create index if not exists velmere_tier_runtime_receipt_captures_surface_tier_idx on public.velmere_tier_runtime_receipt_captures(surface, tier, received_at desc);
create unique index if not exists velmere_tier_runtime_receipt_captures_fingerprint_idx on public.velmere_tier_runtime_receipt_captures(captured_fingerprint);
create index if not exists velmere_tier_runtime_receipt_captures_runtime_fingerprint_idx on public.velmere_tier_runtime_receipt_captures(runtime_receipt_fingerprint);

-- PASS2474: Runtime receipt API payload runner audit log.
-- This records operator runner batches only. It must never be treated as browser/PDF/Angel live parity by itself.
create table if not exists public.velmere_tier_runtime_receipt_api_runner_batches (
  runner_fingerprint text primary key,
  query text not null,
  symbol text not null,
  mode text not null default 'capture_api_payload',
  planned_api_payload_receipt_count integer not null default 0,
  already_captured_api_payload_receipt_count integer not null default 0,
  captured_now_api_payload_receipt_count integer not null default 0,
  captured_after_run_api_payload_receipt_count integer not null default 0,
  api_payload_coverage_percent integer not null default 0,
  runtime_captured_coverage_percent_after_run integer not null default 0,
  completed_cell_count_after_run integer not null default 0,
  can_claim_180_live_outputs boolean not null default false,
  operator_id text not null default 'pass2474-api-payload-runner',
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_tier_runtime_receipt_api_runner_mode_check check (mode in ('dry_run','capture_api_payload')),
  constraint velmere_tier_runtime_receipt_api_runner_live_check check (can_claim_180_live_outputs = false or completed_cell_count_after_run = 180)
);

alter table public.velmere_tier_runtime_receipt_api_runner_batches enable row level security;
create index if not exists velmere_tier_runtime_receipt_api_runner_symbol_idx on public.velmere_tier_runtime_receipt_api_runner_batches(symbol, created_at desc);
create index if not exists velmere_tier_runtime_receipt_api_runner_coverage_idx on public.velmere_tier_runtime_receipt_api_runner_batches(api_payload_coverage_percent desc, created_at desc);


-- PASS2475: Runtime receipt browser screenshot runner audit log
create table if not exists velmere_tier_runtime_receipt_browser_runner_batches (
  id uuid primary key default gen_random_uuid(),
  runner_fingerprint text not null,
  symbol text not null,
  operator_id text not null default 'pass2475-browser-screenshot-runner',
  planned_browser_screenshot_receipt_count integer not null default 0,
  captured_now_browser_screenshot_receipt_count integer not null default 0,
  captured_after_run_browser_screenshot_receipt_count integer not null default 0,
  browser_screenshot_coverage_percent integer not null default 0,
  runtime_captured_coverage_percent_after_run integer not null default 0,
  can_claim_180_live_outputs boolean not null default false,
  storage_mode text not null default 'memory_fallback',
  created_at timestamptz not null default now()
);


-- PASS2476: Runtime receipt PDF hash runner audit log
-- This records operator PDF hash runner batches only. It must never be treated as browser/Angel live parity by itself.
create table if not exists velmere_tier_runtime_receipt_pdf_hash_runner_batches (
  id uuid primary key default gen_random_uuid(),
  runner_fingerprint text not null,
  symbol text not null,
  operator_id text not null default 'pass2476-pdf-hash-runner',
  planned_pdf_hash_receipt_count integer not null default 0,
  captured_now_pdf_hash_receipt_count integer not null default 0,
  captured_after_run_pdf_hash_receipt_count integer not null default 0,
  pdf_hash_coverage_percent integer not null default 0,
  runtime_captured_coverage_percent_after_run integer not null default 0,
  can_claim_180_live_outputs boolean not null default false,
  storage_mode text not null default 'memory_fallback',
  created_at timestamptz not null default now()
);

create index if not exists velmere_tier_runtime_receipt_pdf_hash_runner_symbol_idx on velmere_tier_runtime_receipt_pdf_hash_runner_batches(symbol, created_at desc);
create index if not exists velmere_tier_runtime_receipt_pdf_hash_runner_coverage_idx on velmere_tier_runtime_receipt_pdf_hash_runner_batches(pdf_hash_coverage_percent desc, created_at desc);


-- PASS2624: Supabase / RLS account delivery production lock.
-- Production account delivery fails closed without durable Supabase storage.
-- Do not store raw Stripe payloads, raw webhook bodies, raw download tokens,
-- service role keys, card data, BLIK codes, secrets, seed phrases, exploit steps,
-- Certified Safe claims, investment advice, operator notes or unredacted PII here.

alter table public.velmere_audit_account_messages enable row level security;
alter table public.velmere_audit_delivery_receipts enable row level security;

create table if not exists public.velmere_audit_report_access_tokens (
  id text primary key,
  token_hash text unique not null,
  state text not null default 'issued',
  scope text not null default 'pro_pdf_download',
  account_id text not null,
  report_id text not null,
  entitlement_id text not null,
  report_version_hash text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  consumed_by_receipt_id text,
  safe_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_audit_report_access_tokens_state_check check (state in ('issued','consumed','expired','revoked')),
  constraint velmere_audit_report_access_tokens_scope_check check (scope in ('pro_pdf_download','advanced_private_delivery','customer_report_view'))
);

alter table public.velmere_audit_report_access_tokens enable row level security;
create index if not exists velmere_audit_report_access_tokens_account_idx on public.velmere_audit_report_access_tokens(account_id, issued_at desc);
create index if not exists velmere_audit_report_access_tokens_report_idx on public.velmere_audit_report_access_tokens(report_id, issued_at desc);
create index if not exists velmere_audit_report_access_tokens_entitlement_idx on public.velmere_audit_report_access_tokens(entitlement_id, issued_at desc);
create index if not exists velmere_audit_report_access_tokens_state_idx on public.velmere_audit_report_access_tokens(state, expires_at desc);

alter table public.velmere_audit_delivery_receipts add column if not exists report_version_hash text;
alter table public.velmere_audit_delivery_receipts add column if not exists entitlement_id text;
alter table public.velmere_audit_delivery_receipts add column if not exists download_token_consumed_at timestamptz;
create index if not exists velmere_audit_delivery_receipts_entitlement_idx on public.velmere_audit_delivery_receipts(entitlement_id, delivered_at desc);
create index if not exists velmere_audit_delivery_receipts_version_idx on public.velmere_audit_delivery_receipts(report_version_hash, delivered_at desc);

-- Account owner select policy. Service-role writes stay server-only.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_audit_account_messages' and policyname = 'velmere_audit_account_messages_owner_select') then
    create policy velmere_audit_account_messages_owner_select
      on public.velmere_audit_account_messages
      for select
      using (
        account_id = coalesce(auth.jwt() ->> 'velmere_account_id', auth.uid()::text)
        or contact_email = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_audit_delivery_receipts' and policyname = 'velmere_audit_delivery_receipts_owner_select') then
    create policy velmere_audit_delivery_receipts_owner_select
      on public.velmere_audit_delivery_receipts
      for select
      using (account_id = coalesce(auth.jwt() ->> 'velmere_account_id', auth.uid()::text));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_audit_report_access_tokens' and policyname = 'velmere_audit_report_access_tokens_owner_select_redacted') then
    create policy velmere_audit_report_access_tokens_owner_select_redacted
      on public.velmere_audit_report_access_tokens
      for select
      using (account_id = coalesce(auth.jwt() ->> 'velmere_account_id', auth.uid()::text));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_audit_report_access_tokens' and policyname = 'velmere_audit_report_access_tokens_service_role_all') then
    create policy velmere_audit_report_access_tokens_service_role_all
      on public.velmere_audit_report_access_tokens
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- PASS4395: durable idempotency store contract.
-- Server-only mutation routes reserve key_hash before side effects.
-- Raw client request ids, raw emails, raw card data, secrets and request payloads must never be stored here.
create table if not exists public.velmere_idempotency_keys (
  key_hash text primary key,
  value_hash text not null,
  source text not null default 'pass4395_client_request_idempotency',
  first_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ttl_seconds integer not null default 86400,
  receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint velmere_idempotency_keys_ttl_check check (ttl_seconds between 60 and 604800)
);

alter table public.velmere_idempotency_keys enable row level security;
create index if not exists velmere_idempotency_keys_expires_at_idx on public.velmere_idempotency_keys(expires_at);
create index if not exists velmere_idempotency_keys_source_idx on public.velmere_idempotency_keys(source, first_seen_at desc);

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_idempotency_keys' and policyname = 'velmere_idempotency_keys_service_role_all') then
    create policy velmere_idempotency_keys_service_role_all
      on public.velmere_idempotency_keys
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- PASS4600: durable verified OHLC last-known-good snapshots.
-- Server-only service-role access. Public/anon clients receive no table policy.
-- The SHA-256 payload hash is recomputed before a cached chart is accepted.
create table if not exists public.velmere_kline_snapshots (
  snapshot_key text primary key,
  pair text not null,
  range text not null,
  source text not null,
  generated_at timestamptz not null,
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null,
  bar_count integer not null,
  payload_hash text not null,
  candles jsonb not null,
  updated_at timestamptz not null default now(),
  constraint velmere_kline_snapshots_bar_count_check check (bar_count between 8 and 1400),
  constraint velmere_kline_snapshots_payload_hash_check check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint velmere_kline_snapshots_pair_check check (char_length(pair) between 2 and 32),
  constraint velmere_kline_snapshots_range_check check (char_length(range) between 1 and 16),
  constraint velmere_kline_snapshots_expiry_check check (expires_at > stored_at)
);

alter table public.velmere_kline_snapshots enable row level security;
create index if not exists velmere_kline_snapshots_pair_range_idx on public.velmere_kline_snapshots(pair, range);
create index if not exists velmere_kline_snapshots_expires_at_idx on public.velmere_kline_snapshots(expires_at);

-- PASS6 kline hardening. Legacy rows remain nullable and are rejected by the
-- server until replaced by an exact-identity, source-timestamped signed row.
alter table public.velmere_kline_snapshots
  add column if not exists asset_identity jsonb,
  add column if not exists identity_digest text,
  add column if not exists received_at timestamptz,
  add column if not exists source_observations jsonb,
  add column if not exists latest_closed_at timestamptz,
  add column if not exists payload_mac text,
  add column if not exists integrity_mode text,
  add column if not exists integrity_key_id text;
create index if not exists velmere_kline_snapshots_identity_range_idx on public.velmere_kline_snapshots(identity_digest, range);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_identity_digest_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_identity_digest_check
      check (identity_digest is null or identity_digest ~ '^sha256:[a-f0-9]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_payload_mac_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_payload_mac_check
      check (payload_mac is null or payload_mac ~ '^[a-f0-9]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_integrity_mode_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_integrity_mode_check
      check (integrity_mode is null or integrity_mode in ('hmac_sha256', 'sha256_qa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_pass6_bundle_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_pass6_bundle_check check (
      (asset_identity is null and identity_digest is null and received_at is null and source_observations is null
        and latest_closed_at is null and payload_mac is null and integrity_mode is null and integrity_key_id is null)
      or
      (asset_identity is not null and identity_digest is not null and received_at is not null and source_observations is not null
        and latest_closed_at is not null and payload_mac is not null and integrity_mode is not null and integrity_key_id is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_asset_identity_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_asset_identity_check check (
      asset_identity is null or coalesce(
        jsonb_typeof(asset_identity) = 'object'
        and asset_identity ?& array['assetClass','marketId','symbol','quote','chainId','address']
        and asset_identity->>'assetClass' = 'crypto'
        and asset_identity->>'quote' = 'USD'
        and asset_identity->>'marketId' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        and char_length(asset_identity->>'marketId') between 1 and 96
        and asset_identity->>'symbol' ~ '^[A-Z0-9]{1,16}$'
        and jsonb_typeof(asset_identity->'chainId') in ('null','string')
        and jsonb_typeof(asset_identity->'address') in ('null','string')
        and (asset_identity->'address' = 'null'::jsonb or asset_identity->'chainId' <> 'null'::jsonb),
        false
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_source_observations_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_source_observations_check check (
      case when source_observations is null then true
        when jsonb_typeof(source_observations) = 'array' then jsonb_array_length(source_observations) between 2 and 8
        else false end
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'velmere_kline_snapshots_pass6_time_order_check' and conrelid = 'public.velmere_kline_snapshots'::regclass) then
    alter table public.velmere_kline_snapshots add constraint velmere_kline_snapshots_pass6_time_order_check check (
      received_at is null or (
        received_at <= generated_at + interval '5 seconds'
        and latest_closed_at <= received_at + interval '5 seconds'
        and char_length(integrity_key_id) between 1 and 64
      )
    );
  end if;
end $$;

revoke all on table public.velmere_kline_snapshots from anon, authenticated;
grant all on table public.velmere_kline_snapshots to service_role;

-- Service-role bypasses RLS; this explicit policy also documents the server-only boundary.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'velmere_kline_snapshots' and policyname = 'velmere_kline_snapshots_service_role_all') then
    create policy velmere_kline_snapshots_service_role_all
      on public.velmere_kline_snapshots
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

-- PASS4611: private durable audit intake case vault.
-- Raw targets are available only to service-role server code.
create table if not exists public.velmere_audit_intake_cases (
  case_id text primary key,
  case_ref text not null unique,
  request_id text not null unique,
  target_kind text not null check (target_kind in ('contract', 'github', 'url')),
  target_private text not null,
  target_hash text not null,
  display_label text not null,
  tier text not null check (tier in ('basic', 'pro', 'advanced')),
  locale text not null default 'en' check (locale in ('pl', 'en', 'de')),
  status text not null check (status in ('queued_basic_prescreen', 'awaiting_entitlement')),
  account_id text null,
  account_email text null,
  entitlement_required boolean not null default false,
  entitlement_verified boolean not null default false,
  analysis_started boolean not null default false,
  intake_receipt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_audit_intake_paid_account_required check (tier = 'basic' or account_id is not null),
  constraint velmere_audit_intake_no_unverified_start check (analysis_started = false or entitlement_required = false or entitlement_verified = true)
);

alter table public.velmere_audit_intake_cases enable row level security;
create index if not exists velmere_audit_intake_target_hash_idx on public.velmere_audit_intake_cases(target_hash, created_at desc);
create index if not exists velmere_audit_intake_account_idx on public.velmere_audit_intake_cases(account_id, created_at desc) where account_id is not null;
create index if not exists velmere_audit_intake_status_idx on public.velmere_audit_intake_cases(status, created_at asc);
revoke all on table public.velmere_audit_intake_cases from anon, authenticated;
grant all on table public.velmere_audit_intake_cases to service_role;

-- PASS4612: account-owned audit case -> exact checkout session -> verified entitlement queue.
alter table public.velmere_audit_intake_cases
  add column if not exists checkout_session_id text null,
  add column if not exists checkout_context_hash text null,
  add column if not exists checkout_product_id text null,
  add column if not exists entitlement_id text null,
  add column if not exists payment_event_id text null,
  add column if not exists entitlement_verified_at timestamptz null;
alter table public.velmere_audit_intake_cases drop constraint if exists velmere_audit_intake_cases_status_check;
alter table public.velmere_audit_intake_cases drop constraint if exists velmere_audit_intake_status_check;
alter table public.velmere_audit_intake_cases add constraint velmere_audit_intake_status_check
  check (status in ('queued_basic_prescreen','awaiting_entitlement','checkout_pending','queued_paid_review'));
alter table public.velmere_audit_intake_cases drop constraint if exists velmere_audit_intake_checkout_product_check;
alter table public.velmere_audit_intake_cases add constraint velmere_audit_intake_checkout_product_check
  check (checkout_product_id is null or checkout_product_id in ('vlm_pro_audit_review','vlm_advanced_audit_human_review'));
alter table public.velmere_audit_intake_cases drop constraint if exists velmere_audit_intake_checkout_binding_complete;
alter table public.velmere_audit_intake_cases add constraint velmere_audit_intake_checkout_binding_complete check (
  (checkout_session_id is null and checkout_context_hash is null and checkout_product_id is null)
  or (checkout_session_id is not null and checkout_context_hash is not null and checkout_product_id is not null)
);
alter table public.velmere_audit_intake_cases drop constraint if exists velmere_audit_intake_paid_queue_verified;
alter table public.velmere_audit_intake_cases add constraint velmere_audit_intake_paid_queue_verified check (
  status <> 'queued_paid_review' or (entitlement_verified = true and entitlement_id is not null and entitlement_verified_at is not null)
);
create unique index if not exists velmere_audit_intake_checkout_session_unique_idx on public.velmere_audit_intake_cases(checkout_session_id) where checkout_session_id is not null;
create index if not exists velmere_audit_intake_paid_queue_idx on public.velmere_audit_intake_cases(status, entitlement_verified_at asc) where status = 'queued_paid_review';

alter table public.velmere_vlm_paid_entitlements drop constraint if exists velmere_vlm_paid_entitlements_product_check;
alter table public.velmere_vlm_paid_entitlements add constraint velmere_vlm_paid_entitlements_product_check check (
  product_id in ('vlm_pro_analysis_single','vlm_pro_pdf_single','vlm_pro_audit_review','vlm_advanced_analysis_single','vlm_advanced_pdf_single','vlm_advanced_audit_human_review')
);

create or replace function public.velmere_bind_paid_audit_checkout(
  p_case_ref text, p_account_id text, p_tier text, p_product_id text, p_stripe_session_id text, p_context_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.velmere_audit_intake_cases%rowtype;
  v_now timestamptz := now();
begin
  select * into v_case from public.velmere_audit_intake_cases where case_ref=p_case_ref for update;
  if not found then return jsonb_build_object('ok',false,'error','case_not_found'); end if;
  if v_case.account_id is null or v_case.account_id <> p_account_id then return jsonb_build_object('ok',false,'error','case_account_mismatch'); end if;
  if v_case.tier <> p_tier or (p_tier='pro' and p_product_id<>'vlm_pro_audit_review')
     or (p_tier='advanced' and p_product_id<>'vlm_advanced_audit_human_review') or p_tier not in ('pro','advanced') then
    return jsonb_build_object('ok',false,'error','case_tier_mismatch');
  end if;
  if v_case.entitlement_required<>true or v_case.entitlement_verified=true or v_case.status in ('queued_basic_prescreen','queued_paid_review') then
    return jsonb_build_object('ok',false,'error','case_not_payable');
  end if;
  if v_case.checkout_session_id is not null then
    if v_case.checkout_session_id=p_stripe_session_id and v_case.checkout_context_hash=p_context_hash
       and v_case.checkout_product_id=p_product_id and v_case.status='checkout_pending' then
      return jsonb_build_object('ok',true,'idempotent',true,'caseRef',v_case.case_ref,'status',v_case.status);
    end if;
    return jsonb_build_object('ok',false,'error','case_already_bound_to_checkout');
  end if;
  if v_case.status<>'awaiting_entitlement' then return jsonb_build_object('ok',false,'error','case_not_payable'); end if;
  update public.velmere_audit_intake_cases set status='checkout_pending', checkout_session_id=p_stripe_session_id,
    checkout_context_hash=p_context_hash, checkout_product_id=p_product_id, updated_at=v_now where case_id=v_case.case_id;
  return jsonb_build_object('ok',true,'idempotent',false,'caseRef',v_case.case_ref,'status','checkout_pending');
exception when unique_violation then return jsonb_build_object('ok',false,'error','checkout_session_already_used');
end;
$$;
revoke all on function public.velmere_bind_paid_audit_checkout(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.velmere_bind_paid_audit_checkout(text,text,text,text,text,text) to service_role;

create or replace function public.velmere_promote_paid_audit_case(
  p_case_ref text, p_stripe_session_id text, p_product_id text, p_context_hash text, p_entitlement_id text, p_payment_event_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_case public.velmere_audit_intake_cases%rowtype;
  v_entitlement public.velmere_vlm_paid_entitlements%rowtype;
  v_now timestamptz := now();
begin
  select * into v_entitlement from public.velmere_vlm_paid_entitlements
  where id = p_entitlement_id and stripe_session_id = p_stripe_session_id and product_id = p_product_id
    and context_hash = p_context_hash and status in ('paid','active') and coalesce(payment_status,'paid') = 'paid' limit 1;
  if not found then return jsonb_build_object('ok',false,'error','matching_entitlement_not_found'); end if;
  select * into v_case from public.velmere_audit_intake_cases where case_ref = p_case_ref for update;
  if not found then return jsonb_build_object('ok',false,'error','case_not_found'); end if;
  if v_case.status = 'queued_paid_review' and v_case.entitlement_verified = true and v_case.entitlement_id = p_entitlement_id then
    return jsonb_build_object('ok',true,'idempotent',true,'caseRef',v_case.case_ref,'status',v_case.status,'analysisStarted',v_case.analysis_started);
  end if;
  if v_case.status <> 'checkout_pending' or v_case.checkout_session_id <> p_stripe_session_id
     or v_case.checkout_context_hash <> p_context_hash or v_case.checkout_product_id <> p_product_id then
    return jsonb_build_object('ok',false,'error','checkout_binding_mismatch');
  end if;
  if (v_case.tier = 'pro' and p_product_id <> 'vlm_pro_audit_review')
     or (v_case.tier = 'advanced' and p_product_id <> 'vlm_advanced_audit_human_review') or v_case.tier = 'basic' then
    return jsonb_build_object('ok',false,'error','tier_product_mismatch');
  end if;
  update public.velmere_audit_intake_cases set status='queued_paid_review', entitlement_verified=true,
    entitlement_id=p_entitlement_id, payment_event_id=p_payment_event_id, entitlement_verified_at=v_now,
    analysis_started=false, updated_at=v_now where case_id=v_case.case_id;
  return jsonb_build_object('ok',true,'idempotent',false,'caseRef',v_case.case_ref,'status','queued_paid_review','analysisStarted',false);
end;
$$;
revoke all on function public.velmere_promote_paid_audit_case(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.velmere_promote_paid_audit_case(text,text,text,text,text,text) to service_role;
-- PASS4613 — account-owned audit status and append-only payment terminal events.
-- The customer status route never reads target_private. Signed Stripe terminal events
-- block/revoke the case without deleting prior intake, checkout or entitlement receipts.

alter table public.velmere_audit_intake_cases
  add column if not exists blocked_reason text null,
  add column if not exists blocked_event_hash text null,
  add column if not exists blocked_at timestamptz null;

alter table public.velmere_audit_intake_cases
  drop constraint if exists velmere_audit_intake_status_check;
alter table public.velmere_audit_intake_cases
  add constraint velmere_audit_intake_status_check
  check (status in (
    'queued_basic_prescreen',
    'awaiting_entitlement',
    'checkout_pending',
    'queued_paid_review',
    'payment_blocked',
    'access_revoked'
  ));

alter table public.velmere_audit_intake_cases
  drop constraint if exists velmere_audit_intake_blocked_reason_check;
alter table public.velmere_audit_intake_cases
  add constraint velmere_audit_intake_blocked_reason_check
  check (blocked_reason is null or blocked_reason in ('checkout_expired', 'payment_failed', 'refund', 'chargeback'));

create table if not exists public.velmere_audit_case_payment_events (
  event_receipt_id uuid primary key default gen_random_uuid(),
  event_hash text not null unique,
  case_id text not null references public.velmere_audit_intake_cases(case_id) on delete restrict,
  case_ref text not null,
  event_type text not null check (event_type in ('checkout_expired', 'payment_failed', 'refund', 'chargeback')),
  previous_status text not null,
  next_status text not null,
  stale_ignored boolean not null default false,
  entitlement_revoked boolean not null default false,
  analysis_started boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists velmere_audit_case_payment_events_case_idx
  on public.velmere_audit_case_payment_events(case_id, created_at desc);

alter table public.velmere_audit_case_payment_events enable row level security;
revoke all on table public.velmere_audit_case_payment_events from public, anon, authenticated;
grant all on table public.velmere_audit_case_payment_events to service_role;

comment on table public.velmere_audit_case_payment_events is
  'PASS4613 private append-only payment terminal receipt ledger. Stores only a SHA-256 event hash, never the raw Stripe event payload.';

create or replace function public.velmere_apply_audit_payment_terminal_event(
  p_case_ref text,
  p_product_id text,
  p_context_hash text,
  p_event_id text,
  p_event_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.velmere_audit_intake_cases%rowtype;
  v_event_hash text;
  v_previous_status text;
  v_next_status text;
  v_stale boolean := false;
  v_entitlement_revoked boolean := false;
  v_now timestamptz := now();
begin
  if p_event_type not in ('checkout_expired', 'payment_failed', 'refund', 'chargeback') then
    return jsonb_build_object('ok', false, 'error', 'invalid_event_type');
  end if;
  if p_product_id not in ('vlm_pro_audit_review', 'vlm_advanced_audit_human_review')
     or p_context_hash !~ '^[a-f0-9]{64}$'
     or coalesce(p_event_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'payment_event_binding_mismatch');
  end if;

  v_event_hash := 'sha256:' || encode(digest(p_event_id, 'sha256'), 'hex');
  if exists (select 1 from public.velmere_audit_case_payment_events where event_hash = v_event_hash) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'eventHash', v_event_hash);
  end if;

  select * into v_case
  from public.velmere_audit_intake_cases
  where case_ref = p_case_ref
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'case_not_found');
  end if;

  if v_case.checkout_product_id <> p_product_id
     or v_case.checkout_context_hash <> p_context_hash
     or v_case.checkout_session_id is null then
    return jsonb_build_object('ok', false, 'error', 'payment_event_binding_mismatch');
  end if;

  v_previous_status := v_case.status;

  if p_event_type in ('checkout_expired', 'payment_failed')
     and v_case.status in ('queued_paid_review', 'access_revoked') then
    v_stale := true;
    v_next_status := v_case.status;
  elsif p_event_type in ('refund', 'chargeback') then
    v_next_status := 'access_revoked';
    update public.velmere_vlm_paid_entitlements
    set status = 'refunded',
        payment_status = p_event_type,
        updated_at = v_now
    where stripe_session_id = v_case.checkout_session_id
      and product_id = p_product_id
      and context_hash = p_context_hash
      and status in ('paid', 'active');
    v_entitlement_revoked := found;
  else
    v_next_status := 'payment_blocked';
    update public.velmere_vlm_paid_entitlements
    set status = 'expired',
        payment_status = p_event_type,
        updated_at = v_now
    where stripe_session_id = v_case.checkout_session_id
      and product_id = p_product_id
      and context_hash = p_context_hash
      and status in ('paid', 'active');
    v_entitlement_revoked := found;
  end if;

  if not v_stale then
    update public.velmere_audit_intake_cases
    set status = v_next_status,
        entitlement_verified = false,
        analysis_started = false,
        blocked_reason = p_event_type,
        blocked_event_hash = v_event_hash,
        blocked_at = v_now,
        updated_at = v_now
    where case_id = v_case.case_id;
  end if;

  insert into public.velmere_audit_case_payment_events (
    event_hash,
    case_id,
    case_ref,
    event_type,
    previous_status,
    next_status,
    stale_ignored,
    entitlement_revoked,
    analysis_started,
    created_at
  ) values (
    v_event_hash,
    v_case.case_id,
    v_case.case_ref,
    p_event_type,
    v_previous_status,
    v_next_status,
    v_stale,
    v_entitlement_revoked,
    false,
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'staleIgnored', v_stale,
    'eventHash', v_event_hash,
    'caseRef', v_case.case_ref,
    'previousStatus', v_previous_status,
    'status', v_next_status,
    'entitlementRevoked', v_entitlement_revoked,
    'analysisStarted', false
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'idempotent', true, 'eventHash', v_event_hash);
end;
$$;

revoke all on function public.velmere_apply_audit_payment_terminal_event(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.velmere_apply_audit_payment_terminal_event(text, text, text, text, text) to service_role;

comment on function public.velmere_apply_audit_payment_terminal_event(text, text, text, text, text) is
  'PASS4613 exact case/product/context terminal-event transition. Refund/chargeback revoke entitlement; failed/expired checkout cannot override an already paid queue.';


-- PASS4658 audit PDF token lifecycle
alter table public.velmere_audit_pdf_token_consumptions
  add column if not exists state text not null default 'consumed',
  add column if not exists reservation_id text,
  add column if not exists reserved_at timestamptz,
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists attempt_count integer not null default 1;

alter table public.velmere_audit_pdf_token_consumptions alter column consumed_at drop not null;
alter table public.velmere_audit_pdf_token_consumptions drop constraint if exists velmere_audit_pdf_token_consumptions_state_check;
alter table public.velmere_audit_pdf_token_consumptions add constraint velmere_audit_pdf_token_consumptions_state_check
  check (state in ('reserved', 'consumed', 'retryable_failed'));
create index if not exists velmere_audit_pdf_token_consumptions_state_idx
  on public.velmere_audit_pdf_token_consumptions (state, reservation_expires_at, token_expires_at);

create or replace function public.velmere_claim_audit_pdf_token(
  p_token_hash text, p_nonce_hash text, p_account_id_hash text, p_entitlement_id_hash text,
  p_report_id text, p_report_version_hash text, p_token_expires_at timestamptz,
  p_reservation_id text, p_reservation_expires_at timestamptz
)
returns table(ok boolean, result text, attempt_count integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_state text; v_attempt integer;
begin
  if p_token_expires_at <= now() then return query select false, 'expired'::text, 0; return; end if;
  begin
    insert into public.velmere_audit_pdf_token_consumptions (
      token_hash, nonce_hash, account_id_hash, entitlement_id_hash, report_id, report_version_hash,
      token_expires_at, state, reservation_id, reserved_at, reservation_expires_at, consumed_at, attempt_count
    ) values (
      p_token_hash, p_nonce_hash, p_account_id_hash, p_entitlement_id_hash, p_report_id, p_report_version_hash,
      p_token_expires_at, 'reserved', p_reservation_id, now(), p_reservation_expires_at, null, 1
    );
    return query select true, 'claimed'::text, 1; return;
  exception when unique_violation then null; end;

  update public.velmere_audit_pdf_token_consumptions
     set state='reserved', reservation_id=p_reservation_id, reserved_at=now(),
         reservation_expires_at=p_reservation_expires_at, failed_at=null, failure_code=null,
         attempt_count=public.velmere_audit_pdf_token_consumptions.attempt_count + 1
   where token_hash=p_token_hash and account_id_hash=p_account_id_hash
     and entitlement_id_hash=p_entitlement_id_hash and report_id=p_report_id
     and report_version_hash=p_report_version_hash and token_expires_at > now()
     and (state='retryable_failed' or (state='reserved' and reservation_expires_at <= now()))
  returning public.velmere_audit_pdf_token_consumptions.attempt_count into v_attempt;
  if found then return query select true, 'reclaimed'::text, v_attempt; return; end if;

  select state, public.velmere_audit_pdf_token_consumptions.attempt_count into v_state, v_attempt
    from public.velmere_audit_pdf_token_consumptions where token_hash=p_token_hash;
  if v_state is null then return query select false, 'replayed_nonce'::text, 0;
  elsif v_state='consumed' then return query select false, 'consumed'::text, coalesce(v_attempt,0);
  elsif v_state='reserved' then return query select false, 'reserved'::text, coalesce(v_attempt,0);
  else return query select false, 'store_rejected'::text, coalesce(v_attempt,0); end if;
end; $$;

create or replace function public.velmere_finalize_audit_pdf_token(
  p_token_hash text, p_reservation_id text, p_consumed_at timestamptz
)
returns table(ok boolean, result text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_state text;
begin
  update public.velmere_audit_pdf_token_consumptions
     set state='consumed', consumed_at=p_consumed_at, reservation_id=null,
         reservation_expires_at=null, failure_code=null
   where token_hash=p_token_hash and state='reserved' and reservation_id=p_reservation_id;
  if found then return query select true, 'consumed'::text; return; end if;
  select state into v_state from public.velmere_audit_pdf_token_consumptions where token_hash=p_token_hash;
  if v_state='consumed' then return query select false, 'consumed'::text;
  else return query select false, 'reservation_mismatch'::text; end if;
end; $$;

create or replace function public.velmere_fail_audit_pdf_token_reservation(
  p_token_hash text, p_reservation_id text, p_failure_code text, p_failed_at timestamptz
)
returns table(ok boolean, result text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.velmere_audit_pdf_token_consumptions
     set state='retryable_failed', failed_at=p_failed_at,
         failure_code=left(coalesce(p_failure_code,'pdf_generation_failed'),96),
         reservation_id=null, reservation_expires_at=null
   where token_hash=p_token_hash and state='reserved' and reservation_id=p_reservation_id;
  if found then return query select true, 'retryable_failed'::text;
  else return query select false, 'reservation_mismatch'::text; end if;
end; $$;

revoke all on function public.velmere_claim_audit_pdf_token(text,text,text,text,text,text,timestamptz,text,timestamptz) from public, anon, authenticated;
revoke all on function public.velmere_finalize_audit_pdf_token(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.velmere_fail_audit_pdf_token_reservation(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.velmere_claim_audit_pdf_token(text,text,text,text,text,text,timestamptz,text,timestamptz) to service_role;
grant execute on function public.velmere_finalize_audit_pdf_token(text,text,timestamptz) to service_role;
grant execute on function public.velmere_fail_audit_pdf_token_reservation(text,text,text,timestamptz) to service_role;

-- PASS4821 immutable customer-safe Audit snapshot binding.
alter table public.velmere_audit_account_messages
  add column if not exists canonical_customer_snapshot jsonb,
  add column if not exists canonical_customer_snapshot_digest text,
  add column if not exists exact_account_artifact_snapshot_id text
    generated always as (canonical_customer_snapshot #>> '{exactAccountArtifact,snapshotId}') stored;

update public.velmere_audit_account_messages
set canonical_customer_snapshot_digest = canonical_customer_snapshot->>'snapshotDigest'
where canonical_customer_snapshot is not null
  and canonical_customer_snapshot_digest is null
  and canonical_customer_snapshot->>'snapshotDigest' ~ '^sha256:[a-f0-9]{64}$';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'velmere_audit_account_messages_snapshot_pair_check'
      and conrelid = 'public.velmere_audit_account_messages'::regclass
  ) then
    alter table public.velmere_audit_account_messages
      add constraint velmere_audit_account_messages_snapshot_pair_check
      check (
        (canonical_customer_snapshot is null and canonical_customer_snapshot_digest is null)
        or (
          canonical_customer_snapshot is not null
          and canonical_customer_snapshot_digest ~ '^sha256:[a-f0-9]{64}$'
          and canonical_customer_snapshot->>'snapshotDigest' = canonical_customer_snapshot_digest
          and canonical_customer_snapshot->>'schemaVersion' = 'pass4821-audit-account-customer-snapshot-v1'
        )
      );
  end if;
end $$;

create index if not exists velmere_audit_account_messages_snapshot_digest_idx
  on public.velmere_audit_account_messages(canonical_customer_snapshot_digest)
  where canonical_customer_snapshot_digest is not null;

create unique index if not exists velmere_audit_account_messages_exact_artifact_snapshot_uidx
  on public.velmere_audit_account_messages(exact_account_artifact_snapshot_id)
  where exact_account_artifact_snapshot_id is not null;

create or replace function public.velmere_enforce_audit_customer_snapshot_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exact_snapshot record;
  v_exact_blob record;
  v_exact jsonb;
  v_expected_account_hash text;
begin
  if tg_op = 'UPDATE' and new.account_id is distinct from old.account_id then
    raise exception 'audit_account_message_owner_immutable_conflict' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.canonical_customer_snapshot is not null then
    if new.canonical_customer_snapshot is distinct from old.canonical_customer_snapshot
       or new.canonical_customer_snapshot_digest is distinct from old.canonical_customer_snapshot_digest then
      raise exception 'audit_customer_snapshot_immutable_conflict' using errcode = '23514';
    end if;
  end if;

  if new.canonical_customer_snapshot is not null then
    if new.canonical_customer_snapshot_digest is null
       or new.canonical_customer_snapshot->>'snapshotDigest' is distinct from new.canonical_customer_snapshot_digest
       or new.canonical_customer_snapshot->>'schemaVersion' <> 'pass4821-audit-account-customer-snapshot-v1' then
      raise exception 'audit_customer_snapshot_integrity_failed' using errcode = '23514';
    end if;
  end if;

  if (new.operator_status in ('customer_safe_ready', 'delivered')
      or new.delivery_status = 'ready_for_download'
      or new.message_status = 'ready') then
    v_exact := new.canonical_customer_snapshot->'exactAccountArtifact';
    v_expected_account_hash := encode(digest('velmere-account-binding-v1:' || new.account_id, 'sha256'), 'hex');

    if new.canonical_customer_snapshot is null
       or jsonb_typeof(v_exact) <> 'object'
       or (select count(*) from jsonb_object_keys(v_exact)) <> 9
       or coalesce(v_exact->>'schemaVersion', '') <> 'p80-audit-exact-account-artifact-binding-v1'
       or coalesce(v_exact->>'storage', '') <> 'exact_immutable_blob'
       or coalesce(v_exact->>'snapshotId', '') !~ '^artifact-audit-[a-f0-9]{16}-[a-f0-9]{64}$'
       or coalesce(v_exact->>'pdfBlobId', '') !~ '^pdf-[a-f0-9]{16}-[a-f0-9]{64}$'
       or coalesce(v_exact->>'artifactDigest', '') <> coalesce(new.canonical_customer_snapshot->'canonicalArtifact'->>'artifactDigest', '')
       or coalesce(v_exact->>'pdfDigest', '') <> coalesce(new.canonical_customer_snapshot->'canonicalArtifact'->>'pdfDigest', '')
       or coalesce(v_exact->>'pdfByteLength', '') <> coalesce(new.canonical_customer_snapshot->'canonicalArtifact'->>'pdfByteLength', '')
       or coalesce(v_exact->>'snapshotDigest', '') !~ '^sha256:[a-f0-9]{64}$'
       or coalesce(v_exact->>'pdfBlobRecordDigest', '') !~ '^sha256:[a-f0-9]{64}$'
       or coalesce(new.canonical_customer_snapshot->>'accountIdHash', '') <> v_expected_account_hash
       or v_exact->>'snapshotId' <> 'artifact-audit-' || left(v_expected_account_hash, 16) || '-' || substring(v_exact->>'artifactDigest' from 8)
       or v_exact->>'pdfBlobId' <> 'pdf-' || left(v_expected_account_hash, 16) || '-' || substring(v_exact->>'artifactDigest' from 8) then
      raise exception 'exact_account_pdf_artifact_required_before_ready' using errcode = '23514';
    end if;

    select * into v_exact_snapshot
      from public.velmere_customer_artifact_snapshots
      where snapshot_id = v_exact->>'snapshotId';
    if not found then
      raise exception 'exact_account_pdf_snapshot_missing_before_ready' using errcode = '23514';
    end if;

    select * into v_exact_blob
      from public.velmere_customer_artifact_pdf_blobs
      where blob_id = v_exact->>'pdfBlobId'
        and snapshot_id = v_exact->>'snapshotId';
    if not found then
      raise exception 'exact_account_pdf_blob_missing_before_ready' using errcode = '23514';
    end if;

    if v_exact_snapshot.account_id <> new.account_id
       or v_exact_snapshot.account_id_hash <> v_expected_account_hash
       or v_exact_snapshot.surface <> 'audit'
       or v_exact_snapshot.payload_kind <> 'audit_customer_report_v1'
       or v_exact_snapshot.report_id <> new.canonical_customer_snapshot->>'reportId'
       or v_exact_snapshot.artifact_digest <> v_exact->>'artifactDigest'
       or v_exact_snapshot.snapshot_digest <> v_exact->>'snapshotDigest'
       or v_exact_snapshot.pdf_storage <> 'exact_immutable_blob'
       or v_exact_snapshot.snapshot->>'generatedAt' <> new.canonical_customer_snapshot->>'generatedAt'
       or v_exact_snapshot.snapshot->>'payloadDigest' <> new.canonical_customer_snapshot->>'customerReportDigest'
       or v_exact_blob.account_id <> new.account_id
       or v_exact_blob.account_id_hash <> v_expected_account_hash
       or v_exact_blob.surface <> 'audit'
       or v_exact_blob.report_id <> new.canonical_customer_snapshot->>'reportId'
       or v_exact_blob.artifact_digest <> v_exact->>'artifactDigest'
       or v_exact_blob.pdf_digest <> v_exact->>'pdfDigest'
       or v_exact_blob.pdf_byte_length::text <> v_exact->>'pdfByteLength'
       or v_exact_blob.record_digest <> v_exact->>'pdfBlobRecordDigest'
       or octet_length(v_exact_blob.pdf_bytes) <> v_exact_blob.pdf_byte_length
       or 'sha256:' || encode(digest(v_exact_blob.pdf_bytes, 'sha256'), 'hex') <> v_exact_blob.pdf_digest then
      raise exception 'exact_account_pdf_cross_binding_failed_before_ready' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists velmere_audit_customer_snapshot_immutability on public.velmere_audit_account_messages;
create trigger velmere_audit_customer_snapshot_immutability
before insert or update on public.velmere_audit_account_messages
for each row execute function public.velmere_enforce_audit_customer_snapshot_immutability();

revoke all on function public.velmere_enforce_audit_customer_snapshot_immutability() from public;
grant execute on function public.velmere_enforce_audit_customer_snapshot_immutability() to service_role;


-- PASS4823 CUSTOMER ARTIFACT SNAPSHOT BEGIN
create table if not exists public.velmere_customer_artifact_snapshots (
  snapshot_id text primary key,
  account_id text not null,
  account_id_hash text not null,
  surface text not null,
  payload_kind text not null,
  report_id text not null,
  artifact_digest text not null,
  snapshot_digest text not null,
  snapshot jsonb not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.velmere_customer_artifact_snapshots
  drop constraint if exists velmere_customer_artifact_snapshots_surface_check,
  drop constraint if exists velmere_customer_artifact_surface_check,
  drop constraint if exists velmere_customer_artifact_snapshots_payload_kind_check,
  drop constraint if exists velmere_customer_artifact_payload_kind_check,
  drop constraint if exists velmere_customer_artifact_account_hash_check,
  drop constraint if exists velmere_customer_artifact_digest_check,
  drop constraint if exists velmere_customer_artifact_surface_payload_kind_check;

alter table public.velmere_customer_artifact_snapshots
  add constraint velmere_customer_artifact_surface_check
    check (surface in ('audit','shield','real_markets','lens')),
  add constraint velmere_customer_artifact_payload_kind_check
    check (payload_kind in ('audit_customer_report_v1','market_customer_report_v1','lens_report_v1')),
  add constraint velmere_customer_artifact_surface_payload_kind_check
    check (
      (surface = 'lens' and payload_kind = 'lens_report_v1')
      or
      (surface in ('shield','real_markets') and payload_kind = 'market_customer_report_v1')
      or
      (surface = 'audit' and payload_kind = 'audit_customer_report_v1')
    ),
  add constraint velmere_customer_artifact_account_hash_check
    check (account_id_hash ~ '^[a-f0-9]{64}$'),
  add constraint velmere_customer_artifact_digest_check
    check (
      artifact_digest ~ '^sha256:[a-f0-9]{64}$'
      and snapshot_digest ~ '^sha256:[a-f0-9]{64}$'
      and snapshot->>'snapshotId' = snapshot_id
      and snapshot->>'snapshotDigest' = snapshot_digest
      and snapshot->'canonicalArtifact'->>'artifactDigest' = artifact_digest
      and snapshot->>'accountIdHash' = account_id_hash
      and snapshot->>'surface' = surface
      and snapshot->>'payloadKind' = payload_kind
      and snapshot->>'reportId' = report_id
      and (snapshot->>'generatedAt')::timestamptz = generated_at
      and snapshot->>'schemaVersion' = 'pass4822-account-customer-artifact-snapshot-v1'
    );

alter table public.velmere_customer_artifact_snapshots enable row level security;
revoke all on table public.velmere_customer_artifact_snapshots from anon, authenticated;
grant select, insert on table public.velmere_customer_artifact_snapshots to service_role;

create index if not exists velmere_customer_artifact_account_idx
  on public.velmere_customer_artifact_snapshots(account_id, generated_at desc);
drop index if exists public.velmere_customer_artifact_digest_unique;
create unique index if not exists velmere_customer_artifact_owner_digest_unique
  on public.velmere_customer_artifact_snapshots(account_id_hash, artifact_digest);

create or replace function public.velmere_customer_artifact_immutable_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'customer_artifact_snapshot_immutable' using errcode = '23514';
  end if;
  if new.snapshot->>'snapshotId' is distinct from new.snapshot_id
     or new.snapshot->>'snapshotDigest' is distinct from new.snapshot_digest
     or new.snapshot->'canonicalArtifact'->>'artifactDigest' is distinct from new.artifact_digest
     or new.snapshot->>'accountIdHash' is distinct from new.account_id_hash
     or new.snapshot->>'surface' is distinct from new.surface
     or new.snapshot->>'payloadKind' is distinct from new.payload_kind
     or new.snapshot->>'reportId' is distinct from new.report_id
     or (new.snapshot->>'generatedAt')::timestamptz is distinct from new.generated_at then
    raise exception 'customer_artifact_snapshot_contract_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists velmere_customer_artifact_immutable on public.velmere_customer_artifact_snapshots;
create trigger velmere_customer_artifact_immutable
before insert or update on public.velmere_customer_artifact_snapshots
for each row execute function public.velmere_customer_artifact_immutable_guard();

revoke all on function public.velmere_customer_artifact_immutable_guard() from public;
grant execute on function public.velmere_customer_artifact_immutable_guard() to service_role;

comment on table public.velmere_customer_artifact_snapshots is
  'PASS4823 immutable account-bound canonical customer report snapshots. Browser-supplied reports are forbidden.';
-- PASS4823 CUSTOMER ARTIFACT SNAPSHOT END

-- PASS4824 ACCOUNT SESSION CENTRAL REVOCATION BEGIN
create table if not exists public.velmere_auth_session_families (
  family_id uuid primary key,
  subject_fingerprint text not null check (subject_fingerprint ~ '^[a-f0-9]{32}$'),
  generation integer not null default 1 check (generation between 1 and 1000000000),
  status text not null default 'active' check (status in ('active','revoked','compromised','expired')),
  expires_at timestamptz not null,
  last_rotated_at timestamptz not null default now(),
  compromised_at timestamptz,
  revoke_reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists velmere_auth_session_families_subject_status_idx
  on public.velmere_auth_session_families(subject_fingerprint, status);

alter table public.velmere_auth_session_families enable row level security;
revoke all on table public.velmere_auth_session_families from public, anon, authenticated;
grant select, insert, update on table public.velmere_auth_session_families to service_role;

create or replace function public.velmere_verify_auth_session_family(
  p_family_id uuid,
  p_subject_fingerprint text,
  p_expected_generation integer,
  p_expected_expires_at timestamptz
) returns table(
  status text,
  family_id uuid,
  subject_fingerprint text,
  generation integer,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when f.status <> 'active' then f.status
      when f.expires_at <= now() then 'expired'
      when f.subject_fingerprint is distinct from p_subject_fingerprint then 'subject_mismatch'
      when f.generation is distinct from p_expected_generation then 'generation_mismatch'
      when f.expires_at is distinct from p_expected_expires_at then 'expiry_mismatch'
      else 'active'
    end::text as status,
    f.family_id,
    f.subject_fingerprint,
    f.generation,
    f.expires_at
  from public.velmere_auth_session_families f
  where f.family_id = p_family_id;
$$;

revoke all on function public.velmere_verify_auth_session_family(uuid,text,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.velmere_verify_auth_session_family(uuid,text,integer,timestamptz) to service_role;

create or replace function public.velmere_revoke_auth_session_subject(
  p_subject_fingerprint text,
  p_reason_code text
) returns table(status text, revoked_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_count integer := 0;
  subject_known boolean := false;
begin
  if p_subject_fingerprint !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_auth_session_subject';
  end if;

  update public.velmere_auth_session_families f
     set status = 'revoked',
         revoke_reason_code = left(regexp_replace(coalesce(p_reason_code, ''), '[^a-zA-Z0-9_-]', '', 'g'), 40),
         updated_at = now()
   where f.subject_fingerprint = p_subject_fingerprint
     and f.status in ('active', 'compromised');
  get diagnostics changed_count = row_count;

  select exists(
    select 1
      from public.velmere_auth_session_families f
     where f.subject_fingerprint = p_subject_fingerprint
  ) into subject_known;

  return query select
    case when subject_known then 'revoked' else 'missing' end::text,
    changed_count;
end;
$$;

revoke all on function public.velmere_revoke_auth_session_subject(text,text) from public, anon, authenticated;
grant execute on function public.velmere_revoke_auth_session_subject(text,text) to service_role;
-- PASS4824 ACCOUNT SESSION CENTRAL REVOCATION END

-- PASS4824 CUSTOMER ARTIFACT EXACT PDF BLOB BEGIN
alter table public.velmere_customer_artifact_snapshots
  add column if not exists pdf_storage text default 'legacy_deterministic_rerender';

-- Every row which predates this contract is an explicit grandfathered legacy
-- rerender. ADD COLUMN DEFAULT backfills them without firing the existing
-- immutable row trigger. New inserts are atomic exact-PDF bundles only.

alter table public.velmere_customer_artifact_snapshots
  alter column pdf_storage set not null,
  alter column pdf_storage drop default,
  drop constraint if exists velmere_customer_artifact_pdf_storage_check,
  add constraint velmere_customer_artifact_pdf_storage_check check (
    (pdf_storage = 'legacy_deterministic_rerender' and not (snapshot ? 'pdfStorage'))
    or
    (pdf_storage = 'exact_immutable_blob' and snapshot->>'pdfStorage' = 'exact_immutable_blob')
  );

-- Runtime writes use the atomic security-definer RPC. A service-role caller can
-- read snapshots but cannot create a snapshot-only durable state.
revoke insert, update, delete on table public.velmere_customer_artifact_snapshots from service_role;
grant select on table public.velmere_customer_artifact_snapshots to service_role;

create or replace function public.velmere_customer_artifact_immutable_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'customer_artifact_snapshot_immutable' using errcode = '23514';
  end if;
  if new.pdf_storage <> 'exact_immutable_blob'
     or new.snapshot->>'pdfStorage' is distinct from 'exact_immutable_blob' then
    raise exception 'customer_artifact_new_snapshot_requires_exact_pdf_bundle' using errcode = '23514';
  end if;
  if new.snapshot->>'snapshotId' is distinct from new.snapshot_id
     or new.snapshot->>'snapshotDigest' is distinct from new.snapshot_digest
     or new.snapshot->'canonicalArtifact'->>'artifactDigest' is distinct from new.artifact_digest
     or new.snapshot->>'accountIdHash' is distinct from new.account_id_hash
     or new.snapshot->>'surface' is distinct from new.surface
     or new.snapshot->>'payloadKind' is distinct from new.payload_kind
     or new.snapshot->>'reportId' is distinct from new.report_id
     or (new.snapshot->>'generatedAt')::timestamptz is distinct from new.generated_at then
    raise exception 'customer_artifact_snapshot_contract_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.velmere_customer_artifact_immutable_guard() from public, anon, authenticated, service_role;

create table if not exists public.velmere_customer_artifact_pdf_blobs (
  schema_version text not null,
  blob_id text primary key,
  snapshot_id text not null references public.velmere_customer_artifact_snapshots(snapshot_id) on delete restrict,
  account_id text not null,
  account_id_hash text not null,
  surface text not null,
  report_id text not null,
  artifact_digest text not null,
  pdf_digest text not null,
  pdf_byte_length integer not null,
  mime_type text not null,
  pdf_bytes bytea not null,
  created_at timestamptz not null,
  record_digest text not null,
  constraint velmere_customer_artifact_pdf_blob_owner_artifact_unique unique (account_id_hash, artifact_digest)
);

alter table public.velmere_customer_artifact_pdf_blobs
  drop constraint if exists velmere_customer_artifact_pdf_blob_contract_check,
  add constraint velmere_customer_artifact_pdf_blob_contract_check check (
    schema_version = 'pass4824-account-customer-artifact-pdf-blob-v1'
    and blob_id = 'pdf-' || left(account_id_hash, 16) || '-' || substring(artifact_digest from 8)
    and blob_id ~ '^pdf-[a-f0-9]{16}-[a-f0-9]{64}$'
    and account_id_hash ~ '^[a-f0-9]{64}$'
    and surface in ('audit','shield','real_markets','lens')
    and artifact_digest ~ '^sha256:[a-f0-9]{64}$'
    and pdf_digest ~ '^sha256:[a-f0-9]{64}$'
    and record_digest ~ '^sha256:[a-f0-9]{64}$'
    and mime_type = 'application/pdf'
    and pdf_byte_length between 1 and 8388608
    and octet_length(pdf_bytes) = pdf_byte_length
    and substring(pdf_bytes from 1 for 5) = decode('255044462d', 'hex')
    and pdf_digest = 'sha256:' || encode(digest(pdf_bytes, 'sha256'), 'hex')
    and record_digest = 'sha256:' || encode(digest(
      '{"accountIdHash":' || to_jsonb(account_id_hash)::text
      || ',"artifactDigest":' || to_jsonb(artifact_digest)::text
      || ',"blobId":' || to_jsonb(blob_id)::text
      || ',"createdAt":' || to_jsonb(to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))::text
      || ',"mimeType":' || to_jsonb(mime_type)::text
      || ',"pdfByteLength":' || pdf_byte_length::text
      || ',"pdfDigest":' || to_jsonb(pdf_digest)::text
      || ',"reportId":' || to_jsonb(report_id)::text
      || ',"schemaVersion":' || to_jsonb(schema_version)::text
      || ',"snapshotId":' || to_jsonb(snapshot_id)::text
      || ',"surface":' || to_jsonb(surface)::text || '}',
      'sha256'
    ), 'hex')
  );

alter table public.velmere_customer_artifact_pdf_blobs enable row level security;
revoke all on table public.velmere_customer_artifact_pdf_blobs from anon, authenticated;
revoke all on table public.velmere_customer_artifact_pdf_blobs from service_role;
grant select on table public.velmere_customer_artifact_pdf_blobs to service_role;

create index if not exists velmere_customer_artifact_pdf_blob_account_snapshot_idx
  on public.velmere_customer_artifact_pdf_blobs(account_id, snapshot_id);

create or replace function public.velmere_customer_artifact_pdf_blob_immutable_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  raise exception 'customer_artifact_pdf_blob_immutable' using errcode = '23514';
end;
$$;

drop trigger if exists velmere_customer_artifact_pdf_blob_immutable
  on public.velmere_customer_artifact_pdf_blobs;
create trigger velmere_customer_artifact_pdf_blob_immutable
before update or delete on public.velmere_customer_artifact_pdf_blobs
for each row execute function public.velmere_customer_artifact_pdf_blob_immutable_guard();

revoke all on function public.velmere_customer_artifact_pdf_blob_immutable_guard() from public, anon, authenticated, service_role;

create or replace function public.velmere_customer_artifact_exact_pdf_pair_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_snapshot public.velmere_customer_artifact_snapshots%rowtype;
  v_blob public.velmere_customer_artifact_pdf_blobs%rowtype;
begin
  if tg_table_name = 'velmere_customer_artifact_snapshots' then
    if new.pdf_storage <> 'exact_immutable_blob' then
      raise exception 'customer_artifact_new_snapshot_requires_exact_pdf_bundle' using errcode = '23514';
    end if;
    select * into v_blob from public.velmere_customer_artifact_pdf_blobs where snapshot_id = new.snapshot_id;
    if not found
       or v_blob.account_id <> new.account_id
       or v_blob.account_id_hash <> new.account_id_hash
       or v_blob.surface <> new.surface
       or v_blob.report_id <> new.report_id
       or v_blob.artifact_digest <> new.artifact_digest
       or v_blob.pdf_digest <> new.snapshot->'canonicalArtifact'->>'pdfDigest'
       or v_blob.pdf_byte_length <> (new.snapshot->'canonicalArtifact'->>'pdfByteLength')::integer
       or v_blob.created_at <> new.generated_at then
      raise exception 'customer_artifact_exact_pdf_pair_invariant' using errcode = '23514';
    end if;
  else
    select * into v_snapshot from public.velmere_customer_artifact_snapshots where snapshot_id = new.snapshot_id;
    if not found
       or v_snapshot.pdf_storage <> 'exact_immutable_blob'
       or v_snapshot.account_id <> new.account_id
       or v_snapshot.account_id_hash <> new.account_id_hash
       or v_snapshot.surface <> new.surface
       or v_snapshot.report_id <> new.report_id
       or v_snapshot.artifact_digest <> new.artifact_digest
       or v_snapshot.snapshot->'canonicalArtifact'->>'pdfDigest' <> new.pdf_digest
       or (v_snapshot.snapshot->'canonicalArtifact'->>'pdfByteLength')::integer <> new.pdf_byte_length
       or v_snapshot.generated_at <> new.created_at then
      raise exception 'customer_artifact_exact_pdf_pair_invariant' using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists velmere_customer_artifact_snapshot_exact_pdf_pair
  on public.velmere_customer_artifact_snapshots;
create constraint trigger velmere_customer_artifact_snapshot_exact_pdf_pair
after insert on public.velmere_customer_artifact_snapshots
deferrable initially deferred
for each row execute function public.velmere_customer_artifact_exact_pdf_pair_guard();

drop trigger if exists velmere_customer_artifact_blob_exact_pdf_pair
  on public.velmere_customer_artifact_pdf_blobs;
create constraint trigger velmere_customer_artifact_blob_exact_pdf_pair
after insert on public.velmere_customer_artifact_pdf_blobs
deferrable initially deferred
for each row execute function public.velmere_customer_artifact_exact_pdf_pair_guard();

revoke all on function public.velmere_customer_artifact_exact_pdf_pair_guard() from public, anon, authenticated, service_role;

-- Remove the pre-hardening overload if this migration is replayed over an
-- earlier PASS4824 candidate. Keeping it would preserve a weaker write path.
drop function if exists public.velmere_store_customer_artifact_pdf_bundle_v1(text, jsonb, jsonb, text);

create or replace function public.velmere_store_customer_artifact_pdf_bundle_v1(
  p_account_id text,
  p_snapshot jsonb,
  p_payload_canonical text,
  p_blob jsonb,
  p_pdf_base64 text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot_id text := p_snapshot->>'snapshotId';
  v_account_id_hash text := p_snapshot->>'accountIdHash';
  v_artifact_digest text := p_snapshot->'canonicalArtifact'->>'artifactDigest';
  v_pdf_digest text := p_snapshot->'canonicalArtifact'->>'pdfDigest';
  v_pdf_byte_length integer;
  v_snapshot_pdf_byte_length integer;
  v_blob_pdf_byte_length integer;
  v_artifact_page_count integer;
  v_artifact_rendered_row_count integer;
  v_snapshot_generated_at timestamptz;
  v_blob_created_at timestamptz;
  v_pdf_bytes bytea;
  v_payload_from_canonical jsonb;
  v_payload_digest_expected text;
  v_artifact_canonical text;
  v_snapshot_artifact_canonical text;
  v_artifact_digest_expected text;
  v_snapshot_canonical text;
  v_snapshot_digest_expected text;
  v_record_canonical text;
  v_record_digest_expected text;
  v_snapshot public.velmere_customer_artifact_snapshots%rowtype;
  v_blob public.velmere_customer_artifact_pdf_blobs%rowtype;
  v_snapshot_exists boolean := false;
  v_blob_exists boolean := false;
  v_created boolean := false;
begin
  if p_account_id is null or length(p_account_id) < 1 or length(p_account_id) > 120
     or p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or p_blob is null or jsonb_typeof(p_blob) <> 'object'
     or p_payload_canonical is null or octet_length(p_payload_canonical) > 16777216
     or v_snapshot_id is null or length(v_snapshot_id) > 180 then
    raise exception 'customer_artifact_pdf_bundle_identity_invalid' using errcode = '23514';
  end if;

  begin
    v_payload_from_canonical := p_payload_canonical::jsonb;
  exception when others then
    raise exception 'customer_artifact_pdf_bundle_payload_canonical_invalid' using errcode = '22023';
  end;
  if v_payload_from_canonical is distinct from p_snapshot->'payload' then
    raise exception 'customer_artifact_pdf_bundle_payload_canonical_mismatch' using errcode = '23514';
  end if;
  v_payload_digest_expected := 'sha256:' || encode(digest(p_payload_canonical, 'sha256'), 'hex');

  if p_pdf_base64 is null or length(p_pdf_base64) > 11184816
     or p_pdf_base64 !~ '^[A-Za-z0-9+/]*={0,2}$' then
    raise exception 'customer_artifact_pdf_bundle_encoding_invalid' using errcode = '22023';
  end if;
  begin
    v_pdf_bytes := decode(p_pdf_base64, 'base64');
  exception when others then
    raise exception 'customer_artifact_pdf_bundle_encoding_invalid' using errcode = '22023';
  end;
  v_pdf_byte_length := octet_length(v_pdf_bytes);
  begin
    v_snapshot_pdf_byte_length := (p_snapshot->'canonicalArtifact'->>'pdfByteLength')::integer;
    v_blob_pdf_byte_length := (p_blob->>'pdfByteLength')::integer;
    v_artifact_page_count := (p_snapshot->'canonicalArtifact'->>'pageCount')::integer;
    v_artifact_rendered_row_count := (p_snapshot->'canonicalArtifact'->>'renderedRowCount')::integer;
    v_snapshot_generated_at := (p_snapshot->>'generatedAt')::timestamptz;
    v_blob_created_at := (p_blob->>'createdAt')::timestamptz;
  exception when others then
    raise exception 'customer_artifact_pdf_bundle_metadata_encoding_invalid' using errcode = '22023';
  end;

  v_artifact_canonical := '{"deliveredTier":' || coalesce((p_snapshot->'canonicalArtifact'->'deliveredTier')::text, 'null')
    || ',"layoutDigest":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'layoutDigest')::text
    || ',"pageCount":' || v_artifact_page_count::text
    || ',"payloadDigest":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'payloadDigest')::text
    || ',"pdfByteLength":' || v_snapshot_pdf_byte_length::text
    || ',"pdfDigest":' || to_jsonb(v_pdf_digest)::text
    || ',"renderPlanDigest":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'renderPlanDigest')::text
    || ',"renderedRowCount":' || v_artifact_rendered_row_count::text
    || ',"rendererId":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'rendererId')::text
    || ',"reportId":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'reportId')::text
    || ',"requestedTier":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'requestedTier')::text
    || ',"schemaVersion":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'schemaVersion')::text
    || ',"surface":' || to_jsonb(p_snapshot->'canonicalArtifact'->>'surface')::text || '}';
  v_artifact_digest_expected := 'sha256:' || encode(digest(v_artifact_canonical, 'sha256'), 'hex');
  v_snapshot_artifact_canonical := '{"artifactDigest":' || to_jsonb(v_artifact_digest)::text
    || ',' || substring(v_artifact_canonical from 2);

  v_snapshot_canonical := '{"accountIdHash":' || to_jsonb(v_account_id_hash)::text
    || ',"canonicalArtifact":' || v_snapshot_artifact_canonical
    || ',"deliveredTier":' || coalesce((p_snapshot->'deliveredTier')::text, 'null')
    || ',"generatedAt":' || to_jsonb(p_snapshot->>'generatedAt')::text
    || ',"locale":' || to_jsonb(p_snapshot->>'locale')::text
    || ',"payload":' || p_payload_canonical
    || ',"payloadDigest":' || to_jsonb(p_snapshot->>'payloadDigest')::text
    || ',"payloadKind":' || to_jsonb(p_snapshot->>'payloadKind')::text
    || ',"pdfStorage":"exact_immutable_blob"'
    || ',"reportId":' || to_jsonb(p_snapshot->>'reportId')::text
    || ',"requestedTier":' || to_jsonb(p_snapshot->>'requestedTier')::text
    || ',"schemaVersion":' || to_jsonb(p_snapshot->>'schemaVersion')::text
    || ',"snapshotId":' || to_jsonb(v_snapshot_id)::text
    || ',"subject":' || to_jsonb(p_snapshot->>'subject')::text
    || ',"surface":' || to_jsonb(p_snapshot->>'surface')::text
    || ',"title":' || to_jsonb(p_snapshot->>'title')::text || '}';
  v_snapshot_digest_expected := 'sha256:' || encode(digest(v_snapshot_canonical, 'sha256'), 'hex');

  v_record_canonical := '{"accountIdHash":' || to_jsonb(v_account_id_hash)::text
    || ',"artifactDigest":' || to_jsonb(v_artifact_digest)::text
    || ',"blobId":' || to_jsonb(p_blob->>'blobId')::text
    || ',"createdAt":' || to_jsonb(p_blob->>'createdAt')::text
    || ',"mimeType":' || to_jsonb(p_blob->>'mimeType')::text
    || ',"pdfByteLength":' || v_blob_pdf_byte_length::text
    || ',"pdfDigest":' || to_jsonb(p_blob->>'pdfDigest')::text
    || ',"reportId":' || to_jsonb(p_blob->>'reportId')::text
    || ',"schemaVersion":' || to_jsonb(p_blob->>'schemaVersion')::text
    || ',"snapshotId":' || to_jsonb(p_blob->>'snapshotId')::text
    || ',"surface":' || to_jsonb(p_blob->>'surface')::text || '}';
  v_record_digest_expected := 'sha256:' || encode(digest(v_record_canonical, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtext(v_snapshot_id));

  if coalesce(p_snapshot->>'schemaVersion', '') <> 'pass4822-account-customer-artifact-snapshot-v1'
     or coalesce(p_snapshot->>'pdfStorage', '') <> 'exact_immutable_blob'
     or (select count(*) from jsonb_object_keys(p_snapshot)) <> 17
     or v_snapshot_digest_expected is null
     or coalesce(p_snapshot->>'snapshotDigest', '') <> v_snapshot_digest_expected
     or coalesce(p_snapshot->>'payloadDigest', '') <> v_payload_digest_expected
     or coalesce(v_account_id_hash, '') !~ '^[a-f0-9]{64}$'
     or v_account_id_hash <> encode(digest('velmere-account-binding-v1:' || p_account_id, 'sha256'), 'hex')
     or coalesce(p_snapshot->>'surface', '') not in ('audit','shield','real_markets','lens')
     or coalesce(p_snapshot->>'payloadKind', '') not in ('audit_customer_report_v1','market_customer_report_v1','lens_report_v1')
     or not (
       (p_snapshot->>'surface' = 'lens' and p_snapshot->>'payloadKind' = 'lens_report_v1')
       or (p_snapshot->>'surface' in ('shield','real_markets') and p_snapshot->>'payloadKind' = 'market_customer_report_v1')
       or (p_snapshot->>'surface' = 'audit' and p_snapshot->>'payloadKind' = 'audit_customer_report_v1')
     )
     or coalesce(p_snapshot->>'reportId', '') = '' or length(p_snapshot->>'reportId') > 180
     or coalesce(p_snapshot->>'requestedTier', '') = '' or length(p_snapshot->>'requestedTier') > 48
     or coalesce(p_snapshot->>'title', '') = '' or length(p_snapshot->>'title') > 240
     or coalesce(p_snapshot->>'subject', '') = '' or length(p_snapshot->>'subject') > 180
     or coalesce(p_snapshot->>'locale', '') not in ('pl','en','de')
     or not (p_snapshot ? 'deliveredTier')
     or jsonb_typeof(p_snapshot->'deliveredTier') not in ('string','null')
     or (jsonb_typeof(p_snapshot->'deliveredTier') = 'string' and coalesce(p_snapshot->>'deliveredTier', '') = '')
     or coalesce(p_snapshot->'canonicalArtifact'->>'schemaVersion', '') <> 'pass4821-canonical-customer-artifact-v1'
     or (select count(*) from jsonb_object_keys(p_snapshot->'canonicalArtifact')) <> 14
     or not (p_snapshot->'canonicalArtifact' ? 'deliveredTier')
     or v_artifact_digest_expected is null
     or p_snapshot->'canonicalArtifact'->>'surface' <> p_snapshot->>'surface'
     or p_snapshot->'canonicalArtifact'->>'reportId' <> p_snapshot->>'reportId'
     or p_snapshot->'canonicalArtifact'->>'requestedTier' <> p_snapshot->>'requestedTier'
     or p_snapshot->'canonicalArtifact'->'deliveredTier' is distinct from p_snapshot->'deliveredTier'
     or p_snapshot->'canonicalArtifact'->>'payloadDigest' <> v_payload_digest_expected
     or coalesce(p_snapshot->'canonicalArtifact'->>'rendererId', '') = ''
     or coalesce(p_snapshot->'canonicalArtifact'->>'layoutDigest', '') !~ '^sha256:[a-f0-9]{64}$'
     or coalesce(p_snapshot->'canonicalArtifact'->>'renderPlanDigest', '') !~ '^sha256:[a-f0-9]{64}$'
     or coalesce(v_artifact_digest, '') <> v_artifact_digest_expected
     or coalesce(v_pdf_digest, '') !~ '^sha256:[a-f0-9]{64}$'
     or v_snapshot_id <> 'artifact-' || (p_snapshot->>'surface') || '-' || left(v_account_id_hash, 16) || '-' || substring(v_artifact_digest from 8)
     or v_pdf_byte_length is null or v_pdf_byte_length < 1 or v_pdf_byte_length > 8388608
     or substring(v_pdf_bytes from 1 for 5) <> decode('255044462d', 'hex')
     or v_pdf_digest <> 'sha256:' || encode(digest(v_pdf_bytes, 'sha256'), 'hex')
     or v_snapshot_pdf_byte_length is null or v_snapshot_pdf_byte_length <> v_pdf_byte_length
     or v_artifact_page_count < 1 or v_artifact_rendered_row_count < 1
     or v_snapshot_generated_at is null
     or p_snapshot->>'generatedAt' <> to_char(v_snapshot_generated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') then
    raise exception 'customer_artifact_pdf_bundle_snapshot_contract_invalid' using errcode = '23514';
  end if;

  if coalesce(p_blob->>'schemaVersion', '') <> 'pass4824-account-customer-artifact-pdf-blob-v1'
     or (select count(*) from jsonb_object_keys(p_blob)) <> 12
     or v_record_digest_expected is null
     or coalesce(p_blob->>'blobId', '') <> 'pdf-' || left(v_account_id_hash, 16) || '-' || substring(v_artifact_digest from 8)
     or coalesce(p_blob->>'snapshotId', '') <> v_snapshot_id
     or coalesce(p_blob->>'accountIdHash', '') <> v_account_id_hash
     or coalesce(p_blob->>'surface', '') <> p_snapshot->>'surface'
     or coalesce(p_blob->>'reportId', '') <> p_snapshot->>'reportId'
     or coalesce(p_blob->>'artifactDigest', '') <> v_artifact_digest
     or coalesce(p_blob->>'pdfDigest', '') <> v_pdf_digest
     or v_blob_pdf_byte_length is null or v_blob_pdf_byte_length <> v_pdf_byte_length
     or coalesce(p_blob->>'mimeType', '') <> 'application/pdf'
     or v_blob_created_at is null or v_blob_created_at <> v_snapshot_generated_at
     or p_blob->>'createdAt' <> p_snapshot->>'generatedAt'
     or coalesce(p_blob->>'recordDigest', '') <> v_record_digest_expected then
    raise exception 'customer_artifact_pdf_bundle_blob_contract_invalid' using errcode = '23514';
  end if;

  select * into v_snapshot
    from public.velmere_customer_artifact_snapshots
    where snapshot_id = v_snapshot_id;
  v_snapshot_exists := found;
  select * into v_blob
    from public.velmere_customer_artifact_pdf_blobs
    where snapshot_id = v_snapshot_id;
  v_blob_exists := found;

  if v_snapshot_exists and not v_blob_exists and v_snapshot.pdf_storage = 'legacy_deterministic_rerender' then
    raise exception 'customer_artifact_pdf_bundle_legacy_snapshot_conflict' using errcode = '23514';
  end if;
  if v_snapshot_exists <> v_blob_exists then
    raise exception 'customer_artifact_pdf_bundle_partial_state_conflict' using errcode = '23514';
  end if;

  if v_snapshot_exists then
    if v_snapshot.pdf_storage <> 'exact_immutable_blob'
       or v_snapshot.account_id <> p_account_id
       or v_snapshot.account_id_hash <> v_account_id_hash
       or v_snapshot.snapshot_digest <> v_snapshot_digest_expected
       or v_snapshot.artifact_digest <> v_artifact_digest_expected
       or v_snapshot.snapshot <> p_snapshot
       or v_blob.account_id <> p_account_id
       or v_blob.account_id_hash <> v_account_id_hash
       or v_blob.schema_version <> p_blob->>'schemaVersion'
       or v_blob.blob_id <> p_blob->>'blobId'
       or v_blob.snapshot_id <> v_snapshot_id
       or v_blob.surface <> p_blob->>'surface'
       or v_blob.report_id <> p_blob->>'reportId'
       or v_blob.artifact_digest <> v_artifact_digest_expected
       or v_blob.pdf_digest <> v_pdf_digest
       or v_blob.pdf_byte_length <> v_pdf_byte_length
       or v_blob.mime_type <> 'application/pdf'
       or v_blob.created_at <> v_blob_created_at
       or v_blob.record_digest <> v_record_digest_expected
       or v_blob.pdf_bytes <> v_pdf_bytes then
      raise exception 'customer_artifact_pdf_bundle_immutable_conflict' using errcode = '23514';
    end if;
  else
    insert into public.velmere_customer_artifact_snapshots (
      snapshot_id, account_id, account_id_hash, surface, payload_kind, report_id,
      artifact_digest, snapshot_digest, pdf_storage, snapshot, generated_at
    ) values (
      v_snapshot_id, p_account_id, v_account_id_hash, p_snapshot->>'surface',
      p_snapshot->>'payloadKind', p_snapshot->>'reportId', v_artifact_digest_expected,
      v_snapshot_digest_expected, 'exact_immutable_blob', p_snapshot, v_snapshot_generated_at
    ) returning * into v_snapshot;

    insert into public.velmere_customer_artifact_pdf_blobs (
      schema_version, blob_id, snapshot_id, account_id, account_id_hash, surface,
      report_id, artifact_digest, pdf_digest, pdf_byte_length, mime_type, pdf_bytes,
      created_at, record_digest
    ) values (
      p_blob->>'schemaVersion', p_blob->>'blobId', v_snapshot_id, p_account_id,
      v_account_id_hash, p_blob->>'surface', p_blob->>'reportId', v_artifact_digest_expected,
      v_pdf_digest, v_pdf_byte_length, p_blob->>'mimeType', v_pdf_bytes,
      v_blob_created_at, v_record_digest_expected
    ) returning * into v_blob;
    v_created := true;
  end if;

  return jsonb_build_object(
    'schemaVersion', 'pass4824-account-customer-artifact-pdf-bundle-rpc-v1',
    'created', v_created,
    'snapshot', v_snapshot.snapshot,
    'blob', jsonb_build_object(
      'schemaVersion', v_blob.schema_version,
      'blobId', v_blob.blob_id,
      'snapshotId', v_blob.snapshot_id,
      'accountIdHash', v_blob.account_id_hash,
      'surface', v_blob.surface,
      'reportId', v_blob.report_id,
      'artifactDigest', v_blob.artifact_digest,
      'pdfDigest', v_blob.pdf_digest,
      'pdfByteLength', v_blob.pdf_byte_length,
      'mimeType', v_blob.mime_type,
      'createdAt', to_char(v_blob.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'recordDigest', v_blob.record_digest,
      'pdfBase64', encode(v_blob.pdf_bytes, 'base64')
    )
  );
end;
$$;

revoke all on function public.velmere_store_customer_artifact_pdf_bundle_v1(text, jsonb, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.velmere_store_customer_artifact_pdf_bundle_v1(text, jsonb, text, jsonb, text)
  to service_role;

comment on table public.velmere_customer_artifact_pdf_blobs is
  'PASS4824 insert-once exact PDF bytes, account/snapshot/report/digest bound; reads and atomic writes are service-role only.';
comment on function public.velmere_store_customer_artifact_pdf_bundle_v1(text, jsonb, text, jsonb, text) is
  'PASS4824 atomic exact snapshot plus PDF insert/read-existing RPC. Server recomputes payload, artifact, snapshot, PDF and metadata digests; deferred pair invariants fail closed.';
-- PASS4824 CUSTOMER ARTIFACT EXACT PDF BLOB END

-- P83 AUDIT EXACT ARTIFACT + ACCOUNT MESSAGE ATOMIC PUBLICATION BEGIN
-- One service-role RPC owns the transaction boundary. The existing exact-PDF
-- bundle function is invoked inside this transaction; any message validation or
-- insert failure rolls back a newly-created snapshot/blob pair.
create or replace function public.velmere_publish_audit_exact_artifact_v1(
  p_account_id text,
  p_snapshot jsonb,
  p_payload_canonical text,
  p_blob jsonb,
  p_pdf_base64 text,
  p_audit_snapshot jsonb,
  p_message jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bundle jsonb;
  v_message public.velmere_audit_account_messages%rowtype;
  v_existing_count integer := 0;
  v_created_message boolean := false;
  v_expected_account_hash text;
  v_exact jsonb;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_delivered_at timestamptz;
begin
  if p_account_id is null or length(p_account_id) < 1 or length(p_account_id) > 120
     or p_account_id like 'preview:%' then
    raise exception 'audit_exact_artifact_atomic_owner_required' using errcode = '23514';
  end if;
  if jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_blob) <> 'object'
     or jsonb_typeof(p_audit_snapshot) <> 'object'
     or jsonb_typeof(p_message) <> 'object' then
    raise exception 'audit_exact_artifact_atomic_payload_invalid' using errcode = '23514';
  end if;

  if (select count(*) from jsonb_object_keys(p_message)) <> 29
     or exists (
       select 1 from jsonb_object_keys(p_message) as supplied(key)
       where supplied.key not in (
         'id','message_id','request_id','account_id','contact_email','locale','review_level',
         'project_name','contract_address','package_label','message_status','delivery_channel',
         'delivery_status','operator_status','operator_note','pdf_route','public_report_route',
         'admin_route','export_route','audit_queue_id','payment_evidence_refs','customer_safe_report',
         'canonical_customer_snapshot','canonical_customer_snapshot_digest','action_log','delivered_at',
         'message','created_at','updated_at'
       )
     )
     or exists (
       select 1 from unnest(array[
         'id','message_id','request_id','account_id','contact_email','locale','review_level',
         'project_name','contract_address','package_label','message_status','delivery_channel',
         'delivery_status','operator_status','operator_note','pdf_route','public_report_route',
         'admin_route','export_route','audit_queue_id','payment_evidence_refs','customer_safe_report',
         'canonical_customer_snapshot','canonical_customer_snapshot_digest','action_log','delivered_at',
         'message','created_at','updated_at'
       ]) as expected(key)
       where not (p_message ? expected.key)
     ) then
    raise exception 'audit_exact_artifact_atomic_message_shape_invalid' using errcode = '23514';
  end if;

  v_expected_account_hash := encode(digest('velmere-account-binding-v1:' || p_account_id, 'sha256'), 'hex');
  v_exact := p_audit_snapshot->'exactAccountArtifact';
  begin
    v_created_at := (p_message->>'created_at')::timestamptz;
    v_updated_at := (p_message->>'updated_at')::timestamptz;
    v_delivered_at := nullif(p_message->>'delivered_at', '')::timestamptz;
  exception when others then
    raise exception 'audit_exact_artifact_atomic_message_timestamp_invalid' using errcode = '23514';
  end;

  if coalesce(p_message->>'id', '') = '' or length(p_message->>'id') > 160
     or coalesce(p_message->>'message_id', '') = '' or length(p_message->>'message_id') > 160
     or coalesce(p_message->>'request_id', '') = '' or length(p_message->>'request_id') > 160
     or p_message->>'id' is distinct from p_message->>'message_id'
     or p_message->>'account_id' <> p_account_id
     or coalesce(p_message->>'locale', '') not in ('pl','en','de')
     or coalesce(p_message->>'package_label', '') = '' or length(p_message->>'package_label') > 240
     or coalesce(p_message->>'message_status', '') not in ('received','queued','analysis_queue','ready','needs_evidence')
     or coalesce(p_message->>'delivery_channel', '') not in ('account','account_and_email_pending')
     or coalesce(p_message->>'delivery_status', '') not in ('queued','delivered_to_account','analysis_queue','ready_for_download')
     or coalesce(p_message->>'operator_status', '') not in ('intake','analysis_queue','automated_analysis','needs_evidence','pdf_attached','customer_safe_ready','delivered','blocked_redaction')
     or jsonb_typeof(p_message->'payment_evidence_refs') <> 'array'
     or jsonb_typeof(p_message->'action_log') <> 'array'
     or jsonb_typeof(p_message->'customer_safe_report') not in ('object','null')
     or jsonb_typeof(p_message->'message') <> 'object'
     or p_message->'message' ? 'canonicalCustomerSnapshot'
     or p_message->'message'->>'id' is distinct from p_message->>'id'
     or p_message->'message'->>'requestId' is distinct from p_message->>'request_id'
     or p_message->'message'->>'accountId' is distinct from p_account_id
     or p_message->'message'->>'locale' is distinct from p_message->>'locale'
     or p_message->'message'->>'packageLabel' is distinct from p_message->>'package_label'
     or p_message->'message'->>'status' is distinct from p_message->>'message_status'
     or p_message->'message'->>'deliveryChannel' is distinct from p_message->>'delivery_channel'
     or p_message->'message'->>'deliveryStatus' is distinct from p_message->>'delivery_status'
     or p_message->'message'->>'operatorStatus' is distinct from p_message->>'operator_status'
     or p_message->'canonical_customer_snapshot' is distinct from p_audit_snapshot
     or p_message->>'canonical_customer_snapshot_digest' is distinct from p_audit_snapshot->>'snapshotDigest'
     or coalesce(p_audit_snapshot->>'schemaVersion', '') <> 'pass4821-audit-account-customer-snapshot-v1'
     or coalesce(p_audit_snapshot->>'accountIdHash', '') <> v_expected_account_hash
     or jsonb_typeof(v_exact) <> 'object'
     or (select count(*) from jsonb_object_keys(v_exact)) <> 9
     or coalesce(v_exact->>'schemaVersion', '') <> 'p80-audit-exact-account-artifact-binding-v1'
     or coalesce(v_exact->>'storage', '') <> 'exact_immutable_blob'
     or coalesce(v_exact->>'snapshotId', '') <> coalesce(p_snapshot->>'snapshotId', '')
     or coalesce(v_exact->>'snapshotDigest', '') <> coalesce(p_snapshot->>'snapshotDigest', '')
     or coalesce(v_exact->>'artifactDigest', '') <> coalesce(p_snapshot->'canonicalArtifact'->>'artifactDigest', '')
     or coalesce(v_exact->>'pdfBlobId', '') <> coalesce(p_blob->>'blobId', '')
     or coalesce(v_exact->>'pdfBlobRecordDigest', '') <> coalesce(p_blob->>'recordDigest', '')
     or coalesce(v_exact->>'pdfDigest', '') <> coalesce(p_blob->>'pdfDigest', '')
     or coalesce(v_exact->>'pdfByteLength', '') <> coalesce(p_blob->>'pdfByteLength', '')
     or coalesce(p_snapshot->>'surface', '') <> 'audit'
     or coalesce(p_snapshot->>'payloadKind', '') <> 'audit_customer_report_v1'
     or coalesce(p_snapshot->>'accountIdHash', '') <> v_expected_account_hash
     or coalesce(p_snapshot->>'reportId', '') <> coalesce(p_audit_snapshot->>'reportId', '')
     or coalesce(p_snapshot->>'generatedAt', '') <> coalesce(p_audit_snapshot->>'generatedAt', '')
     or coalesce(p_snapshot->>'payloadDigest', '') <> coalesce(p_audit_snapshot->>'customerReportDigest', '') then
    raise exception 'audit_exact_artifact_atomic_cross_binding_invalid' using errcode = '23514';
  end if;

  -- Serialize retries for the same owner/message/artifact before either durable
  -- object is touched. This is an additional race guard; unique constraints and
  -- immutable triggers remain the final authority.
  perform pg_advisory_xact_lock(hashtextextended(
    'p83:' || p_account_id || ':' || p_message->>'id' || ':' || p_snapshot->>'snapshotId',
    0
  ));

  select count(*) into v_existing_count
  from public.velmere_audit_account_messages
  where id = p_message->>'id' or message_id = p_message->>'message_id';
  if v_existing_count > 1 then
    raise exception 'audit_exact_artifact_atomic_message_identity_ambiguous' using errcode = '23514';
  end if;

  if v_existing_count = 1 then
    select * into v_message
    from public.velmere_audit_account_messages
    where id = p_message->>'id' or message_id = p_message->>'message_id'
    for update;

    if v_message.id is distinct from p_message->>'id'
       or v_message.message_id is distinct from p_message->>'message_id'
       or v_message.request_id is distinct from p_message->>'request_id'
       or v_message.account_id is distinct from p_account_id
       or v_message.contact_email is distinct from nullif(p_message->>'contact_email', '')
       or v_message.locale is distinct from p_message->>'locale'
       or v_message.review_level is distinct from nullif(p_message->>'review_level', '')
       or v_message.project_name is distinct from nullif(p_message->>'project_name', '')
       or v_message.contract_address is distinct from nullif(p_message->>'contract_address', '')
       or v_message.package_label is distinct from p_message->>'package_label'
       or v_message.message_status is distinct from p_message->>'message_status'
       or v_message.delivery_channel is distinct from p_message->>'delivery_channel'
       or v_message.delivery_status is distinct from p_message->>'delivery_status'
       or v_message.operator_status is distinct from p_message->>'operator_status'
       or v_message.operator_note is distinct from nullif(p_message->>'operator_note', '')
       or v_message.pdf_route is distinct from nullif(p_message->>'pdf_route', '')
       or v_message.public_report_route is distinct from nullif(p_message->>'public_report_route', '')
       or v_message.admin_route is distinct from nullif(p_message->>'admin_route', '')
       or v_message.export_route is distinct from nullif(p_message->>'export_route', '')
       or v_message.audit_queue_id is distinct from nullif(p_message->>'audit_queue_id', '')
       or v_message.payment_evidence_refs is distinct from p_message->'payment_evidence_refs'
       or v_message.customer_safe_report is distinct from p_message->'customer_safe_report'
       or v_message.canonical_customer_snapshot is null
       or v_message.canonical_customer_snapshot is distinct from p_audit_snapshot
       or v_message.canonical_customer_snapshot_digest is distinct from p_audit_snapshot->>'snapshotDigest'
       or v_message.action_log is distinct from p_message->'action_log'
       or v_message.delivered_at is distinct from v_delivered_at
       or v_message.message is distinct from p_message->'message'
       or v_message.created_at is distinct from v_created_at
       or v_message.updated_at is distinct from v_updated_at
       or v_message.exact_account_artifact_snapshot_id is distinct from p_snapshot->>'snapshotId' then
      raise exception 'audit_exact_artifact_atomic_preexisting_message_conflict' using errcode = '23514';
    end if;
  end if;

  -- The nested function participates in this same PostgreSQL transaction.
  -- Any later exception in this RPC rolls back a newly inserted bundle.
  v_bundle := public.velmere_store_customer_artifact_pdf_bundle_v1(
    p_account_id,
    p_snapshot,
    p_payload_canonical,
    p_blob,
    p_pdf_base64
  );

  if v_existing_count = 0 then
    insert into public.velmere_audit_account_messages (
      id, message_id, request_id, account_id, contact_email, locale, review_level,
      project_name, contract_address, package_label, message_status, delivery_channel,
      delivery_status, operator_status, operator_note, pdf_route, public_report_route,
      admin_route, export_route, audit_queue_id, payment_evidence_refs, customer_safe_report,
      canonical_customer_snapshot, canonical_customer_snapshot_digest, action_log, delivered_at,
      message, created_at, updated_at
    ) values (
      p_message->>'id', p_message->>'message_id', p_message->>'request_id', p_account_id,
      nullif(p_message->>'contact_email', ''), p_message->>'locale', nullif(p_message->>'review_level', ''),
      nullif(p_message->>'project_name', ''), nullif(p_message->>'contract_address', ''),
      p_message->>'package_label', p_message->>'message_status', p_message->>'delivery_channel',
      p_message->>'delivery_status', p_message->>'operator_status', nullif(p_message->>'operator_note', ''),
      nullif(p_message->>'pdf_route', ''), nullif(p_message->>'public_report_route', ''),
      nullif(p_message->>'admin_route', ''), nullif(p_message->>'export_route', ''),
      nullif(p_message->>'audit_queue_id', ''), p_message->'payment_evidence_refs',
      coalesce(p_message->'customer_safe_report', 'null'::jsonb), p_audit_snapshot,
      p_audit_snapshot->>'snapshotDigest', p_message->'action_log', v_delivered_at,
      p_message->'message', v_created_at, v_updated_at
    ) returning * into v_message;
    v_created_message := true;
  end if;

  if v_message.id is distinct from p_message->>'id'
     or v_message.message_id is distinct from p_message->>'message_id'
     or v_message.request_id is distinct from p_message->>'request_id'
     or v_message.account_id is distinct from p_account_id
     or v_message.contact_email is distinct from nullif(p_message->>'contact_email', '')
     or v_message.locale is distinct from p_message->>'locale'
     or v_message.review_level is distinct from nullif(p_message->>'review_level', '')
     or v_message.project_name is distinct from nullif(p_message->>'project_name', '')
     or v_message.contract_address is distinct from nullif(p_message->>'contract_address', '')
     or v_message.package_label is distinct from p_message->>'package_label'
     or v_message.message_status is distinct from p_message->>'message_status'
     or v_message.delivery_channel is distinct from p_message->>'delivery_channel'
     or v_message.delivery_status is distinct from p_message->>'delivery_status'
     or v_message.operator_status is distinct from p_message->>'operator_status'
     or v_message.operator_note is distinct from nullif(p_message->>'operator_note', '')
     or v_message.pdf_route is distinct from nullif(p_message->>'pdf_route', '')
     or v_message.public_report_route is distinct from nullif(p_message->>'public_report_route', '')
     or v_message.admin_route is distinct from nullif(p_message->>'admin_route', '')
     or v_message.export_route is distinct from nullif(p_message->>'export_route', '')
     or v_message.audit_queue_id is distinct from nullif(p_message->>'audit_queue_id', '')
     or v_message.payment_evidence_refs is distinct from p_message->'payment_evidence_refs'
     or v_message.customer_safe_report is distinct from p_message->'customer_safe_report'
     or v_message.canonical_customer_snapshot is distinct from p_audit_snapshot
     or v_message.canonical_customer_snapshot_digest is distinct from p_audit_snapshot->>'snapshotDigest'
     or v_message.action_log is distinct from p_message->'action_log'
     or v_message.delivered_at is distinct from v_delivered_at
     or v_message.message is distinct from p_message->'message'
     or v_message.created_at is distinct from v_created_at
     or v_message.updated_at is distinct from v_updated_at
     or v_message.exact_account_artifact_snapshot_id is distinct from p_snapshot->>'snapshotId' then
    raise exception 'audit_exact_artifact_atomic_commit_verification_failed' using errcode = '23514';
  end if;

  return jsonb_build_object(
    'schemaVersion', 'p83-audit-exact-artifact-atomic-publication-rpc-v1',
    'createdMessage', v_created_message,
    'bundle', v_bundle,
    'message', to_jsonb(v_message)
  );
end;
$$;

revoke all on function public.velmere_publish_audit_exact_artifact_v1(text, jsonb, text, jsonb, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.velmere_publish_audit_exact_artifact_v1(text, jsonb, text, jsonb, text, jsonb, jsonb)
  to service_role;

comment on function public.velmere_publish_audit_exact_artifact_v1(text, jsonb, text, jsonb, text, jsonb, jsonb) is
  'P83 service-role-only transaction: validates and stores an exact Audit snapshot/PDF bundle and its immutable account-message link atomically. No memory, client or two-write fallback; any failure rolls back the transaction.';
-- P83 AUDIT EXACT ARTIFACT + ACCOUNT MESSAGE ATOMIC PUBLICATION END

-- PASS4826: durable, service-role-only last-known-good market sweep cache.
create table if not exists public.velmere_market_snapshots (
  snapshot_key text primary key,
  page integer not null,
  per_page integer not null,
  source text not null,
  generated_at timestamptz not null,
  stored_at timestamptz not null default now(),
  expires_at timestamptz not null,
  row_count integer not null,
  payload_hash text not null,
  rows jsonb not null,
  updated_at timestamptz not null default now(),
  constraint velmere_market_snapshots_key_check check (snapshot_key ~ '^[1-9][0-9]*:[1-9][0-9]*$'),
  constraint velmere_market_snapshots_key_binding_check check (snapshot_key = page::text || ':' || per_page::text),
  constraint velmere_market_snapshots_page_check check (page between 1 and 20),
  constraint velmere_market_snapshots_per_page_check check (per_page in (10, 25, 50, 100, 250)),
  constraint velmere_market_snapshots_row_count_check check (row_count between 1 and 250),
  constraint velmere_market_snapshots_row_count_page_check check (row_count <= per_page),
  constraint velmere_market_snapshots_source_check check (char_length(source) between 1 and 500),
  constraint velmere_market_snapshots_payload_hash_check check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint velmere_market_snapshots_expiry_check check (
    expires_at > stored_at and expires_at <= stored_at + interval '24 hours'
  ),
  constraint velmere_market_snapshots_rows_array_check check (jsonb_typeof(rows) = 'array'),
  constraint velmere_market_snapshots_row_count_match_check check (jsonb_array_length(rows) = row_count)
);

alter table public.velmere_market_snapshots enable row level security;
create index if not exists velmere_market_snapshots_expiry_idx
  on public.velmere_market_snapshots (expires_at);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'velmere_market_snapshots'
      and policyname = 'velmere_market_snapshots_service_role_all'
  ) then
    create policy velmere_market_snapshots_service_role_all
      on public.velmere_market_snapshots
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;

revoke all on table public.velmere_market_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.velmere_market_snapshots to service_role;

-- PASS4992 ATOMIC COMMERCE PAID + FULFILMENT OUTBOX BEGIN
-- A verified Stripe payment, its durable state event, and the provider-action
-- request are committed by one service-role-only transaction. No webhook may
-- call a fulfilment provider before this durable request exists.

create table if not exists public.velmere_commerce_fulfilment_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  idempotency_key text not null unique,
  order_draft_id text not null references public.velmere_order_drafts(id) on delete restrict,
  stripe_session_id text not null,
  stripe_event_id text not null,
  stripe_payment_intent_id text not null,
  cart_hash text not null,
  amount_total bigint not null,
  currency text not null,
  stripe_livemode boolean not null,
  fulfilment_action text not null,
  provider text not null,
  automatic_printful_line_count integer not null default 0,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  lease_token text,
  leased_until timestamptz,
  last_error_code text,
  redacted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint velmere_commerce_fulfilment_outbox_request_id_check
    check (request_id ~ '^commerce_fulfilment_[a-f0-9]{32}$'),
  constraint velmere_commerce_fulfilment_outbox_cart_hash_check
    check (cart_hash ~ '^[a-f0-9]{64}$'),
  constraint velmere_commerce_fulfilment_outbox_amount_check
    check (amount_total >= 0),
  constraint velmere_commerce_fulfilment_outbox_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint velmere_commerce_fulfilment_outbox_action_check
    check (fulfilment_action in ('printful_order_draft','manual_fulfilment_review')),
  constraint velmere_commerce_fulfilment_outbox_provider_check
    check (provider in ('printful','manual')),
  constraint velmere_commerce_fulfilment_outbox_action_provider_check
    check (
      (fulfilment_action = 'printful_order_draft' and provider = 'printful' and automatic_printful_line_count > 0)
      or
      (fulfilment_action = 'manual_fulfilment_review' and provider = 'manual' and automatic_printful_line_count = 0)
    ),
  constraint velmere_commerce_fulfilment_outbox_line_count_check
    check (automatic_printful_line_count between 0 and 1000),
  constraint velmere_commerce_fulfilment_outbox_status_check
    check (status in ('pending','processing','succeeded','retryable_failed','dead_letter','cancelled')),
  constraint velmere_commerce_fulfilment_outbox_attempt_count_check
    check (attempt_count between 0 and 1000)
);

create unique index if not exists velmere_commerce_fulfilment_outbox_payment_once_idx
  on public.velmere_commerce_fulfilment_outbox(order_draft_id, stripe_payment_intent_id);
create unique index if not exists velmere_commerce_fulfilment_outbox_stripe_event_idx
  on public.velmere_commerce_fulfilment_outbox(stripe_event_id);
create index if not exists velmere_commerce_fulfilment_outbox_claim_idx
  on public.velmere_commerce_fulfilment_outbox(status, next_attempt_at, created_at)
  where status in ('pending','retryable_failed');

alter table public.velmere_commerce_fulfilment_outbox enable row level security;
revoke all on table public.velmere_commerce_fulfilment_outbox from public, anon, authenticated;
grant select, insert, update on table public.velmere_commerce_fulfilment_outbox to service_role;

drop policy if exists velmere_commerce_fulfilment_outbox_service_role_all
  on public.velmere_commerce_fulfilment_outbox;
create policy velmere_commerce_fulfilment_outbox_service_role_all
  on public.velmere_commerce_fulfilment_outbox
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.velmere_commit_commerce_paid_and_enqueue_fulfilment(
  p_order_draft_id text,
  p_stripe_session_id text,
  p_stripe_event_id text,
  p_stripe_payment_intent_id text,
  p_cart_hash text,
  p_amount_total bigint,
  p_currency text,
  p_livemode boolean,
  p_fulfilment_action text,
  p_automatic_printful_line_count integer
)
returns table(
  transition_result text,
  order_status text,
  outbox_request_id text,
  outbox_status text,
  fulfilment_action text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.velmere_order_drafts%rowtype;
  v_existing public.velmere_commerce_fulfilment_outbox%rowtype;
  v_previous_status text;
  v_next_status text;
  v_request_id text;
  v_idempotency_key text;
  v_state_event_key text;
  v_provider text;
  v_actual_automatic_printful_count integer;
  v_missing_provider_variant_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'commerce_paid_service_role_required';
  end if;

  if p_order_draft_id is null or length(p_order_draft_id) not between 1 and 160
    or p_order_draft_id !~ '^[A-Za-z0-9_-]+$'
    or p_stripe_session_id is null or length(p_stripe_session_id) not between 3 and 255
    or p_stripe_session_id !~ '^cs_[A-Za-z0-9_]+$'
    or p_stripe_event_id is null or length(p_stripe_event_id) not between 3 and 255
    or p_stripe_event_id !~ '^evt_[A-Za-z0-9_]+$'
    or p_stripe_payment_intent_id is null or length(p_stripe_payment_intent_id) not between 3 and 255
    or p_stripe_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
    or p_cart_hash is null or lower(p_cart_hash) !~ '^[a-f0-9]{64}$'
    or p_amount_total is null or p_amount_total < 0
    or p_currency is null or upper(p_currency) !~ '^[A-Z]{3}$'
    or p_livemode is null
    or p_fulfilment_action not in ('printful_order_draft','manual_fulfilment_review')
    or p_automatic_printful_line_count is null
    or p_automatic_printful_line_count not between 0 and 1000
  then
    raise exception 'commerce_paid_input_invalid';
  end if;

  select * into v_order
  from public.velmere_order_drafts
  where id = p_order_draft_id
  for update;

  if not found then
    raise exception 'commerce_paid_order_missing';
  end if;

  if v_order.status not in (
    'draft','checkout_started','failed','paid','fulfilment_pending',
    'manual_fulfilment_required','fulfilment_created','fulfilled'
  ) then
    raise exception 'commerce_paid_order_state_rejected';
  end if;

  if v_order.cart_hash <> lower(p_cart_hash)
    or v_order.stripe_session_id <> p_stripe_session_id
    or v_order.expected_amount_total <> p_amount_total
    or upper(v_order.expected_currency) <> upper(p_currency)
    or v_order.stripe_livemode is distinct from p_livemode
    or (
      v_order.stripe_payment_intent_id is not null
      and v_order.stripe_payment_intent_id <> p_stripe_payment_intent_id
    )
  then
    raise exception 'commerce_paid_exact_binding_mismatch';
  end if;

  select
    count(*) filter (
      where item.value->>'provider' = 'printful'
        and item.value->>'fulfilmentMode' = 'automatic'
    ),
    count(*) filter (
      where item.value->>'provider' = 'printful'
        and item.value->>'fulfilmentMode' = 'automatic'
        and coalesce(item.value->>'providerVariantId', '') = ''
    )
  into v_actual_automatic_printful_count, v_missing_provider_variant_count
  from jsonb_array_elements(v_order.line_items) item(value);

  if v_actual_automatic_printful_count <> p_automatic_printful_line_count
    or (p_fulfilment_action = 'printful_order_draft' and (
      v_actual_automatic_printful_count < 1 or v_missing_provider_variant_count > 0
    ))
    or (p_fulfilment_action = 'manual_fulfilment_review' and v_actual_automatic_printful_count <> 0)
  then
    raise exception 'commerce_paid_fulfilment_binding_mismatch';
  end if;

  v_provider := case
    when p_fulfilment_action = 'printful_order_draft' then 'printful'
    else 'manual'
  end;
  v_request_id := 'commerce_fulfilment_' || substr(
    encode(digest(
      p_order_draft_id || ':' || p_stripe_session_id || ':' ||
      p_stripe_payment_intent_id || ':' || p_fulfilment_action,
      'sha256'
    ), 'hex'),
    1,
    32
  );
  v_idempotency_key := 'commerce_paid_outbox:' || encode(digest(
    p_order_draft_id || ':' || p_stripe_session_id || ':' ||
    p_stripe_payment_intent_id || ':' || lower(p_cart_hash) || ':' ||
    p_amount_total::text || ':' || upper(p_currency) || ':' ||
    p_livemode::text || ':' || p_fulfilment_action || ':' ||
    p_automatic_printful_line_count::text,
    'sha256'
  ), 'hex');
  v_state_event_key := 'commerce_paid_event:' || encode(digest(
    p_order_draft_id || ':' || p_stripe_session_id || ':' || p_stripe_payment_intent_id,
    'sha256'
  ), 'hex');

  select * into v_existing
  from public.velmere_commerce_fulfilment_outbox
  where order_draft_id = p_order_draft_id
    and stripe_payment_intent_id = p_stripe_payment_intent_id;

  if found then
    if v_existing.request_id <> v_request_id
      or v_existing.idempotency_key <> v_idempotency_key
      or v_existing.stripe_session_id <> p_stripe_session_id
      or v_existing.cart_hash <> lower(p_cart_hash)
      or v_existing.amount_total <> p_amount_total
      or v_existing.currency <> upper(p_currency)
      or v_existing.stripe_livemode is distinct from p_livemode
      or v_existing.fulfilment_action <> p_fulfilment_action
      or v_existing.automatic_printful_line_count <> p_automatic_printful_line_count
    then
      raise exception 'commerce_paid_idempotency_conflict';
    end if;

    return query select
      'already_enqueued'::text,
      v_order.status,
      v_existing.request_id,
      v_existing.status,
      v_existing.fulfilment_action,
      true;
    return;
  end if;

  v_previous_status := v_order.status;
  v_next_status := case
    when v_order.status in ('draft','checkout_started','failed') then 'paid'
    else v_order.status
  end;

  update public.velmere_order_drafts
  set status = v_next_status,
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      updated_at = now()
  where id = p_order_draft_id;

  insert into public.velmere_order_state_events (
    order_draft_id,
    event_type,
    status_before,
    status_after,
    stripe_session_id,
    stripe_event_id,
    provider,
    severity,
    source_route,
    idempotency_key,
    redacted_payload
  ) values (
    p_order_draft_id,
    'payment_succeeded',
    v_previous_status,
    v_next_status,
    p_stripe_session_id,
    p_stripe_event_id,
    'stripe',
    'info',
    'rpc.velmere_commit_commerce_paid_and_enqueue_fulfilment',
    v_state_event_key,
    jsonb_build_object(
      'stripeSessionId', p_stripe_session_id,
      'stripeEventId', p_stripe_event_id,
      'stripePaymentIntentId', p_stripe_payment_intent_id,
      'cartHash', lower(p_cart_hash),
      'amountTotal', p_amount_total,
      'currency', upper(p_currency),
      'livemode', p_livemode,
      'fulfilmentAction', p_fulfilment_action
    )
  );

  insert into public.velmere_commerce_fulfilment_outbox (
    request_id,
    idempotency_key,
    order_draft_id,
    stripe_session_id,
    stripe_event_id,
    stripe_payment_intent_id,
    cart_hash,
    amount_total,
    currency,
    stripe_livemode,
    fulfilment_action,
    provider,
    automatic_printful_line_count,
    redacted_payload
  ) values (
    v_request_id,
    v_idempotency_key,
    p_order_draft_id,
    p_stripe_session_id,
    p_stripe_event_id,
    p_stripe_payment_intent_id,
    lower(p_cart_hash),
    p_amount_total,
    upper(p_currency),
    p_livemode,
    p_fulfilment_action,
    v_provider,
    p_automatic_printful_line_count,
    jsonb_build_object(
      'orderDraftId', p_order_draft_id,
      'stripeSessionId', p_stripe_session_id,
      'stripeEventId', p_stripe_event_id,
      'stripePaymentIntentId', p_stripe_payment_intent_id,
      'automaticPrintfulLineCount', p_automatic_printful_line_count,
      'provider', v_provider
    )
  );

  return query select
    'enqueued'::text,
    v_next_status,
    v_request_id,
    'pending'::text,
    p_fulfilment_action,
    false;
end;
$$;

revoke all on function public.velmere_commit_commerce_paid_and_enqueue_fulfilment(
  text, text, text, text, text, bigint, text, boolean, text, integer
) from public, anon, authenticated;
grant execute on function public.velmere_commit_commerce_paid_and_enqueue_fulfilment(
  text, text, text, text, text, bigint, text, boolean, text, integer
) to service_role;

comment on table public.velmere_commerce_fulfilment_outbox is
  'Service-role-only transactional outbox. A paid state/event and exactly one fulfilment request commit together; no customer PII, raw provider payload, credentials, or secrets are stored.';
comment on function public.velmere_commit_commerce_paid_and_enqueue_fulfilment(
  text, text, text, text, text, bigint, text, boolean, text, integer
) is
  'Atomically verifies exact order/payment/provider-action binding, transitions paid state, writes the payment event, and idempotently enqueues one fulfilment request. Row lock serializes concurrent Stripe deliveries.';
-- PASS4992 ATOMIC COMMERCE PAID + FULFILMENT OUTBOX END

-- PASS4994 COMMERCE FULFILMENT OUTBOX WORKER BEGIN
-- Service-role-only, leased provider-effect execution for the PASS4992 outbox.
-- Customer PII and raw Stripe/Printful payloads are deliberately excluded.

alter table public.velmere_commerce_fulfilment_outbox
  add column if not exists lease_owner text,
  add column if not exists claimed_at timestamptz,
  add column if not exists provider_order_id text,
  add column if not exists execution_receipt jsonb,
  add column if not exists failure_receipt jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

create index if not exists velmere_commerce_fulfilment_outbox_stale_lease_idx
  on public.velmere_commerce_fulfilment_outbox(leased_until, created_at)
  where status = 'processing';

create or replace function public.velmere_guard_paid_commerce_order_binding_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.velmere_commerce_fulfilment_outbox o
    where o.order_draft_id = old.id
  ) and (
    new.cart_hash is distinct from old.cart_hash
    or new.expected_amount_total is distinct from old.expected_amount_total
    or new.expected_currency is distinct from old.expected_currency
    or new.stripe_session_id is distinct from old.stripe_session_id
    or new.stripe_livemode is distinct from old.stripe_livemode
    or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
    or new.line_items is distinct from old.line_items
  ) then
    raise exception 'commerce_outbox_order_binding_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists velmere_guard_paid_commerce_order_binding_immutable_trigger
  on public.velmere_order_drafts;
create trigger velmere_guard_paid_commerce_order_binding_immutable_trigger
before update on public.velmere_order_drafts
for each row execute function public.velmere_guard_paid_commerce_order_binding_immutable();

revoke all on function public.velmere_guard_paid_commerce_order_binding_immutable()
  from public, anon, authenticated;

create or replace function public.velmere_is_commerce_fulfilment_receipt_redacted(
  p_receipt jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_typeof(p_receipt) = 'object'
    and p_receipt->>'schemaVersion' = 'velmere.commerce-fulfilment-execution-receipt.v1'
    and p_receipt->>'receiptId' ~ '^commerce_fulfilment_receipt_[a-f0-9]{32}$'
    and p_receipt->>'receiptDigest' ~ '^sha256:[a-f0-9]{64}$'
    and p_receipt->>'requestBindingDigest' ~ '^sha256:[a-f0-9]{64}$'
    and p_receipt->>'stripePaymentIntentIdHash' ~ '^sha256:[a-f0-9]{64}$'
    and p_receipt->>'requestId' ~ '^commerce_fulfilment_[a-f0-9]{32}$'
    and length(p_receipt->>'orderDraftId') between 1 and 160
    and p_receipt->>'orderDraftId' ~ '^[A-Za-z0-9_-]+$'
    and p_receipt->>'attempt' ~ '^[1-9][0-9]{0,3}$'
    and p_receipt->>'processedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    and p_receipt->'redactionBoundary' = jsonb_build_object(
      'customerPiiStored', false,
      'rawProviderPayloadStored', false,
      'secretsStored', false
    )
    and jsonb_typeof(p_receipt->'providerResult') = 'object'
    and length(p_receipt->'providerResult'->>'externalId') between 1 and 160
    and p_receipt->'providerResult'->>'externalId' ~ '^[A-Za-z0-9_-]+$'
    and (
      p_receipt->'providerResult'->>'providerOrderIdHash' is null
      or p_receipt->'providerResult'->>'providerOrderIdHash' ~ '^sha256:[a-f0-9]{64}$'
    )
    and (
      p_receipt->'providerResult'->>'status' is null
      or p_receipt->'providerResult'->>'status' ~ '^[A-Za-z0-9_.:-]{1,80}$'
    )
    and jsonb_typeof(p_receipt->'providerResult'->'confirmed') = 'boolean'
    and jsonb_typeof(p_receipt->'providerResult'->'reconciled') = 'boolean'
    and p_receipt->'providerResult'->>'reconciliationAttempts' ~ '^(0|[1-9][0-9]?)$'
    and (
      p_receipt->'providerResult'->>'errorCode' is null
      or p_receipt->'providerResult'->>'errorCode' ~ '^[a-z0-9:_-]{1,120}$'
    )
    and jsonb_typeof(p_receipt->'providerResult'->'ambiguous') = 'boolean'
    and not exists (
      select 1 from jsonb_object_keys(p_receipt) as keys(key)
      where key not in (
        'schemaVersion', 'receiptId', 'receiptDigest', 'requestBindingDigest',
        'requestId', 'orderDraftId', 'stripePaymentIntentIdHash', 'action',
        'provider', 'attempt', 'result', 'providerResult', 'processedAt',
        'redactionBoundary'
      )
    )
    and not exists (
      select 1 from jsonb_object_keys(p_receipt->'providerResult') as keys(key)
      where key not in (
        'externalId', 'providerOrderIdHash', 'status', 'confirmed',
        'reconciled', 'reconciliationAttempts', 'errorCode', 'ambiguous'
      )
    ),
    false
  );
$$;

revoke all on function public.velmere_is_commerce_fulfilment_receipt_redacted(jsonb)
  from public, anon, authenticated;
grant execute on function public.velmere_is_commerce_fulfilment_receipt_redacted(jsonb)
  to service_role;

alter table public.velmere_commerce_fulfilment_outbox enable row level security;
revoke all on table public.velmere_commerce_fulfilment_outbox from public, anon, authenticated;
grant select, insert, update on table public.velmere_commerce_fulfilment_outbox to service_role;

create or replace function public.velmere_claim_commerce_fulfilment_outbox(
  p_worker_id text,
  p_lease_token text,
  p_limit integer default 5,
  p_lease_seconds integer default 120
)
returns table(
  request_id text,
  idempotency_key text,
  order_draft_id text,
  stripe_session_id text,
  stripe_event_id text,
  stripe_payment_intent_id text,
  cart_hash text,
  amount_total bigint,
  currency text,
  stripe_livemode boolean,
  fulfilment_action text,
  provider text,
  automatic_printful_line_count integer,
  attempt_count integer,
  order_status text,
  order_locale text,
  order_cart_hash text,
  order_expected_amount_total bigint,
  order_expected_currency text,
  order_stripe_session_id text,
  order_stripe_livemode boolean,
  order_stripe_payment_intent_id text,
  order_line_items jsonb,
  order_guard_summary jsonb,
  order_created_at timestamptz,
  order_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'commerce_outbox_worker_service_role_required';
  end if;
  if p_worker_id is null or length(p_worker_id) not between 24 and 160
    or p_worker_id !~ '^[A-Za-z0-9_-]+$'
    or p_lease_token is null or length(p_lease_token) not between 24 and 180
    or p_lease_token !~ '^[A-Za-z0-9_-]+$'
    or p_limit is null or p_limit not between 1 and 10
    or p_lease_seconds is null or p_lease_seconds not between 90 and 300
  then
    raise exception 'commerce_outbox_worker_claim_input_invalid';
  end if;

  return query
  with candidates as (
    select o.id
    from public.velmere_commerce_fulfilment_outbox o
    where (
      o.status in ('pending', 'retryable_failed')
      and coalesce(o.next_attempt_at, '-infinity'::timestamptz) <= now()
    ) or (
      o.status = 'processing'
      and coalesce(o.leased_until, '-infinity'::timestamptz) <= now()
    )
    order by
      case when o.status = 'processing' then 0 else 1 end,
      coalesce(o.next_attempt_at, o.created_at),
      o.created_at,
      o.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.velmere_commerce_fulfilment_outbox o
    set status = 'processing',
        attempt_count = o.attempt_count + 1,
        lease_token = p_lease_token,
        lease_owner = p_worker_id,
        claimed_at = now(),
        leased_until = now() + make_interval(secs => p_lease_seconds),
        next_attempt_at = null,
        updated_at = now()
    from candidates c
    where o.id = c.id
    returning o.*
  )
  select
    c.request_id,
    c.idempotency_key,
    c.order_draft_id,
    c.stripe_session_id,
    c.stripe_event_id,
    c.stripe_payment_intent_id,
    c.cart_hash,
    c.amount_total,
    c.currency,
    c.stripe_livemode,
    c.fulfilment_action,
    c.provider,
    c.automatic_printful_line_count,
    c.attempt_count,
    d.status,
    d.locale,
    d.cart_hash,
    d.expected_amount_total,
    d.expected_currency,
    d.stripe_session_id,
    d.stripe_livemode,
    d.stripe_payment_intent_id,
    d.line_items,
    d.guard_summary,
    d.created_at,
    d.updated_at
  from claimed c
  join public.velmere_order_drafts d on d.id = c.order_draft_id
  order by c.claimed_at, c.id;
end;
$$;

create or replace function public.velmere_complete_commerce_fulfilment_outbox(
  p_request_id text,
  p_lease_token text,
  p_provider_order_id text,
  p_execution_receipt jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.velmere_commerce_fulfilment_outbox%rowtype;
  v_next_order_status text;
  v_event_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'commerce_outbox_worker_service_role_required';
  end if;
  if p_request_id is null or p_request_id !~ '^commerce_fulfilment_[a-f0-9]{32}$'
    or p_lease_token is null or length(p_lease_token) not between 24 and 180
    or jsonb_typeof(p_execution_receipt) is distinct from 'object'
    or octet_length(p_execution_receipt::text) > 16384
    or p_execution_receipt->>'schemaVersion' is distinct from 'velmere.commerce-fulfilment-execution-receipt.v1'
    or coalesce(p_execution_receipt->>'receiptDigest', '') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_execution_receipt->>'requestBindingDigest', '') !~ '^sha256:[a-f0-9]{64}$'
    or coalesce(p_execution_receipt->>'stripePaymentIntentIdHash', '') !~ '^sha256:[a-f0-9]{64}$'
    or not public.velmere_is_commerce_fulfilment_receipt_redacted(p_execution_receipt)
  then
    raise exception 'commerce_outbox_worker_complete_input_invalid';
  end if;

  select * into v_item
  from public.velmere_commerce_fulfilment_outbox
  where request_id = p_request_id
  for update;
  if not found then raise exception 'commerce_outbox_worker_item_missing'; end if;
  if v_item.status = 'succeeded' then
    if v_item.provider_order_id is not distinct from p_provider_order_id
      and v_item.execution_receipt->>'receiptDigest' is not distinct from
        p_execution_receipt->>'receiptDigest'
    then
      return 'succeeded';
    end if;
    raise exception 'commerce_outbox_worker_completion_idempotency_conflict';
  end if;
  if v_item.status is distinct from 'processing' or v_item.lease_token is distinct from p_lease_token then
    raise exception 'commerce_outbox_worker_stale_lease';
  end if;
  if p_execution_receipt->>'requestId' is distinct from v_item.request_id
    or p_execution_receipt->>'orderDraftId' is distinct from v_item.order_draft_id
    or p_execution_receipt->>'action' is distinct from v_item.fulfilment_action
    or p_execution_receipt->>'provider' is distinct from v_item.provider
    or p_execution_receipt->>'attempt' is distinct from v_item.attempt_count::text
    or v_item.claimed_at is null
    or (p_execution_receipt->>'processedAt')::timestamptz < v_item.claimed_at - interval '30 seconds'
    or (p_execution_receipt->>'processedAt')::timestamptz > now() + interval '30 seconds'
    or p_execution_receipt->>'stripePaymentIntentIdHash' is distinct from
      'sha256:' || encode(digest(v_item.stripe_payment_intent_id, 'sha256'), 'hex')
    or p_execution_receipt->>'requestBindingDigest' is distinct from
      'sha256:' || encode(digest(concat_ws('|',
        'velmere.commerce-fulfilment-request-binding.v1',
        v_item.request_id,
        v_item.order_draft_id,
        v_item.stripe_session_id,
        v_item.stripe_event_id,
        v_item.stripe_payment_intent_id,
        v_item.cart_hash,
        v_item.amount_total::text,
        v_item.currency,
        v_item.stripe_livemode::text,
        v_item.fulfilment_action,
        v_item.provider,
        v_item.automatic_printful_line_count::text
      ), 'sha256'), 'hex')
    or jsonb_typeof(p_execution_receipt->'providerResult') is distinct from 'object'
    or p_execution_receipt->'providerResult'->>'externalId' is distinct from v_item.order_draft_id
  then
    raise exception 'commerce_outbox_worker_receipt_binding_mismatch';
  end if;

  if v_item.fulfilment_action = 'printful_order_draft' then
    if p_provider_order_id is null or p_provider_order_id !~ '^[1-9][0-9]{0,39}$'
      or coalesce(p_execution_receipt->>'result', '') not in ('provider_draft_created', 'provider_draft_reconciled')
      or p_execution_receipt->'providerResult'->>'providerOrderIdHash' is distinct from
        'sha256:' || encode(digest(p_provider_order_id, 'sha256'), 'hex')
    then
      raise exception 'commerce_outbox_worker_provider_result_invalid';
    end if;
    v_next_order_status := 'fulfilment_pending';
    v_event_type := 'provider_draft_created';
  else
    if p_provider_order_id is not null
      or p_execution_receipt->>'result' is distinct from 'manual_review_required'
      or p_execution_receipt->'providerResult'->>'providerOrderIdHash' is not null
    then
      raise exception 'commerce_outbox_worker_manual_result_invalid';
    end if;
    v_next_order_status := 'manual_fulfilment_required';
    v_event_type := 'manual_fulfilment_required';
  end if;

  update public.velmere_commerce_fulfilment_outbox
  set status = 'succeeded',
      provider_order_id = p_provider_order_id,
      execution_receipt = p_execution_receipt,
      failure_receipt = null,
      last_error_code = null,
      lease_token = null,
      lease_owner = null,
      leased_until = null,
      next_attempt_at = null,
      completed_at = now(),
      dead_lettered_at = null,
      updated_at = now()
  where id = v_item.id;

  update public.velmere_order_drafts
  set status = v_next_order_status,
      updated_at = now()
  where id = v_item.order_draft_id
    and cart_hash = v_item.cart_hash
    and stripe_session_id = v_item.stripe_session_id
    and stripe_payment_intent_id = v_item.stripe_payment_intent_id
    and expected_amount_total = v_item.amount_total
    and upper(expected_currency) = v_item.currency
    and stripe_livemode is not distinct from v_item.stripe_livemode
    and status in ('paid', 'fulfilment_pending', 'manual_fulfilment_required', 'fulfilment_created');
  if not found then
    raise exception 'commerce_outbox_worker_order_binding_changed';
  end if;

  insert into public.velmere_order_state_events (
    order_draft_id, event_type, status_before, status_after,
    stripe_session_id, stripe_event_id, provider, provider_order_id,
    severity, source_route, idempotency_key, redacted_payload
  ) values (
    v_item.order_draft_id, v_event_type, null, v_next_order_status,
    v_item.stripe_session_id, v_item.stripe_event_id, v_item.provider, p_provider_order_id,
    case when v_item.provider = 'manual' then 'review' else 'info' end,
    'rpc.velmere_complete_commerce_fulfilment_outbox',
    'commerce_fulfilment_complete:' || v_item.request_id,
    jsonb_build_object(
      'requestId', v_item.request_id,
      'receiptDigest', p_execution_receipt->>'receiptDigest',
      'requestBindingDigest', p_execution_receipt->>'requestBindingDigest',
      'attempt', v_item.attempt_count,
      'providerResultRecorded', p_provider_order_id is not null
    )
  ) on conflict (idempotency_key) do nothing;
  return 'succeeded';
end;
$$;

create or replace function public.velmere_fail_commerce_fulfilment_outbox(
  p_request_id text,
  p_lease_token text,
  p_retryable boolean,
  p_error_code text,
  p_retry_threshold integer default 8,
  p_execution_receipt jsonb default '{}'::jsonb
)
returns table(settled_status text, next_attempt_at timestamptz, retry_after_seconds bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.velmere_commerce_fulfilment_outbox%rowtype;
  v_base_seconds integer;
  v_jitter_seconds integer;
  v_delay_seconds integer;
  v_next_attempt_at timestamptz;
  v_dead_letter boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'commerce_outbox_worker_service_role_required';
  end if;
  if p_request_id is null or p_request_id !~ '^commerce_fulfilment_[a-f0-9]{32}$'
    or p_lease_token is null or length(p_lease_token) not between 24 and 180
    or p_retryable is null
    or p_error_code is null or p_error_code !~ '^[a-z0-9:_-]{1,120}$'
    or p_retry_threshold is null or p_retry_threshold not between 1 and 20
    or jsonb_typeof(p_execution_receipt) is distinct from 'object'
    or octet_length(p_execution_receipt::text) > 16384
    or p_execution_receipt->>'schemaVersion' is distinct from 'velmere.commerce-fulfilment-execution-receipt.v1'
    or coalesce(p_execution_receipt->>'receiptDigest', '') !~ '^sha256:[a-f0-9]{64}$'
    or not public.velmere_is_commerce_fulfilment_receipt_redacted(p_execution_receipt)
  then
    raise exception 'commerce_outbox_worker_fail_input_invalid';
  end if;

  select * into v_item
  from public.velmere_commerce_fulfilment_outbox
  where request_id = p_request_id
  for update;
  if not found then raise exception 'commerce_outbox_worker_item_missing'; end if;
  if v_item.status in ('retryable_failed', 'dead_letter')
    and v_item.failure_receipt->>'receiptDigest' is not distinct from
      p_execution_receipt->>'receiptDigest'
  then
    return query select
      v_item.status,
      v_item.next_attempt_at,
      case when v_item.next_attempt_at is null then null::bigint
        else greatest(0, ceil(extract(epoch from (v_item.next_attempt_at - now())))::bigint)
      end;
    return;
  end if;
  if v_item.status is distinct from 'processing' or v_item.lease_token is distinct from p_lease_token then
    raise exception 'commerce_outbox_worker_stale_lease';
  end if;
  if p_execution_receipt->>'requestId' is distinct from v_item.request_id
    or p_execution_receipt->>'orderDraftId' is distinct from v_item.order_draft_id
    or p_execution_receipt->>'action' is distinct from v_item.fulfilment_action
    or p_execution_receipt->>'provider' is distinct from v_item.provider
    or p_execution_receipt->>'attempt' is distinct from v_item.attempt_count::text
    or v_item.claimed_at is null
    or (p_execution_receipt->>'processedAt')::timestamptz < v_item.claimed_at - interval '30 seconds'
    or (p_execution_receipt->>'processedAt')::timestamptz > now() + interval '30 seconds'
    or p_execution_receipt->>'stripePaymentIntentIdHash' is distinct from
      'sha256:' || encode(digest(v_item.stripe_payment_intent_id, 'sha256'), 'hex')
    or p_execution_receipt->>'requestBindingDigest' is distinct from
      'sha256:' || encode(digest(concat_ws('|',
        'velmere.commerce-fulfilment-request-binding.v1',
        v_item.request_id,
        v_item.order_draft_id,
        v_item.stripe_session_id,
        v_item.stripe_event_id,
        v_item.stripe_payment_intent_id,
        v_item.cart_hash,
        v_item.amount_total::text,
        v_item.currency,
        v_item.stripe_livemode::text,
        v_item.fulfilment_action,
        v_item.provider,
        v_item.automatic_printful_line_count::text
      ), 'sha256'), 'hex')
    or jsonb_typeof(p_execution_receipt->'providerResult') is distinct from 'object'
    or p_execution_receipt->'providerResult'->>'externalId' is distinct from v_item.order_draft_id
    or p_execution_receipt->'providerResult'->>'providerOrderIdHash' is not null
    or p_execution_receipt->'providerResult'->>'errorCode' is distinct from p_error_code
  then
    raise exception 'commerce_outbox_worker_receipt_binding_mismatch';
  end if;

  v_dead_letter := not p_retryable or v_item.attempt_count >= p_retry_threshold;
  if p_execution_receipt->>'result' is distinct from
    (case when v_dead_letter then 'dead_letter' else 'retryable_failed' end)
  then
    raise exception 'commerce_outbox_worker_failure_receipt_status_mismatch';
  end if;
  if v_dead_letter then
    update public.velmere_commerce_fulfilment_outbox
    set status = 'dead_letter',
        failure_receipt = p_execution_receipt,
        last_error_code = p_error_code,
        lease_token = null,
        lease_owner = null,
        leased_until = null,
        next_attempt_at = null,
        dead_lettered_at = now(),
        updated_at = now()
    where id = v_item.id;

    update public.velmere_order_drafts
    set status = 'manual_fulfilment_required', updated_at = now()
    where id = v_item.order_draft_id
      and status not in ('fulfilled', 'refunded', 'cancelled');

    insert into public.velmere_order_state_events (
      order_draft_id, event_type, status_before, status_after,
      stripe_session_id, stripe_event_id, provider, severity,
      source_route, idempotency_key, redacted_payload
    ) values (
      v_item.order_draft_id, 'provider_draft_failed', null, 'manual_fulfilment_required',
      v_item.stripe_session_id, v_item.stripe_event_id, v_item.provider, 'critical',
      'rpc.velmere_fail_commerce_fulfilment_outbox',
      'commerce_fulfilment_dead_letter:' || v_item.request_id,
      jsonb_build_object(
        'requestId', v_item.request_id,
        'receiptDigest', p_execution_receipt->>'receiptDigest',
        'errorCode', p_error_code,
        'attempt', v_item.attempt_count,
        'manualReviewRequired', true
      )
    ) on conflict (idempotency_key) do nothing;
    return query select 'dead_letter'::text, null::timestamptz, null::bigint;
    return;
  end if;

  v_base_seconds := least(
    3000,
    (15 * power(2::numeric, least(greatest(v_item.attempt_count - 1, 0), 8)))::integer
  );
  v_jitter_seconds := get_byte(
    digest(v_item.request_id || ':' || v_item.attempt_count::text, 'sha256'),
    0
  ) % (least(600, greatest(1, floor(v_base_seconds * 0.20)::integer)) + 1);
  v_delay_seconds := least(3600, v_base_seconds + v_jitter_seconds);
  v_next_attempt_at := now() + make_interval(secs => v_delay_seconds);

  update public.velmere_commerce_fulfilment_outbox
  set status = 'retryable_failed',
      failure_receipt = p_execution_receipt,
      last_error_code = p_error_code,
      lease_token = null,
      lease_owner = null,
      leased_until = null,
      next_attempt_at = v_next_attempt_at,
      updated_at = now()
  where id = v_item.id;
  return query select 'retryable_failed'::text, v_next_attempt_at, v_delay_seconds::bigint;
end;
$$;

create or replace function public.velmere_release_commerce_fulfilment_outbox(
  p_request_id text,
  p_lease_token text,
  p_reason_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'commerce_outbox_worker_service_role_required';
  end if;
  if p_request_id is null or p_request_id !~ '^commerce_fulfilment_[a-f0-9]{32}$'
    or p_lease_token is null or length(p_lease_token) not between 24 and 180
    or p_reason_code is null or p_reason_code !~ '^[a-z0-9:_-]{1,120}$'
  then
    raise exception 'commerce_outbox_worker_release_input_invalid';
  end if;
  update public.velmere_commerce_fulfilment_outbox
  set status = 'pending',
      attempt_count = greatest(0, attempt_count - 1),
      lease_token = null,
      lease_owner = null,
      leased_until = null,
      next_attempt_at = now(),
      last_error_code = p_reason_code,
      updated_at = now()
  where request_id = p_request_id
    and status = 'processing'
    and lease_token = p_lease_token;
  if not found then raise exception 'commerce_outbox_worker_stale_lease'; end if;
  return 'released';
end;
$$;

revoke all on function public.velmere_claim_commerce_fulfilment_outbox(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.velmere_complete_commerce_fulfilment_outbox(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.velmere_fail_commerce_fulfilment_outbox(text, text, boolean, text, integer, jsonb)
  from public, anon, authenticated;
revoke all on function public.velmere_release_commerce_fulfilment_outbox(text, text, text)
  from public, anon, authenticated;
grant execute on function public.velmere_claim_commerce_fulfilment_outbox(text, text, integer, integer)
  to service_role;
grant execute on function public.velmere_complete_commerce_fulfilment_outbox(text, text, text, jsonb)
  to service_role;
grant execute on function public.velmere_fail_commerce_fulfilment_outbox(text, text, boolean, text, integer, jsonb)
  to service_role;
grant execute on function public.velmere_release_commerce_fulfilment_outbox(text, text, text)
  to service_role;

comment on function public.velmere_claim_commerce_fulfilment_outbox(text, text, integer, integer) is
  'Claims a bounded batch with row locks and SKIP LOCKED, including deterministic stale-lease recovery. Service role only.';
comment on function public.velmere_complete_commerce_fulfilment_outbox(text, text, text, jsonb) is
  'Atomically records the redacted, digest-bound provider result, settles the outbox, updates the exact durable order and appends its state event.';
comment on function public.velmere_fail_commerce_fulfilment_outbox(text, text, boolean, text, integer, jsonb) is
  'Atomically retries with deterministic bounded exponential backoff or dead-letters into manual review. Service role only.';
comment on function public.velmere_release_commerce_fulfilment_outbox(text, text, text) is
  'Releases a claim before an external effect when the bounded worker deadline is exhausted.';
-- PASS4994 COMMERCE FULFILMENT OUTBOX WORKER END
-- PASS36 A89 password-recovery grant single-use ledger.
create table if not exists public.velmere_password_recovery_grants (
  nonce_hash text primary key,
  subject_fingerprint text not null,
  family_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint velmere_password_recovery_grants_nonce_hash_check check (nonce_hash ~ '^[a-f0-9]{64}$'),
  constraint velmere_password_recovery_grants_subject_check check (subject_fingerprint ~ '^[a-f0-9]{32}$'),
  constraint velmere_password_recovery_grants_expiry_check check (expires_at > issued_at and expires_at <= issued_at + interval '10 minutes')
);

alter table public.velmere_password_recovery_grants enable row level security;
revoke all on table public.velmere_password_recovery_grants from public, anon, authenticated;
grant select, insert, update, delete on table public.velmere_password_recovery_grants to service_role;

create index if not exists velmere_password_recovery_grants_expiry_idx
  on public.velmere_password_recovery_grants (expires_at)
  where consumed_at is null;

create or replace function public.velmere_issue_password_recovery_grant(
  p_nonce_hash text,
  p_subject_fingerprint text,
  p_family_id uuid,
  p_expires_at timestamptz
)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'password_recovery_grant_service_role_required';
  end if;
  if p_nonce_hash is null or p_nonce_hash !~ '^[a-f0-9]{64}$'
    or p_subject_fingerprint is null or p_subject_fingerprint !~ '^[a-f0-9]{32}$'
    or p_family_id is null
    or p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '10 minutes'
  then
    raise exception 'password_recovery_grant_issue_input_invalid';
  end if;
  insert into public.velmere_password_recovery_grants (
    nonce_hash, subject_fingerprint, family_id, issued_at, expires_at, consumed_at
  ) values (
    p_nonce_hash, p_subject_fingerprint, p_family_id, now(), p_expires_at, null
  );
  return query select 'issued'::text;
exception
  when unique_violation then
    return query select 'duplicate'::text;
end;
$$;

create or replace function public.velmere_consume_password_recovery_grant(
  p_nonce_hash text,
  p_subject_fingerprint text,
  p_family_id uuid
)
returns table(status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'password_recovery_grant_service_role_required';
  end if;
  if p_nonce_hash is null or p_nonce_hash !~ '^[a-f0-9]{64}$'
    or p_subject_fingerprint is null or p_subject_fingerprint !~ '^[a-f0-9]{32}$'
    or p_family_id is null
  then
    raise exception 'password_recovery_grant_consume_input_invalid';
  end if;

  update public.velmere_password_recovery_grants
  set consumed_at = now()
  where nonce_hash = p_nonce_hash
    and subject_fingerprint = p_subject_fingerprint
    and family_id = p_family_id
    and consumed_at is null
    and expires_at >= now();
  if found then
    return query select 'consumed'::text;
    return;
  end if;

  if exists (
    select 1 from public.velmere_password_recovery_grants
    where nonce_hash = p_nonce_hash
      and subject_fingerprint = p_subject_fingerprint
      and family_id = p_family_id
      and consumed_at is not null
  ) then
    return query select 'replayed'::text;
  elsif exists (
    select 1 from public.velmere_password_recovery_grants
    where nonce_hash = p_nonce_hash
      and subject_fingerprint = p_subject_fingerprint
      and family_id = p_family_id
      and expires_at < now()
  ) then
    return query select 'expired'::text;
  end if;
  return query select 'missing'::text;
end;
$$;

revoke all on function public.velmere_issue_password_recovery_grant(text,text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.velmere_consume_password_recovery_grant(text,text,uuid) from public, anon, authenticated;
grant execute on function public.velmere_issue_password_recovery_grant(text,text,uuid,timestamptz) to service_role;
grant execute on function public.velmere_consume_password_recovery_grant(text,text,uuid) to service_role;

comment on table public.velmere_password_recovery_grants is
  'Single-use, service-role-only password recovery grant nonce ledger. Raw recovery tokens are never stored.';
comment on function public.velmere_issue_password_recovery_grant(text,text,uuid,timestamptz) is
  'Issues one hash-only recovery nonce bound to an auth-session subject and family for at most ten minutes.';
comment on function public.velmere_consume_password_recovery_grant(text,text,uuid) is
  'Atomically consumes a recovery grant once. Replays, expired grants and mismatched subject/family fail closed.';

-- PASS36 A97R1 payment operator assertion ledger and single-use consume RPC.
create table if not exists public.velmere_payment_operator_action_assertions (
  primary_assertion_id_hash text primary key,
  scope text not null check (scope in ('payment:reconcile','payment:requeue')),
  action_digest text not null,
  body_sha256 text not null,
  actor_id_hash text not null,
  session_id_hash text not null,
  independent_approval_id_hash text unique,
  approver_actor_id_hash text,
  expires_at_ms bigint not null,
  consumed_at timestamptz not null default now(),
  check (primary_assertion_id_hash ~ '^[a-f0-9]{64}$'),
  check (action_digest ~ '^[a-f0-9]{64}$'),
  check (body_sha256 ~ '^[a-f0-9]{64}$'),
  check (actor_id_hash ~ '^[a-f0-9]{64}$'),
  check (session_id_hash ~ '^[a-f0-9]{64}$'),
  check (independent_approval_id_hash is null or independent_approval_id_hash ~ '^[a-f0-9]{64}$'),
  check (approver_actor_id_hash is null or approver_actor_id_hash ~ '^[a-f0-9]{64}$'),
  check ((scope='payment:reconcile' and independent_approval_id_hash is null and approver_actor_id_hash is null)
    or (scope='payment:requeue' and independent_approval_id_hash is not null and approver_actor_id_hash is not null and approver_actor_id_hash <> actor_id_hash))
);
alter table public.velmere_payment_operator_action_assertions enable row level security;
revoke all on table public.velmere_payment_operator_action_assertions from public, anon, authenticated;

create or replace function public.velmere_consume_payment_operator_action_assertion(
  p_primary_assertion_id_hash text, p_scope text, p_action_digest text, p_body_sha256 text,
  p_actor_id_hash text, p_session_id_hash text, p_independent_approval_id_hash text default null,
  p_approver_actor_id_hash text default null, p_expires_at_ms bigint default 0
) returns text language plpgsql security definer set search_path=public as $$
begin
  if p_primary_assertion_id_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_primary_assertion_id_hash'; end if;
  if p_scope not in ('payment:reconcile','payment:requeue') then raise exception 'invalid_payment_operator_scope'; end if;
  if p_action_digest !~ '^[a-f0-9]{64}$' or p_body_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'invalid_payment_operator_action_digest'; end if;
  if p_actor_id_hash !~ '^[a-f0-9]{64}$' or p_session_id_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_payment_operator_identity'; end if;
  if p_expires_at_ms <= floor(extract(epoch from clock_timestamp())*1000)::bigint then raise exception 'payment_operator_assertion_expired'; end if;
  if p_scope='payment:requeue' then
    if p_independent_approval_id_hash is null or p_independent_approval_id_hash !~ '^[a-f0-9]{64}$' then raise exception 'independent_approval_required'; end if;
    if p_approver_actor_id_hash is null or p_approver_actor_id_hash !~ '^[a-f0-9]{64}$' or p_approver_actor_id_hash=p_actor_id_hash then raise exception 'independent_approver_invalid'; end if;
  elsif p_independent_approval_id_hash is not null or p_approver_actor_id_hash is not null then
    raise exception 'unexpected_independent_approval';
  end if;
  begin
    insert into public.velmere_payment_operator_action_assertions(primary_assertion_id_hash,scope,action_digest,body_sha256,actor_id_hash,session_id_hash,independent_approval_id_hash,approver_actor_id_hash,expires_at_ms)
    values(p_primary_assertion_id_hash,p_scope,p_action_digest,p_body_sha256,p_actor_id_hash,p_session_id_hash,p_independent_approval_id_hash,p_approver_actor_id_hash,p_expires_at_ms);
  exception when unique_violation then return 'already_consumed';
  end;
  return 'consumed';
end; $$;
revoke all on function public.velmere_consume_payment_operator_action_assertion(text,text,text,text,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.velmere_consume_payment_operator_action_assertion(text,text,text,text,text,text,text,text,bigint) to service_role;
-- PASS36 A102R2: salted account-binding hashes are distinct from the legacy
-- plain resource-binding hash. Staging two-user proof remains required.

create or replace function public.velmere_current_account_binding_hash()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.velmere_current_account_id() is null then null
    else encode(
      digest(
        'velmere-account-binding-v1:' || public.velmere_current_account_id(),
        'sha256'
      ),
      'hex'
    )
  end;
$$;

revoke all on function public.velmere_current_account_binding_hash() from public, anon;
grant execute on function public.velmere_current_account_binding_hash() to authenticated, service_role;

drop policy if exists pass22_audit_pdf_consumption_owner_select on public.velmere_audit_pdf_token_consumptions;
drop policy if exists a102r2_audit_pdf_consumption_owner_select on public.velmere_audit_pdf_token_consumptions;
create policy a102r2_audit_pdf_consumption_owner_select
on public.velmere_audit_pdf_token_consumptions
for select to authenticated
using (account_id_hash = public.velmere_current_account_binding_hash());

drop policy if exists pass22_audit_report_snapshot_owner_select on public.velmere_audit_report_snapshots;
drop policy if exists a102r2_audit_report_snapshot_owner_select on public.velmere_audit_report_snapshots;
create policy a102r2_audit_report_snapshot_owner_select
on public.velmere_audit_report_snapshots
for select to authenticated
using (account_id_hash = public.velmere_current_account_binding_hash());

drop policy if exists pass22_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists a102r2_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
create policy a102r2_customer_artifact_snapshot_owner_select
on public.velmere_customer_artifact_snapshots
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

drop policy if exists pass22_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists a102r2_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
create policy a102r2_customer_artifact_pdf_owner_select
on public.velmere_customer_artifact_pdf_blobs
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

-- P84 AUDIT CUSTOMER ARTIFACT OWNER READ PATH BEGIN
-- P83 correctly made publication atomic, but its copied P4823/P4824 DDL also
-- revoked the authenticated SELECT grants required by the server-side
-- owner-token read path. Audit link validation additionally queried the full
-- service-role-only message table. P84 restores owner reads without exposing
-- operator fields by introducing one minimal immutable link ledger.

alter table public.velmere_customer_artifact_snapshots enable row level security;
alter table public.velmere_customer_artifact_pdf_blobs enable row level security;

revoke all on table public.velmere_customer_artifact_snapshots from public, anon, authenticated;
revoke all on table public.velmere_customer_artifact_pdf_blobs from public, anon, authenticated;
grant select on table public.velmere_customer_artifact_snapshots to authenticated;
grant select on table public.velmere_customer_artifact_pdf_blobs to authenticated;

-- Rebind the current salted owner policies after the P83 privilege reset.
drop policy if exists pass22_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists a102r2_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists p84_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
create policy p84_customer_artifact_snapshot_owner_select
on public.velmere_customer_artifact_snapshots
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

drop policy if exists pass22_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists a102r2_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists p84_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
create policy p84_customer_artifact_pdf_owner_select
on public.velmere_customer_artifact_pdf_blobs
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

-- The full Audit message ledger remains server/operator only. Customer routes
-- receive only the closed link row below, never operator_note, admin_route,
-- action_log, payment evidence or the complete internal message record.
revoke all on table public.velmere_audit_account_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.velmere_audit_account_messages to service_role;

create table if not exists public.velmere_audit_customer_artifact_links (
  schema_version text not null,
  snapshot_id text primary key
    references public.velmere_customer_artifact_snapshots(snapshot_id)
    on update restrict on delete restrict,
  message_id text not null unique
    references public.velmere_audit_account_messages(message_id)
    on update restrict on delete restrict,
  account_id text not null,
  account_id_hash text not null,
  audit_snapshot_digest text not null,
  artifact_snapshot_digest text not null,
  artifact_digest text not null,
  pdf_blob_id text not null unique
    references public.velmere_customer_artifact_pdf_blobs(blob_id)
    on update restrict on delete restrict,
  pdf_digest text not null,
  linked_at timestamptz not null,
  created_at timestamptz not null,
  constraint velmere_audit_customer_artifact_links_schema_check
    check (schema_version = 'p84-audit-customer-artifact-link-v1'),
  constraint velmere_audit_customer_artifact_links_owner_check
    check (
      length(account_id) between 1 and 120
      and account_id not like 'preview:%'
      and account_id_hash ~ '^[a-f0-9]{64}$'
    ),
  constraint velmere_audit_customer_artifact_links_identity_check
    check (
      snapshot_id ~ '^artifact-audit-[a-f0-9]{16}-[a-f0-9]{64}$'
      and length(message_id) between 1 and 160
      and pdf_blob_id ~ '^pdf-[a-f0-9]{16}-[a-f0-9]{64}$'
    ),
  constraint velmere_audit_customer_artifact_links_digest_check
    check (
      audit_snapshot_digest ~ '^sha256:[a-f0-9]{64}$'
      and artifact_snapshot_digest ~ '^sha256:[a-f0-9]{64}$'
      and artifact_digest ~ '^sha256:[a-f0-9]{64}$'
      and pdf_digest ~ '^sha256:[a-f0-9]{64}$'
    ),
  constraint velmere_audit_customer_artifact_links_time_check
    check (created_at = linked_at)
);

alter table public.velmere_audit_customer_artifact_links enable row level security;
create index if not exists velmere_audit_customer_artifact_links_owner_idx
  on public.velmere_audit_customer_artifact_links(account_id, linked_at desc);
create index if not exists velmere_audit_customer_artifact_links_owner_hash_idx
  on public.velmere_audit_customer_artifact_links(account_id_hash, linked_at desc);

revoke all on table public.velmere_audit_customer_artifact_links from public, anon, authenticated, service_role;
grant select on table public.velmere_audit_customer_artifact_links to authenticated, service_role;

drop policy if exists p84_audit_customer_artifact_link_owner_select on public.velmere_audit_customer_artifact_links;
create policy p84_audit_customer_artifact_link_owner_select
on public.velmere_audit_customer_artifact_links
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
);

create or replace function public.velmere_audit_customer_artifact_link_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_message public.velmere_audit_account_messages%rowtype;
  v_snapshot public.velmere_customer_artifact_snapshots%rowtype;
  v_blob public.velmere_customer_artifact_pdf_blobs%rowtype;
  v_exact jsonb;
  v_expected_account_hash text;
begin
  if tg_op <> 'INSERT' then
    raise exception 'audit_customer_artifact_link_immutable' using errcode = '23514';
  end if;

  v_expected_account_hash := encode(digest('velmere-account-binding-v1:' || new.account_id, 'sha256'), 'hex');

  select * into v_message
  from public.velmere_audit_account_messages
  where message_id = new.message_id;
  if not found then
    raise exception 'audit_customer_artifact_link_message_missing' using errcode = '23514';
  end if;

  select * into v_snapshot
  from public.velmere_customer_artifact_snapshots
  where snapshot_id = new.snapshot_id;
  if not found then
    raise exception 'audit_customer_artifact_link_snapshot_missing' using errcode = '23514';
  end if;

  select * into v_blob
  from public.velmere_customer_artifact_pdf_blobs
  where blob_id = new.pdf_blob_id
    and snapshot_id = new.snapshot_id;
  if not found then
    raise exception 'audit_customer_artifact_link_pdf_missing' using errcode = '23514';
  end if;

  v_exact := v_message.canonical_customer_snapshot->'exactAccountArtifact';
  if new.schema_version <> 'p84-audit-customer-artifact-link-v1'
     or new.account_id like 'preview:%'
     or new.account_id_hash <> v_expected_account_hash
     or new.linked_at is distinct from v_message.updated_at
     or new.created_at is distinct from v_message.updated_at
     or v_message.account_id <> new.account_id
     or v_message.canonical_customer_snapshot is null
     or v_message.canonical_customer_snapshot_digest <> new.audit_snapshot_digest
     or v_message.canonical_customer_snapshot->>'snapshotDigest' <> new.audit_snapshot_digest
     or v_message.exact_account_artifact_snapshot_id <> new.snapshot_id
     or jsonb_typeof(v_exact) <> 'object'
     or v_exact->>'snapshotId' <> new.snapshot_id
     or v_exact->>'pdfBlobId' <> new.pdf_blob_id
     or v_exact->>'artifactDigest' <> new.artifact_digest
     or v_exact->>'pdfDigest' <> new.pdf_digest
     or v_snapshot.account_id <> new.account_id
     or v_snapshot.account_id_hash <> new.account_id_hash
     or v_snapshot.surface <> 'audit'
     or v_snapshot.payload_kind <> 'audit_customer_report_v1'
     or v_snapshot.snapshot_digest <> new.artifact_snapshot_digest
     or v_snapshot.artifact_digest <> new.artifact_digest
     or v_blob.account_id <> new.account_id
     or v_blob.account_id_hash <> new.account_id_hash
     or v_blob.surface <> 'audit'
     or v_blob.snapshot_id <> new.snapshot_id
     or v_blob.artifact_digest <> new.artifact_digest
     or v_blob.pdf_digest <> new.pdf_digest
     or v_blob.record_digest <> v_exact->>'pdfBlobRecordDigest'
     or v_blob.pdf_byte_length::text <> v_exact->>'pdfByteLength'
     or octet_length(v_blob.pdf_bytes) <> v_blob.pdf_byte_length
     or 'sha256:' || encode(digest(v_blob.pdf_bytes, 'sha256'), 'hex') <> v_blob.pdf_digest then
    raise exception 'audit_customer_artifact_link_cross_binding_failed' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists velmere_audit_customer_artifact_link_immutable
  on public.velmere_audit_customer_artifact_links;
create trigger velmere_audit_customer_artifact_link_immutable
before insert or update or delete on public.velmere_audit_customer_artifact_links
for each row execute function public.velmere_audit_customer_artifact_link_guard();

revoke all on function public.velmere_audit_customer_artifact_link_guard()
  from public, anon, authenticated, service_role;

-- Deterministic, fail-closed migration of any already-atomically-published P83
-- bundle. The insert trigger revalidates every cross-table binding.
insert into public.velmere_audit_customer_artifact_links (
  schema_version, snapshot_id, message_id, account_id, account_id_hash,
  audit_snapshot_digest, artifact_snapshot_digest, artifact_digest,
  pdf_blob_id, pdf_digest, linked_at, created_at
)
select
  'p84-audit-customer-artifact-link-v1',
  m.exact_account_artifact_snapshot_id,
  m.message_id,
  m.account_id,
  s.account_id_hash,
  m.canonical_customer_snapshot_digest,
  s.snapshot_digest,
  s.artifact_digest,
  b.blob_id,
  b.pdf_digest,
  m.updated_at,
  m.updated_at
from public.velmere_audit_account_messages m
join public.velmere_customer_artifact_snapshots s
  on s.snapshot_id = m.exact_account_artifact_snapshot_id
join public.velmere_customer_artifact_pdf_blobs b
  on b.snapshot_id = s.snapshot_id
 and b.blob_id = m.canonical_customer_snapshot->'exactAccountArtifact'->>'pdfBlobId'
where m.exact_account_artifact_snapshot_id is not null
on conflict (snapshot_id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.velmere_audit_account_messages m
    where m.exact_account_artifact_snapshot_id is not null
      and not exists (
        select 1
        from public.velmere_audit_customer_artifact_links l
        where l.snapshot_id = m.exact_account_artifact_snapshot_id
          and l.message_id = m.message_id
          and l.account_id = m.account_id
          and l.audit_snapshot_digest = m.canonical_customer_snapshot_digest
      )
  ) then
    raise exception 'audit_customer_artifact_link_backfill_incomplete' using errcode = '23514';
  end if;
end $$;

create or replace function public.velmere_publish_audit_exact_artifact_v2(
  p_account_id text,
  p_snapshot jsonb,
  p_payload_canonical text,
  p_blob jsonb,
  p_pdf_base64 text,
  p_audit_snapshot jsonb,
  p_message jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_publication jsonb;
  v_message public.velmere_audit_account_messages%rowtype;
  v_snapshot public.velmere_customer_artifact_snapshots%rowtype;
  v_blob public.velmere_customer_artifact_pdf_blobs%rowtype;
  v_link public.velmere_audit_customer_artifact_links%rowtype;
  v_existing_count integer := 0;
  v_created_link boolean := false;
  v_expected_account_hash text;
begin
  v_publication := public.velmere_publish_audit_exact_artifact_v1(
    p_account_id,
    p_snapshot,
    p_payload_canonical,
    p_blob,
    p_pdf_base64,
    p_audit_snapshot,
    p_message
  );

  if jsonb_typeof(v_publication) <> 'object'
     or (select count(*) from jsonb_object_keys(v_publication)) <> 4
     or coalesce(v_publication->>'schemaVersion', '') <> 'p83-audit-exact-artifact-atomic-publication-rpc-v1'
     or jsonb_typeof(v_publication->'bundle') <> 'object'
     or (select count(*) from jsonb_object_keys(v_publication->'bundle')) <> 4
     or coalesce(v_publication->'bundle'->>'schemaVersion', '') <> 'pass4824-account-customer-artifact-pdf-bundle-rpc-v1'
     or jsonb_typeof(v_publication->'bundle'->'snapshot') <> 'object'
     or jsonb_typeof(v_publication->'bundle'->'blob') <> 'object'
     or jsonb_typeof(v_publication->'message') <> 'object' then
    raise exception 'audit_customer_artifact_link_parent_publication_invalid' using errcode = '23514';
  end if;

  select * into v_message
  from public.velmere_audit_account_messages
  where message_id = p_message->>'message_id'
  for update;
  if not found then
    raise exception 'audit_customer_artifact_link_message_missing_after_publish' using errcode = '23514';
  end if;

  select * into v_snapshot
  from public.velmere_customer_artifact_snapshots
  where snapshot_id = p_snapshot->>'snapshotId'
  for update;
  if not found then
    raise exception 'audit_customer_artifact_link_snapshot_missing_after_publish' using errcode = '23514';
  end if;

  select * into v_blob
  from public.velmere_customer_artifact_pdf_blobs
  where blob_id = p_blob->>'blobId'
    and snapshot_id = p_snapshot->>'snapshotId'
  for update;
  if not found then
    raise exception 'audit_customer_artifact_link_pdf_missing_after_publish' using errcode = '23514';
  end if;

  v_expected_account_hash := encode(digest('velmere-account-binding-v1:' || p_account_id, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(
    'p84:' || p_account_id || ':' || v_message.message_id || ':' || v_snapshot.snapshot_id,
    0
  ));

  select count(*) into v_existing_count
  from public.velmere_audit_customer_artifact_links
  where snapshot_id = v_snapshot.snapshot_id
     or message_id = v_message.message_id
     or pdf_blob_id = v_blob.blob_id;
  if v_existing_count > 1 then
    raise exception 'audit_customer_artifact_link_identity_ambiguous' using errcode = '23514';
  end if;

  if v_existing_count = 1 then
    select * into v_link
    from public.velmere_audit_customer_artifact_links
    where snapshot_id = v_snapshot.snapshot_id
       or message_id = v_message.message_id
       or pdf_blob_id = v_blob.blob_id
    for update;
  else
    insert into public.velmere_audit_customer_artifact_links (
      schema_version, snapshot_id, message_id, account_id, account_id_hash,
      audit_snapshot_digest, artifact_snapshot_digest, artifact_digest,
      pdf_blob_id, pdf_digest, linked_at, created_at
    ) values (
      'p84-audit-customer-artifact-link-v1',
      v_snapshot.snapshot_id,
      v_message.message_id,
      p_account_id,
      v_expected_account_hash,
      v_message.canonical_customer_snapshot_digest,
      v_snapshot.snapshot_digest,
      v_snapshot.artifact_digest,
      v_blob.blob_id,
      v_blob.pdf_digest,
      v_message.updated_at,
      v_message.updated_at
    ) returning * into v_link;
    v_created_link := true;
  end if;

  if v_link.schema_version <> 'p84-audit-customer-artifact-link-v1'
     or v_link.snapshot_id <> v_snapshot.snapshot_id
     or v_link.message_id <> v_message.message_id
     or v_link.account_id <> p_account_id
     or v_link.account_id_hash <> v_expected_account_hash
     or v_link.audit_snapshot_digest <> v_message.canonical_customer_snapshot_digest
     or v_link.artifact_snapshot_digest <> v_snapshot.snapshot_digest
     or v_link.artifact_digest <> v_snapshot.artifact_digest
     or v_link.pdf_blob_id <> v_blob.blob_id
     or v_link.pdf_digest <> v_blob.pdf_digest
     or v_link.linked_at is distinct from v_message.updated_at
     or v_link.created_at is distinct from v_message.updated_at then
    raise exception 'audit_customer_artifact_link_commit_verification_failed' using errcode = '23514';
  end if;

  return jsonb_build_object(
    'schemaVersion', 'p84-audit-exact-artifact-owner-readable-publication-rpc-v2',
    'createdArtifact', coalesce((v_publication->'bundle'->>'created')::boolean, false),
    'createdMessage', coalesce((v_publication->>'createdMessage')::boolean, false),
    'createdLink', v_created_link,
    'snapshot', v_publication->'bundle'->'snapshot',
    'blob', v_publication->'bundle'->'blob',
    'message', v_publication->'message',
    'link', to_jsonb(v_link)
  );
end;
$$;

revoke all on function public.velmere_publish_audit_exact_artifact_v2(text, jsonb, text, jsonb, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.velmere_publish_audit_exact_artifact_v2(text, jsonb, text, jsonb, text, jsonb, jsonb)
  to service_role;

comment on table public.velmere_audit_customer_artifact_links is
  'P84 minimal immutable owner-readable Audit artifact link. It exposes no operator note, admin route, action log, payment evidence or raw provider evidence.';
comment on function public.velmere_publish_audit_exact_artifact_v2(text, jsonb, text, jsonb, text, jsonb, jsonb) is
  'P84 service-role-only transaction wrapper. P83 bundle/message publication and the minimal owner-readable RLS link commit together or roll back together.';
-- P84 AUDIT CUSTOMER ARTIFACT OWNER READ PATH END

-- P85 AUDIT CUSTOMER ARTIFACT DATABASE-ENFORCED PUBLICATION VISIBILITY BEGIN
-- P84 made exact Audit artifacts owner-readable, but the base snapshot/PDF RLS
-- policies still exposed every owner-bound row. A customer using the public
-- Supabase REST surface could therefore read an owner-bound Audit snapshot or
-- PDF blob that had not reached the immutable publication-link commit. The app
-- route hid those rows, but the database did not. P85 makes the link ledger the
-- actual database publication boundary and replaces the N+1/limit-before-filter
-- route with one closed owner-scoped RPC projection.

alter table public.velmere_customer_artifact_snapshots enable row level security;
alter table public.velmere_customer_artifact_pdf_blobs enable row level security;
alter table public.velmere_audit_customer_artifact_links enable row level security;

revoke all on table public.velmere_customer_artifact_snapshots from public, anon, authenticated;
revoke all on table public.velmere_customer_artifact_pdf_blobs from public, anon, authenticated;
grant select on table public.velmere_customer_artifact_snapshots to authenticated;
grant select on table public.velmere_customer_artifact_pdf_blobs to authenticated;

-- Owner visibility for Audit snapshots now requires the immutable P84 link to
-- match the exact owner, snapshot digest, artifact digest and PDF digest. Other
-- product surfaces retain their existing owner-only read behavior.
drop policy if exists pass22_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists a102r2_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists p84_customer_artifact_snapshot_owner_select on public.velmere_customer_artifact_snapshots;
drop policy if exists p85_customer_artifact_snapshot_owner_published_select on public.velmere_customer_artifact_snapshots;
create policy p85_customer_artifact_snapshot_owner_published_select
on public.velmere_customer_artifact_snapshots
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
  and (
    surface <> 'audit'
    or (
      payload_kind = 'audit_customer_report_v1'
      and pdf_storage = 'exact_immutable_blob'
      and exists (
        select 1
        from public.velmere_audit_customer_artifact_links l
        where l.snapshot_id = velmere_customer_artifact_snapshots.snapshot_id
          and l.account_id = velmere_customer_artifact_snapshots.account_id
          and l.account_id_hash = velmere_customer_artifact_snapshots.account_id_hash
          and l.artifact_snapshot_digest = velmere_customer_artifact_snapshots.snapshot_digest
          and l.artifact_digest = velmere_customer_artifact_snapshots.artifact_digest
          and l.pdf_digest = velmere_customer_artifact_snapshots.snapshot->'canonicalArtifact'->>'pdfDigest'
      )
    )
  )
);

-- Audit PDF bytes are directly owner-readable only after the same immutable
-- link is present and exact cross-table identities match. This closes the raw
-- PostgREST orphan-blob path as well as the application route.
drop policy if exists pass22_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists a102r2_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists p84_customer_artifact_pdf_owner_select on public.velmere_customer_artifact_pdf_blobs;
drop policy if exists p85_customer_artifact_pdf_owner_published_select on public.velmere_customer_artifact_pdf_blobs;
create policy p85_customer_artifact_pdf_owner_published_select
on public.velmere_customer_artifact_pdf_blobs
for select to authenticated
using (
  account_id = public.velmere_current_account_id()
  and account_id_hash = public.velmere_current_account_binding_hash()
  and (
    surface <> 'audit'
    or exists (
      select 1
      from public.velmere_audit_customer_artifact_links l
      where l.pdf_blob_id = velmere_customer_artifact_pdf_blobs.blob_id
        and l.snapshot_id = velmere_customer_artifact_pdf_blobs.snapshot_id
        and l.account_id = velmere_customer_artifact_pdf_blobs.account_id
        and l.account_id_hash = velmere_customer_artifact_pdf_blobs.account_id_hash
        and l.artifact_digest = velmere_customer_artifact_pdf_blobs.artifact_digest
        and l.pdf_digest = velmere_customer_artifact_pdf_blobs.pdf_digest
    )
  )
);

-- The RPCs below are SECURITY INVOKER. They cannot bypass the policies above,
-- never accept an account id from the caller, and expose only the pre-existing
-- customer artifact row plus the minimal P84 publication link. LIMIT is applied
-- after the database publication boundary, so hidden/orphan Audit rows cannot
-- starve a valid older artifact.
create or replace function public.velmere_list_owner_visible_customer_artifacts_v1(
  p_limit integer default 24
) returns table(
  visibility_schema_version text,
  publication_state text,
  publication_link jsonb,
  snapshot_id text,
  account_id text,
  account_id_hash text,
  surface text,
  payload_kind text,
  report_id text,
  artifact_digest text,
  snapshot_digest text,
  pdf_storage text,
  snapshot jsonb,
  generated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_account_id text;
  v_account_hash text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'customer_artifact_owner_visible_limit_invalid' using errcode = '22023';
  end if;

  v_account_id := public.velmere_current_account_id();
  v_account_hash := public.velmere_current_account_binding_hash();
  if v_account_id is null or v_account_hash is null then
    raise exception 'customer_artifact_owner_visible_account_unbound' using errcode = '28000';
  end if;

  return query
  select
    'p85-owner-visible-customer-artifact-read-v1'::text,
    case when s.surface = 'audit' then 'p84_exact_link' else 'not_applicable' end::text,
    case when s.surface = 'audit' then to_jsonb(l) else null::jsonb end,
    s.snapshot_id,
    s.account_id,
    s.account_id_hash,
    s.surface,
    s.payload_kind,
    s.report_id,
    s.artifact_digest,
    s.snapshot_digest,
    s.pdf_storage,
    s.snapshot,
    s.generated_at
  from public.velmere_customer_artifact_snapshots s
  left join public.velmere_audit_customer_artifact_links l
    on s.surface = 'audit'
   and l.snapshot_id = s.snapshot_id
   and l.account_id = s.account_id
   and l.account_id_hash = s.account_id_hash
   and l.artifact_snapshot_digest = s.snapshot_digest
   and l.artifact_digest = s.artifact_digest
   and l.pdf_digest = s.snapshot->'canonicalArtifact'->>'pdfDigest'
  where s.account_id = v_account_id
    and s.account_id_hash = v_account_hash
    and (s.surface <> 'audit' or l.snapshot_id is not null)
  order by s.generated_at desc, s.snapshot_id desc
  limit p_limit;
end;
$$;

create or replace function public.velmere_get_owner_visible_customer_artifact_v1(
  p_snapshot_id text
) returns table(
  visibility_schema_version text,
  publication_state text,
  publication_link jsonb,
  snapshot_id text,
  account_id text,
  account_id_hash text,
  surface text,
  payload_kind text,
  report_id text,
  artifact_digest text,
  snapshot_digest text,
  pdf_storage text,
  snapshot jsonb,
  generated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_account_id text;
  v_account_hash text;
begin
  if p_snapshot_id is null
     or length(p_snapshot_id) < 8
     or length(p_snapshot_id) > 160
     or p_snapshot_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'customer_artifact_owner_visible_snapshot_id_invalid' using errcode = '22023';
  end if;

  v_account_id := public.velmere_current_account_id();
  v_account_hash := public.velmere_current_account_binding_hash();
  if v_account_id is null or v_account_hash is null then
    raise exception 'customer_artifact_owner_visible_account_unbound' using errcode = '28000';
  end if;

  return query
  select
    'p85-owner-visible-customer-artifact-read-v1'::text,
    case when s.surface = 'audit' then 'p84_exact_link' else 'not_applicable' end::text,
    case when s.surface = 'audit' then to_jsonb(l) else null::jsonb end,
    s.snapshot_id,
    s.account_id,
    s.account_id_hash,
    s.surface,
    s.payload_kind,
    s.report_id,
    s.artifact_digest,
    s.snapshot_digest,
    s.pdf_storage,
    s.snapshot,
    s.generated_at
  from public.velmere_customer_artifact_snapshots s
  left join public.velmere_audit_customer_artifact_links l
    on s.surface = 'audit'
   and l.snapshot_id = s.snapshot_id
   and l.account_id = s.account_id
   and l.account_id_hash = s.account_id_hash
   and l.artifact_snapshot_digest = s.snapshot_digest
   and l.artifact_digest = s.artifact_digest
   and l.pdf_digest = s.snapshot->'canonicalArtifact'->>'pdfDigest'
  where s.snapshot_id = p_snapshot_id
    and s.account_id = v_account_id
    and s.account_id_hash = v_account_hash
    and (s.surface <> 'audit' or l.snapshot_id is not null)
  limit 1;
end;
$$;

revoke all on function public.velmere_list_owner_visible_customer_artifacts_v1(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.velmere_get_owner_visible_customer_artifact_v1(text)
  from public, anon, authenticated, service_role;
grant execute on function public.velmere_list_owner_visible_customer_artifacts_v1(integer)
  to authenticated;
grant execute on function public.velmere_get_owner_visible_customer_artifact_v1(text)
  to authenticated;

comment on function public.velmere_list_owner_visible_customer_artifacts_v1(integer) is
  'P85 authenticated SECURITY INVOKER projection. Publication filtering and LIMIT occur in PostgreSQL; orphan Audit rows are not customer-readable and cannot starve older valid artifacts.';
comment on function public.velmere_get_owner_visible_customer_artifact_v1(text) is
  'P85 authenticated SECURITY INVOKER exact artifact read. The caller account is derived from auth.uid() binding; caller-supplied account identities are not accepted.';
-- P85 AUDIT CUSTOMER ARTIFACT DATABASE-ENFORCED PUBLICATION VISIBILITY END

-- P86 CUSTOMER ARTIFACT EXACT-PDF NEW-WRITE GATE BEGIN
-- Historical rows tagged legacy_deterministic_rerender remain readable as
-- metadata, but they can no longer be served as PDFs and no new legacy row may
-- be inserted. Every current account artifact payload kind is PDF-bearing and
-- must arrive through the atomic exact snapshot + blob bundle path.

create or replace function public.velmere_reject_new_legacy_customer_artifact_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.pdf_storage is distinct from 'exact_immutable_blob'
     or new.snapshot->>'pdfStorage' is distinct from 'exact_immutable_blob' then
    raise exception 'customer_artifact_new_write_exact_pdf_required'
      using errcode = '23514';
  end if;

  if new.payload_kind not in (
    'market_customer_report_v1',
    'lens_report_v1',
    'audit_customer_report_v1'
  ) then
    raise exception 'customer_artifact_payload_kind_unsupported'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.velmere_reject_new_legacy_customer_artifact_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists p86_customer_artifact_exact_pdf_new_write_gate
  on public.velmere_customer_artifact_snapshots;
create trigger p86_customer_artifact_exact_pdf_new_write_gate
before insert on public.velmere_customer_artifact_snapshots
for each row execute function public.velmere_reject_new_legacy_customer_artifact_v1();

comment on function public.velmere_reject_new_legacy_customer_artifact_v1() is
  'P86 insert-only gate. Existing legacy rows are preserved as history, while every new Lens/Shield/Real Markets/Audit account artifact must bind exact immutable PDF bytes.';

-- P86 CUSTOMER ARTIFACT EXACT-PDF NEW-WRITE GATE END

-- P88 AUDIT PAID EXACT IMMUTABLE PDF BLOB BEGIN
-- New Pro/Advanced completions persist the first rendered customer PDF bytes in
-- the same transaction as the immutable snapshot and review completion. Legacy
-- snapshot-only rows remain history and fail closed; they are never backfilled
-- by rendering later bytes and calling them original.

create table if not exists public.velmere_audit_report_pdf_blobs (
  schema_version text not null default 'p88-audit-paid-exact-immutable-pdf-artifact-v1'
    check (schema_version = 'p88-audit-paid-exact-immutable-pdf-artifact-v1'),
  report_id text primary key references public.velmere_audit_report_snapshots(report_id) on delete restrict,
  case_ref text not null,
  request_id text not null,
  account_id_hash text not null check (account_id_hash ~ '^[a-f0-9]{64}$'),
  entitlement_id text not null,
  tier text not null check (tier in ('pro', 'advanced')),
  target_hash text not null check (target_hash ~ '^sha256:[a-f0-9]{64}$'),
  report_version_hash text not null check (report_version_hash ~ '^sha256:[a-f0-9]{64}$'),
  snapshot_digest text not null check (snapshot_digest ~ '^sha256:[a-f0-9]{64}$'),
  source_receipt_root text not null check (source_receipt_root ~ '^sha256:[a-f0-9]{64}$'),
  pdf_digest text not null check (pdf_digest ~ '^sha256:[a-f0-9]{64}$'),
  pdf_byte_length integer not null check (pdf_byte_length between 1000 and 4194304),
  render_contract_id text not null
    check (render_contract_id = 'pass4808-deterministic-latin-extended-pagination-v1'),
  pdf_bytes bytea not null,
  created_at timestamptz not null,
  record_digest text not null check (record_digest ~ '^sha256:[a-f0-9]{64}$'),
  unique (case_ref, tier),
  check (octet_length(pdf_bytes) = pdf_byte_length),
  check (substring(pdf_bytes from 1 for 5) = decode('255044462d', 'hex')),
  check (pdf_digest = 'sha256:' || encode(digest(pdf_bytes, 'sha256'), 'hex'))
);

create index if not exists velmere_audit_report_pdf_blobs_entitlement_idx
  on public.velmere_audit_report_pdf_blobs(entitlement_id, case_ref, tier);

alter table public.velmere_audit_report_pdf_blobs enable row level security;
revoke all on public.velmere_audit_report_pdf_blobs from public, anon, authenticated;
grant select, insert on public.velmere_audit_report_pdf_blobs to service_role;

create or replace function public.velmere_validate_audit_report_pdf_blob_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_snapshot public.velmere_audit_report_snapshots%rowtype;
  v_created_at_text text;
  v_expected_record_digest text;
begin
  select * into v_snapshot
  from public.velmere_audit_report_snapshots
  where report_id = new.report_id
  for key share;

  if not found then
    raise exception 'audit_exact_pdf_snapshot_missing' using errcode = '23514';
  end if;

  if v_snapshot.case_ref <> new.case_ref
     or v_snapshot.request_id <> new.request_id
     or v_snapshot.account_id_hash <> new.account_id_hash
     or v_snapshot.entitlement_id <> new.entitlement_id
     or v_snapshot.tier <> new.tier
     or v_snapshot.target_hash <> new.target_hash
     or v_snapshot.report_version_hash <> new.report_version_hash
     or v_snapshot.snapshot_digest <> new.snapshot_digest
     or v_snapshot.source_receipt_root <> new.source_receipt_root
     or v_snapshot.pdf_digest <> new.pdf_digest
     or v_snapshot.created_at <> new.created_at then
    raise exception 'audit_exact_pdf_snapshot_cross_binding_mismatch' using errcode = '23514';
  end if;

  if v_snapshot.snapshot_json->>'requestId' <> new.request_id
     or v_snapshot.snapshot_json->>'tier' <> new.tier
     or v_snapshot.snapshot_json->>'digest' <> new.snapshot_digest
     or v_snapshot.snapshot_json->>'sourceReceiptRoot' <> new.source_receipt_root
     or v_snapshot.snapshot_json#>>'{renderContract,id}' <> new.render_contract_id
     or v_snapshot.snapshot_json#>>'{renderContract,pdfDigest}' <> new.pdf_digest
     or coalesce(v_snapshot.snapshot_json#>>'{renderContract,pdfByteLength}', '') !~ '^[0-9]+$'
     or (v_snapshot.snapshot_json#>>'{renderContract,pdfByteLength}')::integer <> new.pdf_byte_length then
    raise exception 'audit_exact_pdf_render_contract_cross_binding_mismatch' using errcode = '23514';
  end if;

  if octet_length(new.pdf_bytes) <> new.pdf_byte_length
     or substring(new.pdf_bytes from 1 for 5) <> decode('255044462d', 'hex')
     or convert_from(substring(new.pdf_bytes from greatest(1, octet_length(new.pdf_bytes) - 2048)), 'LATIN1') !~ '%%EOF[[:space:]]*$'
     or convert_from(new.pdf_bytes, 'LATIN1') ~ '/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)([^A-Za-z0-9_]|$)'
     or new.pdf_digest <> 'sha256:' || encode(digest(new.pdf_bytes, 'sha256'), 'hex') then
    raise exception 'audit_exact_pdf_bytes_invalid' using errcode = '23514';
  end if;

  v_created_at_text := to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_expected_record_digest := 'sha256:' || encode(digest(convert_to(concat_ws(E'\n',
    new.schema_version,
    new.report_id,
    new.case_ref,
    new.request_id,
    new.account_id_hash,
    new.entitlement_id,
    new.tier,
    new.target_hash,
    new.report_version_hash,
    new.snapshot_digest,
    new.source_receipt_root,
    new.pdf_digest,
    new.pdf_byte_length::text,
    new.render_contract_id,
    v_created_at_text
  ), 'UTF8'), 'sha256'), 'hex');
  if new.record_digest <> v_expected_record_digest then
    raise exception 'audit_exact_pdf_record_digest_invalid' using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function public.velmere_validate_audit_report_pdf_blob_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists p88_validate_audit_report_pdf_blob
  on public.velmere_audit_report_pdf_blobs;
create trigger p88_validate_audit_report_pdf_blob
before insert on public.velmere_audit_report_pdf_blobs
for each row execute function public.velmere_validate_audit_report_pdf_blob_v1();

create or replace function public.velmere_reject_audit_report_pdf_blob_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'audit_exact_pdf_blob_immutable' using errcode = '55000';
end;
$$;
revoke all on function public.velmere_reject_audit_report_pdf_blob_mutation_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists p88_reject_audit_report_pdf_blob_mutation
  on public.velmere_audit_report_pdf_blobs;
create trigger p88_reject_audit_report_pdf_blob_mutation
before update or delete on public.velmere_audit_report_pdf_blobs
for each row execute function public.velmere_reject_audit_report_pdf_blob_mutation_v1();

create or replace function public.velmere_complete_paid_audit_with_exact_pdf_v2(
  p_tier text,
  p_case_ref text,
  p_worker_principal text,
  p_lease_token text,
  p_reason_code text,
  p_report_id text,
  p_request_id text,
  p_account_id_hash text,
  p_entitlement_id text,
  p_target_hash text,
  p_report_version_hash text,
  p_snapshot_digest text,
  p_source_receipt_root text,
  p_pdf_digest text,
  p_pdf_byte_length integer,
  p_render_contract_id text,
  p_pdf_record_digest text,
  p_pdf_base64 text,
  p_snapshot_json jsonb,
  p_created_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_pdf_bytes bytea;
  v_snapshot public.velmere_audit_report_snapshots%rowtype;
  v_blob public.velmere_audit_report_pdf_blobs%rowtype;
  v_snapshot_found boolean := false;
  v_blob_found boolean := false;
  v_legacy_result jsonb;
  v_created_at_text text;
  v_expected_record_digest text;
begin
  if p_tier is null or p_tier not in ('pro', 'advanced')
     or coalesce(trim(p_case_ref), '') = ''
     or coalesce(trim(p_worker_principal), '') = ''
     or length(coalesce(p_lease_token, '')) < 24
     or coalesce(trim(p_reason_code), '') = ''
     or coalesce(trim(p_report_id), '') = ''
     or coalesce(trim(p_request_id), '') = ''
     or coalesce(trim(p_entitlement_id), '') = ''
     or p_account_id_hash is null or p_account_id_hash !~ '^[a-f0-9]{64}$'
     or p_target_hash is null or p_target_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_report_version_hash is null or p_report_version_hash !~ '^sha256:[a-f0-9]{64}$'
     or p_snapshot_digest is null or p_snapshot_digest !~ '^sha256:[a-f0-9]{64}$'
     or p_source_receipt_root is null or p_source_receipt_root !~ '^sha256:[a-f0-9]{64}$'
     or p_pdf_digest is null or p_pdf_digest !~ '^sha256:[a-f0-9]{64}$'
     or p_pdf_record_digest is null or p_pdf_record_digest !~ '^sha256:[a-f0-9]{64}$'
     or p_pdf_byte_length is null or p_pdf_byte_length < 1000 or p_pdf_byte_length > 4194304
     or p_render_contract_id is null or p_render_contract_id <> 'pass4808-deterministic-latin-extended-pagination-v1'
     or p_snapshot_json is null or jsonb_typeof(p_snapshot_json) <> 'object'
     or coalesce(p_snapshot_json->>'requestId', '') <> p_request_id
     or coalesce(p_snapshot_json->>'tier', '') <> p_tier
     or coalesce(p_snapshot_json->>'digest', '') <> p_snapshot_digest
     or coalesce(p_snapshot_json->>'sourceReceiptRoot', '') <> p_source_receipt_root
     or coalesce(p_snapshot_json#>>'{renderContract,id}', '') <> p_render_contract_id
     or coalesce(p_snapshot_json#>>'{renderContract,pdfDigest}', '') <> p_pdf_digest
     or coalesce(p_snapshot_json#>>'{renderContract,pdfByteLength}', '') !~ '^[0-9]+$'
     or (p_snapshot_json#>>'{renderContract,pdfByteLength}')::integer <> p_pdf_byte_length
     or p_created_at is null
     or coalesce(p_snapshot_json->>'generatedAt', '') <> to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     or p_pdf_base64 is null
     or length(p_pdf_base64) < 4
     or length(p_pdf_base64) % 4 <> 0
     or p_pdf_base64 !~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' then
    return jsonb_build_object('ok', false, 'error', p_tier || '_exact_pdf_completion_invalid_request');
  end if;

  begin
    v_pdf_bytes := decode(p_pdf_base64, 'base64');
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_base64_noncanonical');
  end;
  if replace(encode(v_pdf_bytes, 'base64'), E'\n', '') <> p_pdf_base64 then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_base64_noncanonical');
  end if;
  if octet_length(v_pdf_bytes) <> p_pdf_byte_length
     or substring(v_pdf_bytes from 1 for 5) <> decode('255044462d', 'hex')
     or convert_from(substring(v_pdf_bytes from greatest(1, octet_length(v_pdf_bytes) - 2048)), 'LATIN1') !~ '%%EOF[[:space:]]*$'
     or convert_from(v_pdf_bytes, 'LATIN1') ~ '/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)([^A-Za-z0-9_]|$)'
     or p_pdf_digest <> 'sha256:' || encode(digest(v_pdf_bytes, 'sha256'), 'hex') then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_bytes_invalid');
  end if;

  v_created_at_text := to_char(p_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_expected_record_digest := 'sha256:' || encode(digest(convert_to(concat_ws(E'\n',
    'p88-audit-paid-exact-immutable-pdf-artifact-v1',
    p_report_id,
    p_case_ref,
    p_request_id,
    p_account_id_hash,
    p_entitlement_id,
    p_tier,
    p_target_hash,
    p_report_version_hash,
    p_snapshot_digest,
    p_source_receipt_root,
    p_pdf_digest,
    p_pdf_byte_length::text,
    p_render_contract_id,
    v_created_at_text
  ), 'UTF8'), 'sha256'), 'hex');
  if p_pdf_record_digest <> v_expected_record_digest then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_record_digest_invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('p88-audit-exact-pdf:' || p_case_ref || ':' || p_tier, 0));

  select * into v_snapshot
  from public.velmere_audit_report_snapshots
  where case_ref = p_case_ref and tier = p_tier
  for update;
  v_snapshot_found := found;

  select * into v_blob
  from public.velmere_audit_report_pdf_blobs
  where report_id = p_report_id
  for update;
  v_blob_found := found;

  if v_snapshot_found and not v_blob_found then
    return jsonb_build_object('ok', false, 'error', 'audit_report_exact_pdf_bytes_withheld');
  end if;
  if v_blob_found and not v_snapshot_found then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_orphan_integrity_failure');
  end if;

  if v_snapshot_found and (
       v_snapshot.report_id <> p_report_id
       or v_snapshot.request_id <> p_request_id
       or v_snapshot.account_id_hash <> p_account_id_hash
       or v_snapshot.entitlement_id <> p_entitlement_id
       or v_snapshot.target_hash <> p_target_hash
       or v_snapshot.report_version_hash <> p_report_version_hash
       or v_snapshot.snapshot_digest <> p_snapshot_digest
       or v_snapshot.source_receipt_root <> p_source_receipt_root
       or v_snapshot.pdf_digest <> p_pdf_digest
       or v_snapshot.snapshot_json <> p_snapshot_json
       or v_snapshot.created_at <> p_created_at
     ) then
    return jsonb_build_object('ok', false, 'error', 'audit_report_snapshot_immutable_conflict');
  end if;

  if v_blob_found and (
       v_blob.schema_version <> 'p88-audit-paid-exact-immutable-pdf-artifact-v1'
       or v_blob.case_ref <> p_case_ref
       or v_blob.request_id <> p_request_id
       or v_blob.account_id_hash <> p_account_id_hash
       or v_blob.entitlement_id <> p_entitlement_id
       or v_blob.tier <> p_tier
       or v_blob.target_hash <> p_target_hash
       or v_blob.report_version_hash <> p_report_version_hash
       or v_blob.snapshot_digest <> p_snapshot_digest
       or v_blob.source_receipt_root <> p_source_receipt_root
       or v_blob.pdf_digest <> p_pdf_digest
       or v_blob.pdf_byte_length <> p_pdf_byte_length
       or v_blob.render_contract_id <> p_render_contract_id
       or v_blob.record_digest <> p_pdf_record_digest
       or v_blob.created_at <> p_created_at
       or v_blob.pdf_bytes <> v_pdf_bytes
     ) then
    return jsonb_build_object('ok', false, 'error', 'audit_exact_pdf_blob_immutable_conflict');
  end if;

  if p_tier = 'advanced' then
    v_legacy_result := public.velmere_complete_advanced_audit_with_snapshot(
      p_case_ref,p_worker_principal,p_lease_token,p_reason_code,p_report_id,p_request_id,
      p_account_id_hash,p_entitlement_id,p_target_hash,p_report_version_hash,p_snapshot_digest,
      p_source_receipt_root,p_pdf_digest,p_snapshot_json,p_created_at
    );
  else
    v_legacy_result := public.velmere_complete_pro_audit_with_snapshot(
      p_case_ref,p_worker_principal,p_lease_token,p_reason_code,p_report_id,p_request_id,
      p_account_id_hash,p_entitlement_id,p_target_hash,p_report_version_hash,p_snapshot_digest,
      p_source_receipt_root,p_pdf_digest,p_snapshot_json,p_created_at
    );
  end if;
  if coalesce((v_legacy_result->>'ok')::boolean, false) is not true then
    return v_legacy_result;
  end if;

  if not v_blob_found then
    insert into public.velmere_audit_report_pdf_blobs(
      schema_version, report_id, case_ref, request_id, account_id_hash, entitlement_id, tier,
      target_hash, report_version_hash, snapshot_digest, source_receipt_root, pdf_digest,
      pdf_byte_length, render_contract_id, pdf_bytes, created_at, record_digest
    ) values (
      'p88-audit-paid-exact-immutable-pdf-artifact-v1', p_report_id, p_case_ref, p_request_id,
      p_account_id_hash, p_entitlement_id, p_tier, p_target_hash, p_report_version_hash,
      p_snapshot_digest, p_source_receipt_root, p_pdf_digest, p_pdf_byte_length,
      p_render_contract_id, v_pdf_bytes, p_created_at, p_pdf_record_digest
    );
  end if;

  select * into strict v_blob
  from public.velmere_audit_report_pdf_blobs
  where report_id = p_report_id;
  if v_blob.pdf_bytes <> v_pdf_bytes
     or v_blob.pdf_digest <> p_pdf_digest
     or v_blob.pdf_byte_length <> p_pdf_byte_length
     or v_blob.record_digest <> p_pdf_record_digest then
    raise exception 'audit_exact_pdf_post_insert_verification_failed' using errcode = '23514';
  end if;

  return v_legacy_result || jsonb_build_object(
    'pdfByteLength', p_pdf_byte_length,
    'renderContractId', p_render_contract_id,
    'pdfRecordDigest', p_pdf_record_digest,
    'exactPdfStorage', 'render_once_immutable_blob'
  );
end;
$$;
revoke all on function public.velmere_complete_paid_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.velmere_complete_pro_audit_with_exact_pdf_v2(
  p_case_ref text,
  p_worker_principal text,
  p_lease_token text,
  p_reason_code text,
  p_report_id text,
  p_request_id text,
  p_account_id_hash text,
  p_entitlement_id text,
  p_target_hash text,
  p_report_version_hash text,
  p_snapshot_digest text,
  p_source_receipt_root text,
  p_pdf_digest text,
  p_pdf_byte_length integer,
  p_render_contract_id text,
  p_pdf_record_digest text,
  p_pdf_base64 text,
  p_snapshot_json jsonb,
  p_created_at timestamptz
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.velmere_complete_paid_audit_with_exact_pdf_v2(
    'pro',p_case_ref,p_worker_principal,p_lease_token,p_reason_code,p_report_id,p_request_id,
    p_account_id_hash,p_entitlement_id,p_target_hash,p_report_version_hash,p_snapshot_digest,
    p_source_receipt_root,p_pdf_digest,p_pdf_byte_length,p_render_contract_id,p_pdf_record_digest,
    p_pdf_base64,p_snapshot_json,p_created_at
  );
$$;
revoke all on function public.velmere_complete_pro_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.velmere_complete_pro_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) to service_role;

create or replace function public.velmere_complete_advanced_audit_with_exact_pdf_v2(
  p_case_ref text,
  p_worker_principal text,
  p_lease_token text,
  p_reason_code text,
  p_report_id text,
  p_request_id text,
  p_account_id_hash text,
  p_entitlement_id text,
  p_target_hash text,
  p_report_version_hash text,
  p_snapshot_digest text,
  p_source_receipt_root text,
  p_pdf_digest text,
  p_pdf_byte_length integer,
  p_render_contract_id text,
  p_pdf_record_digest text,
  p_pdf_base64 text,
  p_snapshot_json jsonb,
  p_created_at timestamptz
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.velmere_complete_paid_audit_with_exact_pdf_v2(
    'advanced',p_case_ref,p_worker_principal,p_lease_token,p_reason_code,p_report_id,p_request_id,
    p_account_id_hash,p_entitlement_id,p_target_hash,p_report_version_hash,p_snapshot_digest,
    p_source_receipt_root,p_pdf_digest,p_pdf_byte_length,p_render_contract_id,p_pdf_record_digest,
    p_pdf_base64,p_snapshot_json,p_created_at
  );
$$;
revoke all on function public.velmere_complete_advanced_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) from public, anon, authenticated;
grant execute on function public.velmere_complete_advanced_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) to service_role;

comment on table public.velmere_audit_report_pdf_blobs is
  'P88 immutable first-render Audit Pro/Advanced PDF bytes. Snapshot-only historical rows are deliberately not backfilled.';
comment on function public.velmere_complete_pro_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) is 'P88 Pro atomic completion: active lease, immutable snapshot, exact first-render PDF bytes and completed review in one transaction.';
comment on function public.velmere_complete_advanced_audit_with_exact_pdf_v2(
  text,text,text,text,text,text,text,text,text,text,text,text,text,integer,text,text,text,jsonb,timestamptz
) is 'P88 Advanced atomic completion: active lease, immutable snapshot, exact first-render PDF bytes and completed review in one transaction.';

-- P88 AUDIT PAID EXACT IMMUTABLE PDF BLOB END

-- P91 RISK HISTORY EVENT-DRIVEN, VERSIONED, DURABLE TRUTH BEGIN
-- This migration creates the table that the previous risk-ledger code assumed
-- existed but never deployed. It stores only first observations, material
-- changes and bounded daily heartbeats. Direct customer access is prohibited;
-- customer projection remains an application-level, redacted contract.

create table if not exists public.velmere_risk_history_events (
  schema_version text not null
    check (schema_version = 'velmere.risk-history-event.v1'),
  event_id text primary key
    check (event_id ~ '^risk-history-[a-f0-9]{40}$'),
  event_digest text not null unique
    check (event_digest ~ '^sha256:[a-f0-9]{64}$'),
  storage_digest text not null
    check (storage_digest ~ '^sha256:[a-f0-9]{64}$'),
  canonical_asset_id text not null
    check (length(canonical_asset_id) between 3 and 256),
  asset_id text not null
    check (length(asset_id) between 1 and 200),
  identity_class text not null
    check (identity_class in ('CHAIN_CONTRACT', 'MARKET_ID', 'UNRESOLVED')),
  symbol text not null check (length(symbol) between 1 and 32),
  name text not null check (length(name) between 1 and 160),
  observed_at timestamptz not null,
  recorded_at timestamptz not null,
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  signal_count integer not null check (signal_count between 0 and 100000),
  confidence numeric,
  publication_state text not null check (publication_state in ('PUBLIC', 'WITHHELD')),
  customer_publishable boolean not null,
  methodology_version text not null check (length(methodology_version) between 1 and 160),
  score_version text not null check (length(score_version) between 1 and 120),
  evidence_version text not null check (length(evidence_version) between 1 and 120),
  evidence_digest text not null check (length(evidence_digest) between 1 and 120),
  source_as_of timestamptz,
  comparability_key text not null check (length(comparability_key) between 1 and 120),
  comparable_to_previous boolean not null,
  event_types text[] not null check (cardinality(event_types) between 1 and 7),
  change_reasons text[] not null check (cardinality(change_reasons) between 1 and 7),
  event_json jsonb not null check (jsonb_typeof(event_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (canonical_asset_id, observed_at),
  check (recorded_at >= observed_at),
  check (source_as_of is null or source_as_of <= recorded_at + interval '5 minutes'),
  check (customer_publishable = (publication_state = 'PUBLIC')),
  check (
    not customer_publishable
    or (
      identity_class <> 'UNRESOLVED'
      and score_version ~ '^sha256:[a-f0-9]{64}$'
      and evidence_digest ~ '^sha256:[a-f0-9]{64}$'
      and comparability_key ~ '^sha256:[a-f0-9]{64}$'
    )
  ),
  check (event_types <@ array[
    'TRACKING_STARTED', 'SCORE_CHANGED', 'LEVEL_CHANGED',
    'METHODOLOGY_CHANGED', 'EVIDENCE_CHANGED',
    'PUBLICATION_STATE_CHANGED', 'HEARTBEAT'
  ]::text[])
);

create index if not exists velmere_risk_history_events_asset_time_idx
  on public.velmere_risk_history_events(canonical_asset_id, observed_at desc);
create index if not exists velmere_risk_history_events_legacy_asset_time_idx
  on public.velmere_risk_history_events(asset_id, observed_at desc);
create index if not exists velmere_risk_history_events_public_time_idx
  on public.velmere_risk_history_events(canonical_asset_id, observed_at desc)
  where customer_publishable;

alter table public.velmere_risk_history_events enable row level security;
revoke all on table public.velmere_risk_history_events from public, anon, authenticated;
grant select, insert on table public.velmere_risk_history_events to service_role;

create or replace function public.velmere_validate_risk_history_event_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_expected_storage_digest text;
  v_event_keys text[];
  v_snapshot jsonb;
begin
  v_event_keys := array(
    select key from jsonb_object_keys(new.event_json) as key
    where key <> all(array[
      'schemaVersion','eventId','eventDigest','canonicalAssetId','assetId','identityClass',
      'symbol','name','observedAt','recordedAt','score','level','signalCount','confidence',
      'publicationState','customerPublishable','methodologyVersion','scoreVersion',
      'evidenceVersion','evidenceDigest','sourceAsOf','comparabilityKey',
      'comparableToPrevious','eventTypes','changeReasons','snapshot'
    ]::text[])
  );
  if cardinality(v_event_keys) > 0 then
    raise exception 'risk_history_event_unknown_fields' using errcode = '23514';
  end if;

  v_snapshot := new.event_json->'snapshot';
  if v_snapshot is null or jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'risk_history_snapshot_missing' using errcode = '23514';
  end if;

  if new.event_json->>'schemaVersion' <> new.schema_version
     or new.event_json->>'eventId' <> new.event_id
     or new.event_json->>'eventDigest' <> new.event_digest
     or new.event_json->>'canonicalAssetId' <> new.canonical_asset_id
     or new.event_json->>'assetId' <> new.asset_id
     or new.event_json->>'identityClass' <> new.identity_class
     or new.event_json->>'symbol' <> new.symbol
     or new.event_json->>'name' <> new.name
     or (new.event_json->>'observedAt')::timestamptz <> new.observed_at
     or (new.event_json->>'recordedAt')::timestamptz <> new.recorded_at
     or (new.event_json->>'score')::integer <> new.risk_score
     or new.event_json->>'level' <> new.risk_level
     or (new.event_json->>'signalCount')::integer <> new.signal_count
     or (new.event_json->>'publicationState') <> new.publication_state
     or (new.event_json->>'customerPublishable')::boolean <> new.customer_publishable
     or new.event_json->>'methodologyVersion' <> new.methodology_version
     or new.event_json->>'scoreVersion' <> new.score_version
     or new.event_json->>'evidenceVersion' <> new.evidence_version
     or new.event_json->>'evidenceDigest' <> new.evidence_digest
     or new.event_json->>'comparabilityKey' <> new.comparability_key
     or (new.event_json->>'comparableToPrevious')::boolean <> new.comparable_to_previous
     or array(select jsonb_array_elements_text(new.event_json->'eventTypes')) <> new.event_types
     or array(select jsonb_array_elements_text(new.event_json->'changeReasons')) <> new.change_reasons then
    raise exception 'risk_history_event_cross_binding_mismatch' using errcode = '23514';
  end if;

  if v_snapshot->>'schemaVersion' <> 'velmere.risk-history-snapshot.v1'
     or v_snapshot->>'id' <> new.asset_id
     or v_snapshot->>'canonicalAssetId' <> new.canonical_asset_id
     or v_snapshot->>'identityClass' <> new.identity_class
     or v_snapshot->>'symbol' <> new.symbol
     or v_snapshot->>'name' <> new.name
     or (v_snapshot->>'timestamp')::timestamptz <> new.observed_at
     or (v_snapshot->>'score')::integer <> new.risk_score
     or v_snapshot->>'level' <> new.risk_level
     or (v_snapshot->>'signalCount')::integer <> new.signal_count
     or v_snapshot->>'publicationState' <> new.publication_state
     or (v_snapshot->>'customerPublishable')::boolean <> new.customer_publishable
     or v_snapshot->>'methodologyVersion' <> new.methodology_version
     or v_snapshot->>'scoreVersion' <> new.score_version
     or v_snapshot->>'evidenceVersion' <> new.evidence_version
     or v_snapshot->>'evidenceDigest' <> new.evidence_digest
     or v_snapshot->>'comparabilityKey' <> new.comparability_key
     or coalesce(v_snapshot->>'snapshotDigest', '') !~ '^sha256:[a-f0-9]{64}$' then
    raise exception 'risk_history_snapshot_cross_binding_mismatch' using errcode = '23514';
  end if;

  v_expected_storage_digest := 'sha256:' || encode(digest(convert_to(new.event_json::text, 'UTF8'), 'sha256'), 'hex');
  if new.storage_digest <> v_expected_storage_digest then
    raise exception 'risk_history_storage_digest_invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.velmere_validate_risk_history_event_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists p91_validate_risk_history_event on public.velmere_risk_history_events;
create trigger p91_validate_risk_history_event
before insert on public.velmere_risk_history_events
for each row execute function public.velmere_validate_risk_history_event_v1();

create or replace function public.velmere_reject_risk_history_event_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'risk_history_event_immutable' using errcode = '55000';
end;
$$;
revoke all on function public.velmere_reject_risk_history_event_mutation_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists p91_reject_risk_history_event_mutation on public.velmere_risk_history_events;
create trigger p91_reject_risk_history_event_mutation
before update or delete on public.velmere_risk_history_events
for each row execute function public.velmere_reject_risk_history_event_mutation_v1();

create or replace function public.velmere_get_latest_risk_history_events_v1(
  p_asset_ids text[]
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_asset_ids is null or cardinality(p_asset_ids) < 1 or cardinality(p_asset_ids) > 250 then
    raise exception 'risk_history_asset_id_batch_invalid' using errcode = '22023';
  end if;
  if exists(select 1 from unnest(p_asset_ids) id where id is null or length(trim(id)) < 3 or length(id) > 256) then
    raise exception 'risk_history_asset_id_invalid' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(row.event_json order by row.canonical_asset_id)
    from (
      select distinct on (canonical_asset_id) canonical_asset_id, event_json
      from public.velmere_risk_history_events
      where canonical_asset_id = any(p_asset_ids)
      order by canonical_asset_id, observed_at desc
    ) row
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.velmere_get_latest_risk_history_events_v1(text[])
  from public, anon, authenticated;
grant execute on function public.velmere_get_latest_risk_history_events_v1(text[]) to service_role;

create or replace function public.velmere_append_risk_history_events_v1(
  p_events jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_event jsonb;
  v_previous public.velmere_risk_history_events%rowtype;
  v_existing public.velmere_risk_history_events%rowtype;
  v_event_id text;
  v_event_digest text;
  v_asset text;
  v_asset_id text;
  v_identity_class text;
  v_observed_at timestamptz;
  v_recorded_at timestamptz;
  v_score integer;
  v_level text;
  v_publication_state text;
  v_customer_publishable boolean;
  v_methodology_version text;
  v_score_version text;
  v_evidence_version text;
  v_evidence_digest text;
  v_source_as_of timestamptz;
  v_comparability_key text;
  v_comparable boolean;
  v_types text[];
  v_reasons text[];
  v_storage_digest text;
  v_material boolean;
  v_stored integer := 0;
  v_skipped integer := 0;
  v_ids text[] := '{}';
  v_digests text[] := '{}';
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) < 1 or jsonb_array_length(p_events) > 250 then
    return jsonb_build_object('ok', false, 'error', 'risk_history_event_batch_invalid');
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) <> 'object' then
      raise exception 'risk_history_event_invalid' using errcode = '22023';
    end if;
    v_event_id := v_event->>'eventId';
    v_event_digest := v_event->>'eventDigest';
    v_asset := v_event->>'canonicalAssetId';
    v_asset_id := v_event->>'assetId';
    v_identity_class := v_event->>'identityClass';
    v_observed_at := (v_event->>'observedAt')::timestamptz;
    v_recorded_at := (v_event->>'recordedAt')::timestamptz;
    v_score := (v_event->>'score')::integer;
    v_level := v_event->>'level';
    v_publication_state := v_event->>'publicationState';
    v_customer_publishable := (v_event->>'customerPublishable')::boolean;
    v_methodology_version := v_event->>'methodologyVersion';
    v_score_version := v_event->>'scoreVersion';
    v_evidence_version := v_event->>'evidenceVersion';
    v_evidence_digest := v_event->>'evidenceDigest';
    v_source_as_of := case when v_event ? 'sourceAsOf' then (v_event->>'sourceAsOf')::timestamptz else null end;
    v_comparability_key := v_event->>'comparabilityKey';
    v_comparable := (v_event->>'comparableToPrevious')::boolean;
    v_types := array(select jsonb_array_elements_text(v_event->'eventTypes'));
    v_reasons := array(select jsonb_array_elements_text(v_event->'changeReasons'));

    perform pg_advisory_xact_lock(hashtextextended('p91-risk-history:' || v_asset, 0));

    select * into v_existing from public.velmere_risk_history_events where event_id = v_event_id for update;
    if found then
      if v_existing.event_digest <> v_event_digest or v_existing.event_json <> v_event then
        raise exception 'risk_history_event_id_conflict' using errcode = '23505';
      end if;
      v_skipped := v_skipped + 1;
      v_ids := array_append(v_ids, v_event_id);
      v_digests := array_append(v_digests, v_event_digest);
      continue;
    end if;

    select * into v_previous
    from public.velmere_risk_history_events
    where canonical_asset_id = v_asset
    order by observed_at desc
    limit 1
    for update;

    if found then
      if v_observed_at <= v_previous.observed_at then
        raise exception 'risk_history_observation_non_monotonic' using errcode = '22000';
      end if;
      v_material := v_score <> v_previous.risk_score
        or v_level <> v_previous.risk_level
        or v_comparability_key <> v_previous.comparability_key
        or v_evidence_digest <> v_previous.evidence_digest
        or v_evidence_version <> v_previous.evidence_version
        or v_publication_state <> v_previous.publication_state;

      if v_comparable <> (v_comparability_key = v_previous.comparability_key) then
        raise exception 'risk_history_comparability_flag_invalid' using errcode = '23514';
      end if;
      if v_score <> v_previous.risk_score and not ('SCORE_CHANGED' = any(v_types)) then
        raise exception 'risk_history_score_change_marker_missing' using errcode = '23514';
      end if;
      if v_level <> v_previous.risk_level and not ('LEVEL_CHANGED' = any(v_types)) then
        raise exception 'risk_history_level_change_marker_missing' using errcode = '23514';
      end if;
      if v_comparability_key <> v_previous.comparability_key and not ('METHODOLOGY_CHANGED' = any(v_types)) then
        raise exception 'risk_history_methodology_change_marker_missing' using errcode = '23514';
      end if;
      if (v_evidence_digest <> v_previous.evidence_digest or v_evidence_version <> v_previous.evidence_version)
         and not ('EVIDENCE_CHANGED' = any(v_types)) then
        raise exception 'risk_history_evidence_change_marker_missing' using errcode = '23514';
      end if;
      if v_publication_state <> v_previous.publication_state and not ('PUBLICATION_STATE_CHANGED' = any(v_types)) then
        raise exception 'risk_history_publication_change_marker_missing' using errcode = '23514';
      end if;

      if not v_material then
        if v_observed_at < v_previous.observed_at + interval '24 hours'
           or cardinality(v_types) <> 1 or not ('HEARTBEAT' = any(v_types)) then
          raise exception 'risk_history_unchanged_event_not_due' using errcode = '23514';
        end if;
      elsif 'HEARTBEAT' = any(v_types) or 'TRACKING_STARTED' = any(v_types) then
        raise exception 'risk_history_material_event_marker_invalid' using errcode = '23514';
      end if;
    else
      if cardinality(v_types) <> 1 or not ('TRACKING_STARTED' = any(v_types)) or v_comparable then
        raise exception 'risk_history_first_event_invalid' using errcode = '23514';
      end if;
    end if;

    v_storage_digest := 'sha256:' || encode(digest(convert_to(v_event::text, 'UTF8'), 'sha256'), 'hex');
    insert into public.velmere_risk_history_events(
      schema_version,event_id,event_digest,storage_digest,canonical_asset_id,asset_id,identity_class,
      symbol,name,observed_at,recorded_at,risk_score,risk_level,signal_count,confidence,
      publication_state,customer_publishable,methodology_version,score_version,evidence_version,
      evidence_digest,source_as_of,comparability_key,comparable_to_previous,event_types,change_reasons,event_json
    ) values (
      v_event->>'schemaVersion',v_event_id,v_event_digest,v_storage_digest,v_asset,v_asset_id,v_identity_class,
      v_event->>'symbol',v_event->>'name',v_observed_at,v_recorded_at,v_score,v_level,
      (v_event->>'signalCount')::integer,case when v_event ? 'confidence' then (v_event->>'confidence')::numeric else null end,
      v_publication_state,v_customer_publishable,v_methodology_version,v_score_version,v_evidence_version,
      v_evidence_digest,v_source_as_of,v_comparability_key,v_comparable,v_types,v_reasons,v_event
    );
    v_stored := v_stored + 1;
    v_ids := array_append(v_ids, v_event_id);
    v_digests := array_append(v_digests, v_event_digest);
  end loop;

  return jsonb_build_object(
    'ok', true,
    'stored', v_stored,
    'skipped', v_skipped,
    'conflicts', 0,
    'eventIds', to_jsonb(v_ids),
    'eventDigests', to_jsonb(v_digests)
  );
exception when others then
  raise;
end;
$$;
revoke all on function public.velmere_append_risk_history_events_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.velmere_append_risk_history_events_v1(jsonb) to service_role;

create or replace function public.velmere_read_risk_history_events_v1(
  p_event_ids text[]
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_event_ids is null or cardinality(p_event_ids) < 1 or cardinality(p_event_ids) > 250 then
    raise exception 'risk_history_event_id_batch_invalid' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(event_json order by observed_at)
    from public.velmere_risk_history_events
    where event_id = any(p_event_ids)
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.velmere_read_risk_history_events_v1(text[])
  from public, anon, authenticated;
grant execute on function public.velmere_read_risk_history_events_v1(text[]) to service_role;

create or replace function public.velmere_read_risk_history_by_asset_v1(
  p_asset_id text,
  p_limit integer default 144
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if p_asset_id is null or length(trim(p_asset_id)) < 1 or length(p_asset_id) > 256
     or p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'risk_history_asset_read_input_invalid' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(row.event_json order by row.observed_at)
    from (
      select event_json, observed_at
      from public.velmere_risk_history_events
      where canonical_asset_id = p_asset_id or asset_id = p_asset_id
      order by observed_at desc
      limit p_limit
    ) row
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.velmere_read_risk_history_by_asset_v1(text, integer)
  from public, anon, authenticated;
grant execute on function public.velmere_read_risk_history_by_asset_v1(text, integer) to service_role;

comment on table public.velmere_risk_history_events is
  'P91 immutable, event-driven and versioned Risk History. Customer publication requires a separate redacted projection; raw snapshots remain service-role-only.';
comment on function public.velmere_append_risk_history_events_v1(jsonb) is
  'P91 append-only Risk History transaction. It serializes per asset, rejects timestamp conflicts and suppresses unchanged events before the 24-hour heartbeat.';

-- P91 RISK HISTORY EVENT-DRIVEN, VERSIONED, DURABLE TRUTH END
begin;

-- P93 RISK HISTORY CANONICAL IDENTITY / NON-ENUMERATING PUBLIC RESOLUTION BEGIN
-- This service-role RPC resolves one canonical history before LIMIT is applied.
-- It prevents a reused legacy alias from mixing multiple assets in one customer
-- timeline. EMPTY and AMBIGUOUS are intentionally coarse internal outcomes; the
-- public application boundary normalizes both, plus only-WITHHELD histories, to
-- one non-enumerating empty customer projection. The RPC also replaces the
-- legacy OR-based reader for internal Shield/Angel/report consumers. Those
-- consumers may request a bounded analysis window up to 5,000 events; the
-- public HTTP route remains independently capped at 144.

create index if not exists velmere_risk_history_events_canonical_lower_time_idx
  on public.velmere_risk_history_events(lower(canonical_asset_id), observed_at desc);
create index if not exists velmere_risk_history_events_asset_lower_time_idx
  on public.velmere_risk_history_events(lower(asset_id), observed_at desc);

create or replace function public.velmere_read_risk_history_by_asset_v2(
  p_asset_id text,
  p_limit integer default 144
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_requested text;
  v_resolution text;
  v_canonical_asset_id text;
  v_events jsonb := '[]'::jsonb;
begin
  if p_asset_id is null
     or length(trim(p_asset_id)) < 1
     or length(p_asset_id) > 256
     or trim(p_asset_id) !~ '^[A-Za-z0-9:._-]{1,256}$'
     or p_limit is null
     or p_limit < 1
     or p_limit > 5000 then
    raise exception 'risk_history_asset_resolution_input_invalid' using errcode = '22023';
  end if;
  v_requested := lower(trim(p_asset_id));

  with exact_candidates as (
    select distinct canonical_asset_id
    from public.velmere_risk_history_events
    where lower(canonical_asset_id) = v_requested
  ), alias_candidates as (
    select distinct canonical_asset_id
    from public.velmere_risk_history_events
    where lower(asset_id) = v_requested
  ), candidate_counts as (
    select
      (select count(*) from exact_candidates) as exact_count,
      (select min(canonical_asset_id) from exact_candidates) as exact_id,
      (select count(*) from alias_candidates) as alias_count,
      (select min(canonical_asset_id) from alias_candidates) as alias_id
  )
  select
    case
      when exact_count = 1 then 'RESOLVED'
      when exact_count > 1 then 'AMBIGUOUS'
      when alias_count = 1 then 'RESOLVED'
      when alias_count > 1 then 'AMBIGUOUS'
      else 'EMPTY'
    end,
    case
      when exact_count = 1 then exact_id
      when exact_count = 0 and alias_count = 1 then alias_id
      else null
    end
  into v_resolution, v_canonical_asset_id
  from candidate_counts;

  if v_resolution = 'RESOLVED' then
    select coalesce(jsonb_agg(row.event_json order by row.observed_at), '[]'::jsonb)
    into v_events
    from (
      select event_json, observed_at
      from public.velmere_risk_history_events
      where canonical_asset_id = v_canonical_asset_id
      order by observed_at desc
      limit p_limit
    ) row;
    if jsonb_array_length(v_events) < 1 then
      raise exception 'risk_history_asset_resolution_empty_resolved_set' using errcode = '23514';
    end if;
  end if;

  return jsonb_build_object(
    'schemaVersion', 'velmere.risk-history-asset-resolution.v2',
    'resolution', v_resolution,
    'canonicalAssetId', v_canonical_asset_id,
    'events', v_events
  );
end;
$$;
revoke all on function public.velmere_read_risk_history_by_asset_v2(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.velmere_read_risk_history_by_asset_v2(text, integer) to service_role;

comment on function public.velmere_read_risk_history_by_asset_v2(text, integer) is
  'P93 service-role-only canonical Risk History resolution. Exact canonical identity takes precedence; ambiguous legacy aliases never mix histories and LIMIT is applied only after one canonical identity is selected.';

-- P93 RISK HISTORY CANONICAL IDENTITY / NON-ENUMERATING PUBLIC RESOLUTION END
commit;
begin;

-- P94 RISK HISTORY PUBLIC-ONLY PAGINATION / TEMPORAL WINDOW BEGIN
-- This service-role RPC is the only database reader intended for the public
-- Risk History HTTP route. Canonical resolution remains exact-before-alias,
-- but only customer-publishable PUBLIC events enter the returned page. Private
-- or WITHHELD events never cross into the public application process, cannot
-- consume the customer page limit and cannot influence hasOlder/nextBefore.
-- Pagination is exclusive on observed_at; P91 guarantees uniqueness per
-- canonical asset and observation timestamp.

create index if not exists velmere_risk_history_events_public_lower_time_idx
  on public.velmere_risk_history_events(lower(canonical_asset_id), observed_at desc)
  where customer_publishable and publication_state = 'PUBLIC';

create or replace function public.velmere_read_public_risk_history_by_asset_v1(
  p_asset_id text,
  p_limit integer default 144,
  p_before timestamptz default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_requested text;
  v_internal_resolution text;
  v_canonical_asset_id text;
  v_resolution_kind text;
  v_events jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
  v_has_older boolean := false;
  v_next_before timestamptz := null;
begin
  if p_asset_id is null
     or length(trim(p_asset_id)) < 1
     or length(p_asset_id) > 256
     or trim(p_asset_id) !~ '^[A-Za-z0-9:._-]{1,256}$'
     or p_limit is null
     or p_limit < 1
     or p_limit > 144
     or (p_before is not null and p_before > now() + interval '5 minutes') then
    raise exception 'risk_history_public_page_input_invalid' using errcode = '22023';
  end if;
  v_requested := lower(trim(p_asset_id));

  with exact_candidates as (
    select distinct canonical_asset_id
    from public.velmere_risk_history_events
    where lower(canonical_asset_id) = v_requested
  ), alias_candidates as (
    select distinct canonical_asset_id
    from public.velmere_risk_history_events
    where lower(asset_id) = v_requested
  ), candidate_counts as (
    select
      (select count(*) from exact_candidates) as exact_count,
      (select min(canonical_asset_id) from exact_candidates) as exact_id,
      (select count(*) from alias_candidates) as alias_count,
      (select min(canonical_asset_id) from alias_candidates) as alias_id
  )
  select
    case
      when exact_count = 1 then 'RESOLVED'
      when exact_count > 1 then 'AMBIGUOUS'
      when alias_count = 1 then 'RESOLVED'
      when alias_count > 1 then 'AMBIGUOUS'
      else 'EMPTY'
    end,
    case
      when exact_count = 1 then exact_id
      when exact_count = 0 and alias_count = 1 then alias_id
      else null
    end,
    case
      when exact_count = 1 then 'CANONICAL'
      when exact_count = 0 and alias_count = 1 then 'UNIQUE_ALIAS'
      else null
    end
  into v_internal_resolution, v_canonical_asset_id, v_resolution_kind
  from candidate_counts;

  if v_internal_resolution = 'RESOLVED' then
    with candidate_page as (
      select event_json, observed_at
      from public.velmere_risk_history_events
      where canonical_asset_id = v_canonical_asset_id
        and customer_publishable
        and publication_state = 'PUBLIC'
        and (p_before is null or observed_at < p_before)
      order by observed_at desc
      limit p_limit + 1
    ), numbered as (
      select event_json, observed_at, row_number() over (order by observed_at desc) as position
      from candidate_page
    ), page_rows as (
      select event_json, observed_at
      from numbered
      where position <= p_limit
    )
    select
      (select count(*) from candidate_page),
      coalesce((select jsonb_agg(event_json order by observed_at) from page_rows), '[]'::jsonb),
      (select min(observed_at) from page_rows)
    into v_candidate_count, v_events, v_next_before;

    v_has_older := v_candidate_count > p_limit;
    if jsonb_array_length(v_events) < 1 then
      -- Unknown, ambiguous and private-only/exhausted pages share the same
      -- public envelope. The canonical identifier is deliberately removed.
      v_internal_resolution := 'EMPTY';
      v_canonical_asset_id := null;
      v_has_older := false;
      v_next_before := null;
    elsif not v_has_older then
      v_next_before := null;
    end if;
  else
    -- Do not expose AMBIGUOUS as a distinct public result.
    v_internal_resolution := 'EMPTY';
    v_canonical_asset_id := null;
  end if;

  return jsonb_build_object(
    'schemaVersion', 'velmere.risk-history-public-resolution.v1',
    'resolution', case when v_internal_resolution = 'RESOLVED' then 'RESOLVED' else 'EMPTY' end,
    'canonicalAssetId', v_canonical_asset_id,
    'events', v_events,
    'requestBinding', jsonb_build_object(
      'schemaVersion', 'velmere.risk-history-public-request-binding.v1',
      'requestedId', v_requested,
      'resolutionKind', case when v_internal_resolution = 'RESOLVED' then v_resolution_kind else null end
    ),
    'page', jsonb_build_object(
      'requestedLimit', p_limit,
      'before', case when p_before is null then null else to_char(p_before at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'hasOlder', v_has_older,
      'nextBefore', case when v_has_older then to_char(v_next_before at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else null end
    )
  );
end;
$$;
revoke all on function public.velmere_read_public_risk_history_by_asset_v1(text, integer, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.velmere_read_public_risk_history_by_asset_v1(text, integer, timestamptz) to service_role;

comment on function public.velmere_read_public_risk_history_by_asset_v1(text, integer, timestamptz) is
  'P94 service-role-only customer-public Risk History page. It resolves one canonical asset, selects only PUBLIC/customer-publishable events, uses exclusive observed_at pagination and normalizes unknown, ambiguous, private-only and exhausted pages to one empty envelope.';

-- P94 RISK HISTORY PUBLIC-ONLY PAGINATION / TEMPORAL WINDOW END
commit;
