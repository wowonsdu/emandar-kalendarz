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

create table if not exists app_settings (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists sms_challenges (
  phone text primary key,
  requested_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);
