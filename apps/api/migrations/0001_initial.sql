create table if not exists store_meta (
  id integer primary key,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists roles (
  user_id text not null,
  role text not null,
  primary key (user_id, role)
);

create table if not exists user_roles (
  user_id text not null,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists trainers (
  id text primary key,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizers (
  id text primary key,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participant_profiles (
  id text primary key,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists groups (
  id text primary key,
  organizer_id text null,
  trainer_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists group_members (
  id text primary key,
  group_id text null,
  participant_profile_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_events (
  id text primary key,
  organizer_id text null,
  trainer_id text null,
  group_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_event_schedule_days (
  id text primary key,
  event_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists training_event_images (
  id text primary key,
  event_id text null,
  upload_id text null,
  url text not null,
  storage_path text not null,
  position integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public_training_events (
  id text primary key,
  organizer_id text null,
  trainer_id text null,
  group_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_participants (
  id text primary key,
  event_id text null,
  participant_profile_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists enrollment_requests (
  id text primary key,
  event_id text null,
  participant_profile_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trainer_organizer_relations (
  id text primary key,
  trainer_id text null,
  organizer_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  user_id text null,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_deliveries (
  id text primary key,
  notification_id text null,
  channel text not null,
  recipient text not null,
  provider text null,
  provider_message_id text null,
  status text not null,
  error text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  actor_user_id text null,
  action text not null,
  entity_type text null,
  entity_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists uploads (
  id text primary key,
  owner_user_id text null,
  purpose text not null,
  original_filename text not null,
  content_type text not null,
  byte_size integer not null,
  storage_path text not null,
  public_url text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists sms_challenges (
  phone text primary key,
  code text not null default '',
  requested_at timestamptz not null default now()
);

alter table sms_challenges add column if not exists code text not null default '';
alter table sms_challenges add column if not exists expires_at timestamptz null;
alter table sms_challenges add column if not exists used_at timestamptz null;
alter table sms_challenges add column if not exists request_ip text null;
alter table sms_challenges add column if not exists attempt_count integer not null default 0;

create table if not exists sms_request_attempts (
  id text primary key,
  phone text not null,
  request_ip text null,
  created_at timestamptz not null default now()
);

create index if not exists sms_request_attempts_phone_created_idx on sms_request_attempts (phone, created_at);
create index if not exists sms_request_attempts_ip_created_idx on sms_request_attempts (request_ip, created_at);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create table if not exists registration_tokens (
  token_hash text primary key,
  phone text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz null
);

create index if not exists registration_tokens_phone_idx on registration_tokens (phone);

create table if not exists signed_action_tokens (
  token_hash text primary key,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists signed_action_tokens_entity_idx on signed_action_tokens (entity_type, entity_id);
