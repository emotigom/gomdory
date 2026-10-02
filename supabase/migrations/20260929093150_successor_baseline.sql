-- Successor baseline candidate generated from gom-clean-prod read-only catalog.
-- Issue: #2901
-- Source project: kjhnrvxkepwuanbhgowv
-- Source main: 67f105e5c2756b5694270d410f595c5296c22309
-- Active successor baseline identity: 20260929093150_successor_baseline.
-- Provider-managed schemas/extensions/default ACLs are supplied by the Supabase platform fixture.
-- Data contents and sequence current values are intentionally excluded.

set check_function_bodies = off;
set search_path = "$user", public, extensions;

-- -----------------------------------------------------------------------------
-- Sequences and tables
-- -----------------------------------------------------------------------------
create sequence public.card_move_mutations_id_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1 cache 1 no cycle;

create table public.api_rate_limits (
  key text not null,
  window_start timestamp with time zone not null,
  count integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.audit_events (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  actor_user_id uuid,
  actor_anon_id text,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb default '{}'::jsonb not null,
  request_id text,
  host text
);

create table public.audit_logs (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  board_id uuid,
  actor_user_id uuid,
  actor_role text,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb default '{}'::jsonb not null,
  request_id text,
  ip text,
  user_agent text
);

create table public.audit_logs_daily_summary (
  log_day date not null,
  action text not null,
  row_count bigint not null,
  first_created_at timestamp with time zone not null,
  last_created_at timestamp with time zone not null,
  summarized_at timestamp with time zone default now() not null
);

create table public.billing_events (
  id text not null,
  provider text not null,
  type text not null,
  received_at timestamp with time zone default now() not null,
  processed_at timestamp with time zone,
  status text default 'received'::text not null,
  meta jsonb default '{}'::jsonb not null
);

create table public.board_controls (
  board_id uuid not null,
  updated_at timestamp with time zone default now() not null,
  announcement text,
  inputs_locked boolean default false not null,
  pinned_question_ids text[] default '{}'::text[] not null,
  hidden_action_ids text[] default '{}'::text[] not null,
  resolved_help_ids text[] default '{}'::text[] not null,
  version integer default 1 not null,
  updated_by_user_id uuid,
  locks jsonb default '{}'::jsonb not null,
  hud jsonb default '{}'::jsonb not null,
  reply_templates jsonb default '[]'::jsonb not null
);

create table public.board_files (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  board_id uuid not null,
  r2_key text not null,
  filename text not null,
  bytes bigint not null,
  mime text,
  width integer,
  height integer,
  created_at timestamp with time zone default now() not null,
  tags text[] default '{}'::text[] not null,
  deleted_at timestamp with time zone,
  is_favorite boolean default false not null,
  last_used_at timestamp with time zone,
  file_id uuid,
  inserted_by uuid not null,
  hash_sha256 text,
  variant text default 'original'::text not null,
  original_bytes bigint,
  optimized_bytes bigint,
  bytes_saved bigint,
  deleted_purge_at timestamp with time zone,
  deleted_by uuid,
  delete_reason text,
  updated_at timestamp with time zone default now() not null
);

create table public.board_invites (
  token uuid default gen_random_uuid() not null,
  board_id uuid not null,
  invited_email text not null,
  role text not null,
  invited_by uuid not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '14 days'::interval) not null,
  accepted_at timestamp with time zone
);

create table public.board_live_session (
  board_id uuid not null,
  snapshot jsonb not null,
  version bigint default 1 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.board_members (
  board_id uuid not null,
  user_id uuid not null,
  role text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.board_policies (
  board_id uuid not null,
  editors_can_soft_delete boolean default true not null,
  editors_can_manage_trash boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);

create table public.board_polls (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  share_code text not null,
  question text not null,
  options jsonb not null,
  created_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone
);

create table public.board_question_throttles (
  share_code text not null,
  fingerprint text not null,
  last_submit_at timestamp with time zone not null,
  submit_count integer
);

create table public.board_questions (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  share_code text not null,
  author text,
  body text not null,
  status text default 'queued'::text not null,
  pinned boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.board_share_settings (
  board_id uuid not null,
  student_default_view text default 'feed'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.board_view_presets (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  board_id uuid not null,
  name text not null,
  state jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  is_pinned boolean default false not null,
  pin_order integer default 0 not null,
  is_default boolean default false not null
);

create table public.boards (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  share_code text,
  share_enabled boolean default false not null,
  share_updated_at timestamp with time zone default now() not null,
  share_write_enabled boolean default true not null,
  share_write_updated_at timestamp with time zone default now() not null,
  class_state text default 'idle'::text not null,
  class_notice text,
  class_updated_at timestamp with time zone default now() not null,
  rules_text text,
  rules_updated_at timestamp with time zone default now() not null,
  active_session_id uuid,
  board_view_type text default 'grid'::text not null,
  class_id uuid,
  wall_v2_enabled boolean default false not null,
  tools_enabled text[] default '{}'::text[] not null,
  tools_updated_at timestamp with time zone default now() not null,
  ui_minimap_mode text default 'hover'::text not null,
  ui_minimap_updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  deleted_purge_at timestamp with time zone,
  ui_wallpaper_key text,
  ui_wallpaper_updated_at timestamp with time zone,
  ui_theme_config jsonb,
  ui_theme_updated_at timestamp with time zone default now() not null
);

create table public.card_files (
  id uuid default gen_random_uuid() not null,
  card_id uuid not null,
  board_file_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.card_move_mutations (
  id bigint default nextval('card_move_mutations_id_seq'::regclass) not null,
  scope text not null,
  actor_id text not null,
  board_id uuid not null,
  card_id uuid not null,
  target_wall_id uuid not null,
  client_mutation_id text not null,
  created_at timestamp with time zone default now() not null
);

create table public.card_tags (
  card_id uuid not null,
  tag_id uuid not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

create table public.cards (
  id uuid default gen_random_uuid() not null,
  wall_id uuid not null,
  owner_id uuid default auth.uid() not null,
  text text not null,
  created_at timestamp with time zone default now() not null,
  author_type text default 'teacher'::text not null,
  author_name text,
  is_hidden boolean default false not null,
  hidden_at timestamp with time zone,
  is_pinned boolean default false not null,
  pinned_at timestamp with time zone,
  is_featured boolean default false not null,
  featured_at timestamp with time zone,
  external_attachments jsonb,
  card_color_token text,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  delete_reason text,
  author_client_id text,
  deleted_purge_at timestamp with time zone,
  "position" integer
);

create table public.class_sections (
  id uuid default gen_random_uuid() not null,
  class_id uuid not null,
  title text not null,
  sort_index integer default 0 not null,
  created_by uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table public.class_session_bookmarks (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  session_id uuid not null,
  ts timestamp with time zone default now() not null,
  note text,
  created_at timestamp with time zone default now()
);

create table public.class_session_clip_shares (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  session_id uuid not null,
  token text not null,
  clip_start_ts timestamp with time zone not null,
  clip_end_ts timestamp with time zone not null,
  mode text not null,
  title text,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone,
  expires_at timestamp with time zone
);

create table public.class_session_controls (
  session_id uuid not null,
  questions_locked boolean default false not null,
  help_locked boolean default false not null,
  updated_at timestamp with time zone default now() not null
);

create table public.class_session_events (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  board_id uuid not null,
  share_code text not null,
  ts timestamp with time zone default now() not null,
  type text not null,
  payload jsonb default '{}'::jsonb not null
);

create table public.class_session_questions (
  id uuid default gen_random_uuid() not null,
  session_id uuid not null,
  board_id uuid not null,
  author_id uuid,
  body text not null,
  status text default 'pending'::text not null,
  pinned boolean default false not null,
  teacher_reply text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.class_sessions (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  owner_id uuid default auth.uid() not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  notice text,
  rules_text text,
  stats jsonb,
  created_at timestamp with time zone default now() not null,
  recap_share_enabled boolean default false not null,
  recap_shared_at timestamp with time zone,
  report_title text,
  school_name text,
  class_name text,
  subject text,
  teacher_name text,
  period_label text,
  learning_goals text,
  report_template text,
  report_updated_at timestamp with time zone,
  share_code text not null,
  title text,
  created_by uuid default auth.uid(),
  report jsonb,
  status text default 'running'::text not null,
  class_id uuid,
  section_id uuid,
  summary text,
  teacher_notes text,
  updated_at timestamp with time zone default now() not null
);

create table public.class_showcase_items (
  id uuid default gen_random_uuid() not null,
  showcase_id uuid not null,
  created_by uuid not null,
  kind text not null,
  ref_id text not null,
  title text not null,
  subtitle text,
  thumb_url text,
  safe_text text,
  sort_index integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.class_showcases (
  id uuid default gen_random_uuid() not null,
  class_id uuid not null,
  session_id uuid not null,
  created_by uuid not null,
  title text not null,
  mode text default 'safe'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  item_count integer default 0 not null
);

create table public.classes (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  title text not null,
  short_code text not null,
  active_board_id uuid,
  created_at timestamp with time zone default now() not null
);

create table public.community_blocked_users (
  user_id uuid not null,
  blocked_by_user_id uuid not null,
  reason text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.community_comment_moderation (
  comment_id uuid not null,
  is_hidden boolean default false not null,
  staff_note text,
  updated_at timestamp with time zone default now() not null
);

create table public.community_comment_reports (
  id uuid default gen_random_uuid() not null,
  comment_id uuid not null,
  reporter_user_id uuid not null,
  reason text not null,
  created_at timestamp with time zone default now() not null
);

create table public.community_comments (
  id uuid default gen_random_uuid() not null,
  post_id uuid not null,
  author_user_id uuid not null,
  body text not null,
  status text default 'active'::text not null,
  moderation_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

create table public.community_moderators (
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.community_posts (
  id uuid default gen_random_uuid() not null,
  author_user_id uuid not null,
  title text not null,
  body text not null,
  status text default 'active'::text not null,
  moderation_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  category text default 'free'::text not null,
  is_pinned boolean default false not null,
  external_attachments jsonb default '[]'::jsonb not null,
  attachment_file_ids uuid[] default '{}'::uuid[] not null
);

create table public.community_reactions (
  post_id uuid not null,
  user_id uuid not null,
  reaction_type text default 'like'::text not null,
  created_at timestamp with time zone default now() not null
);

create table public.community_reports (
  id uuid default gen_random_uuid() not null,
  target_type text not null,
  target_id uuid not null,
  reporter_user_id uuid not null,
  reason text not null,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  resolved_at timestamp with time zone,
  resolved_by_user_id uuid,
  updated_at timestamp with time zone default now() not null
);

create table public.community_reports_archive (
  id uuid not null,
  target_type text not null,
  target_id uuid not null,
  reporter_user_id uuid not null,
  reason text not null,
  status text not null,
  created_at timestamp with time zone not null,
  resolved_at timestamp with time zone,
  resolved_by_user_id uuid,
  archived_at timestamp with time zone default now() not null
);

create table public.coupon_codes (
  id uuid default gen_random_uuid() not null,
  code_sha256 text not null,
  code_display text not null,
  expires_at timestamp with time zone,
  max_uses integer not null,
  uses integer default 0 not null,
  effect_type text not null,
  effect_value bigint not null,
  note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.coupon_redemptions (
  id uuid default gen_random_uuid() not null,
  coupon_id uuid not null,
  user_id uuid not null,
  redeemed_at timestamp with time zone default now() not null,
  meta jsonb default '{}'::jsonb not null
);

create table public.courseware_published_snapshots (
  id uuid default gen_random_uuid() not null,
  share_id text not null,
  owner_id uuid,
  title text not null,
  description text,
  lesson_number integer,
  artifact_label text,
  snapshot_json jsonb not null,
  renderer_version text default 'safe-blocks-v1'::text not null,
  visibility text default 'link-public'::text not null,
  noindex boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone
);

create table public.decorate_plan_cache (
  key text not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  plan_json jsonb not null,
  meta jsonb default '{}'::jsonb not null
);

create table public.edu_assignments (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  share_code text not null,
  title text not null,
  lesson_id integer not null,
  template_key text not null,
  allow_network boolean default false,
  due_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  is_closed boolean default false
);

create table public.edu_broadcasts (
  board_id uuid not null,
  message text,
  cta_type text,
  cta_label text,
  version integer default 1 not null,
  updated_at timestamp with time zone default now() not null,
  updated_by text
);

create table public.edu_classes (
  board_id uuid not null,
  share_code text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  locked_at timestamp with time zone,
  lock_reason text
);

create table public.edu_feature_flags (
  user_id uuid not null,
  webllm_enabled boolean default false not null,
  netsaver_enabled boolean default false not null,
  netsaver_mode text default 'lease_only'::text not null,
  netsaver_p2p_tier text,
  max_bytes integer default 10485760 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_featured_projects (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  slug text not null,
  created_at timestamp with time zone default now() not null,
  sort_order integer
);

create table public.edu_gallery (
  id uuid default gen_random_uuid() not null,
  class_code text not null,
  view_id text not null,
  lesson_key text,
  title text not null,
  author_name text not null,
  preview_url text,
  view_count bigint default 0 not null,
  hidden boolean default false not null,
  hidden_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_join_codes (
  code text not null,
  board_id uuid not null,
  created_at timestamp with time zone default now(),
  revoked_at timestamp with time zone,
  is_active boolean default true
);

create table public.edu_join_sessions (
  token text not null,
  share_code text not null,
  nickname text,
  board_id uuid,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  last_used_at timestamp with time zone,
  participant_subject_hash text
);

create table public.edu_lesson_attendance_daily (
  code_hash text not null,
  lesson_key text not null,
  day_bucket date not null,
  unique_anon_count integer default 0 not null,
  anon_hashes jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_lesson_completions_daily (
  code_hash text not null,
  lesson_key text not null,
  day_bucket date not null,
  unique_anon_count integer default 0 not null,
  anon_hashes jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_participants (
  id uuid default gen_random_uuid() not null,
  share_code text not null,
  anon_id text not null,
  name text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone default now() not null,
  progress jsonb default '{}'::jsonb not null,
  published_slugs text[] default '{}'::text[] not null,
  board_id uuid
);

create table public.edu_presentation_links (
  board_id uuid not null,
  code text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone,
  is_active boolean default true not null
);

create table public.edu_presentation_settings (
  board_id uuid not null,
  autoplay_default boolean default false not null,
  interval_sec_default integer default 20 not null,
  updated_at timestamp with time zone default now() not null,
  updated_by text,
  start_slug text,
  start_mode text default 'auto'::text not null
);

create table public.edu_project_feedback (
  slug text not null,
  board_id uuid,
  teacher_user_id text not null,
  stamp text,
  comment text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_project_files (
  project_id uuid not null,
  path text not null,
  content_type text not null,
  size_bytes bigint not null
);

create table public.edu_project_stats (
  slug text not null,
  view_count bigint default 0 not null,
  last_viewed_at timestamp with time zone
);

create table public.edu_project_visibility (
  slug text not null,
  board_id uuid,
  hidden boolean default false not null,
  hidden_reason text,
  hidden_at timestamp with time zone,
  hidden_by text
);

create table public.edu_projects (
  id uuid default gen_random_uuid() not null,
  share_code text not null,
  author_name text not null,
  title text not null,
  slug text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '30 days'::interval),
  anon_id text,
  board_id uuid,
  lesson_id integer,
  publish_state text default 'DRAFT'::text not null,
  publish_state_reason text,
  last_validated_at timestamp with time zone,
  last_published_at timestamp with time zone,
  preview_url text,
  public_url text,
  classroom_url text,
  last_request_id text,
  publish_quota_key text
);

create table public.edu_publish_attempts (
  attempt_id uuid not null,
  parent_attempt_id uuid,
  root_attempt_id uuid not null,
  project_id uuid,
  slug text not null,
  lesson_id smallint not null,
  manifest_schema_version smallint default 1 not null,
  declared_manifest_digest text not null,
  declared_manifest jsonb not null,
  verified_manifest_digest text,
  state text default 'PREPARED'::text not null,
  failure_code text,
  retry_count integer default 0 not null,
  commit_count integer default 0 not null,
  attempt_version bigint default 0 not null,
  lease_owner uuid,
  lease_expires_at timestamp with time zone,
  prepared_at timestamp with time zone default now() not null,
  validation_started_at timestamp with time zone,
  published_at timestamp with time zone,
  failed_at timestamp with time zone,
  expires_at timestamp with time zone not null,
  capability_issued_at timestamp with time zone,
  capability_expires_at timestamp with time zone,
  capability_kid text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_publish_slug_reservations (
  slug text not null,
  attempt_id uuid,
  project_id uuid,
  reservation_state text not null,
  reserved_at timestamp with time zone default now() not null,
  converted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.edu_reports (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  board_id uuid,
  reporter_anon_id text,
  reporter_name text,
  reason text not null,
  note text,
  created_at timestamp with time zone default now() not null,
  status text default 'open'::text not null
);

create table public.edu_submissions (
  id uuid default gen_random_uuid() not null,
  assignment_id uuid not null,
  anon_id text,
  student_name text,
  slug text not null,
  created_at timestamp with time zone default now() not null
);

create table public.exhibit_versions (
  id uuid default gen_random_uuid() not null,
  exhibit_id uuid not null,
  schema_version integer default 1 not null,
  payload jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table public.exhibits (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  owner_id uuid not null,
  title text not null,
  description text,
  status text default 'active'::text not null,
  mode text default 'safe'::text not null,
  token text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  last_generated_at timestamp with time zone
);

create table public.file_savings_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null,
  kind text not null,
  original_bytes bigint default 0 not null,
  optimized_bytes bigint default 0 not null,
  reused_file_id uuid
);

create table public.files (
  id uuid default gen_random_uuid() not null,
  card_id uuid not null,
  owner_id uuid default auth.uid() not null,
  r2_key text not null,
  filename text not null,
  content_type text not null,
  size_bytes bigint not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  sha256_hex text,
  original_bytes bigint,
  stored_bytes bigint,
  width integer,
  height integer,
  optimized boolean default false not null,
  deduped boolean default false not null,
  owner_user_id uuid not null,
  mime text not null,
  sha256 text,
  duration_ms integer,
  original_name text,
  tags text[] default '{}'::text[] not null,
  deleted_at timestamp with time zone,
  content_sha256 text,
  original_size_bytes bigint default 0 not null,
  optimized_size_bytes bigint default 0 not null,
  is_optimized boolean default false not null,
  optimization_format text,
  updated_at timestamp with time zone default now() not null,
  content_hash text,
  object_key text,
  bytes_original bigint,
  bytes_stored bigint,
  dedup_reused boolean default false not null,
  optimized_at timestamp with time zone,
  deleted_purge_at timestamp with time zone
);

create table public.google_drive_preferences (
  user_id uuid not null,
  folder_id text not null,
  folder_name text not null,
  folder_web_view_link text,
  updated_at timestamp with time zone default now() not null,
  purpose text default 'student-records'::text not null
);

create table public.institution_requests (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  requester_user_id uuid not null,
  requester_email text not null,
  org_name text not null,
  contact_name text,
  contact_email text,
  plan text default 'pro'::text not null,
  term text default '1y'::text not null,
  seats integer default 1 not null,
  message text,
  status text default 'new'::text not null,
  meta jsonb default '{}'::jsonb not null
);

create table public.lesson_activity_runs (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  class_session_id uuid not null,
  lesson_template_id text not null,
  activity_type text not null,
  status text default 'active'::text not null,
  config jsonb default '{}'::jsonb not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  started_at timestamp with time zone default now() not null,
  ended_at timestamp with time zone
);

create table public.license_keys (
  id uuid default gen_random_uuid() not null,
  code_sha256 text not null,
  plan text default 'pro'::text not null,
  expires_at timestamp with time zone,
  max_uses integer default 1 not null,
  uses integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  note text,
  display_hint text default ''::text not null,
  seats integer default 1 not null,
  created_by_user_id uuid,
  issued_to text
);

create table public.live_participants (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  share_code text not null,
  fingerprint text not null,
  display_name text,
  joined_at timestamp with time zone default now() not null,
  last_seen_at timestamp with time zone default now() not null,
  user_agent text
);

create table public.metaverse_progress_snapshots (
  user_id uuid not null,
  world_id text not null,
  recent_completion jsonb not null,
  last_completed_mission jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.moderation_hides (
  target_type text not null,
  target_id text not null,
  hidden boolean default true not null,
  hidden_reason text,
  hidden_at timestamp with time zone,
  hidden_by uuid
);

create table public.ops_banners (
  id uuid default gen_random_uuid() not null,
  message text not null,
  level text default 'info'::text not null,
  updated_at timestamp with time zone default now() not null,
  href text,
  label text,
  enabled boolean default false not null,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
);

create table public.ops_events (
  id uuid default gen_random_uuid() not null,
  request_id text,
  route text,
  ts timestamp with time zone default now() not null,
  level text not null,
  kind text not null,
  status integer,
  duration_ms integer,
  meta jsonb,
  sample_rate integer
);

create table public.ops_reports_backlog_runs (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  actor_user_id uuid not null,
  would_count integer default 0 not null,
  preview_payload jsonb default '{}'::jsonb not null,
  status text default 'previewed'::text not null,
  executed_count integer,
  note text
);

create table public.ops_retention_config (
  id boolean default true not null,
  community_reports_resolved_ttl_days integer default 90 not null,
  audit_logs_ttl_days integer default 180 not null,
  rate_limits_ttl_days integer default 7 not null,
  rate_limit_counters_grace_days integer default 2 not null,
  run_every_hours integer default 24 not null,
  enabled boolean default true not null,
  updated_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table public.ops_retention_runs (
  id bigint generated always as identity not null,
  trigger_source text not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  success boolean,
  community_reports_archived integer default 0 not null,
  community_reports_purged integer default 0 not null,
  audit_logs_summarized integer default 0 not null,
  audit_logs_purged integer default 0 not null,
  rate_limits_purged integer default 0 not null,
  api_rate_limits_purged integer default 0 not null,
  rate_limit_counters_purged integer default 0 not null,
  note text,
  dry_run boolean default false not null,
  would_community_reports_archived integer default 0 not null,
  would_community_reports_purged integer default 0 not null,
  would_audit_logs_summarized integer default 0 not null,
  would_audit_logs_purged integer default 0 not null,
  would_rate_limits_purged integer default 0 not null,
  would_api_rate_limits_purged integer default 0 not null,
  would_rate_limit_counters_purged integer default 0 not null
);

create table public.ops_user_assistant_runs (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  actor_user_id uuid not null,
  target_user_id uuid not null,
  assistant_type text not null,
  would_payload jsonb default '{}'::jsonb not null,
  status text default 'previewed'::text not null,
  executed_at timestamp with time zone,
  note text,
  request_id text
);

create table public.ownership_requests (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  share_code text not null,
  student_name text not null,
  new_client_id text not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  approved_at timestamp with time zone,
  approved_by_user_id uuid,
  approved_card_count integer
);

create table public.poll_responses (
  poll_id uuid not null,
  share_code text not null,
  fingerprint text not null,
  option_id text not null,
  created_at timestamp with time zone default now() not null
);

create table public.pro_waitlist (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  email text not null,
  created_at timestamp with time zone default now() not null
);

create table public.public_showcase_snapshots (
  token_hash text not null,
  payload jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table public.public_showcase_tokens (
  token_hash text not null,
  showcase_id uuid not null,
  token_prefix text not null,
  created_by uuid not null,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone,
  expires_at timestamp with time zone default (now() + '30 days'::interval)
);

create table public.publish_events (
  id uuid default gen_random_uuid() not null,
  project_id uuid not null,
  state text not null,
  reason_code text,
  meta jsonb default '{}'::jsonb not null,
  request_id text,
  created_at timestamp with time zone default now() not null
);

create table public.pulse_events (
  share_code text not null,
  fingerprint text not null,
  kind text not null,
  created_at timestamp with time zone default now() not null
);

create table public.rate_limit_counters (
  key text not null,
  count integer default 0 not null,
  reset_at timestamp with time zone not null,
  window_ms integer not null,
  updated_at timestamp with time zone default now() not null
);

create table public.rate_limits (
  key text not null,
  window_start timestamp with time zone not null,
  count integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.reports (
  id uuid default gen_random_uuid() not null,
  target_type text not null,
  target_id text not null,
  board_id uuid,
  code text,
  reporter_anon_id text,
  reporter_user_id uuid,
  reason text not null,
  detail text,
  created_at timestamp with time zone default now() not null
);

create table public.session_report_shares (
  token text not null,
  board_id uuid not null,
  session_id uuid not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '30 days'::interval),
  revoked_at timestamp with time zone
);

create table public.showcase_tokens (
  token text not null,
  showcase_id uuid not null,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone,
  last_accessed_at timestamp with time zone
);

create table public.showcases (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  owner_id uuid not null,
  mode text default 'safe'::text not null,
  title text default ''::text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  source text default 'session'::text not null,
  snapshot jsonb default '{}'::jsonb not null,
  is_revoked boolean default false not null
);

create table public.site_content (
  key text not null,
  title text default ''::text not null,
  body text default ''::text not null,
  status text default 'draft'::text not null,
  published_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  publish_at timestamp with time zone,
  expires_at timestamp with time zone,
  body_blocks jsonb
);

create table public.site_content_revisions (
  id uuid default gen_random_uuid() not null,
  key text not null,
  title text default ''::text not null,
  body text default ''::text not null,
  status text default 'draft'::text not null,
  created_at timestamp with time zone default now() not null,
  note text,
  body_blocks jsonb
);

create table public.storage_objects (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  board_id uuid,
  class_id uuid,
  r2_key text not null,
  bytes bigint not null,
  mime text,
  created_at timestamp with time zone default now() not null,
  last_accessed_at timestamp with time zone,
  hash_sha256 text
);

create table public.storage_quota (
  owner_id uuid not null,
  quota_bytes bigint default '10737418240'::bigint not null,
  updated_at timestamp with time zone default now() not null
);

create table public.storage_usage (
  user_id uuid default auth.uid() not null,
  bytes_used bigint default 0 not null,
  bytes_saved_estimate bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table public.storage_usage_daily (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  day date not null,
  r2_bytes bigint default 0 not null,
  db_bytes bigint default 0 not null,
  files_count integer default 0 not null,
  optimized_bytes_saved bigint default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.student_activity_states (
  id uuid default gen_random_uuid() not null,
  activity_run_id uuid not null,
  board_id uuid not null,
  participant_key_hash text not null,
  user_id uuid,
  display_name text,
  state jsonb default '{}'::jsonb not null,
  status text default 'in_progress'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  submitted_at timestamp with time zone
);

create table public.student_app_class_sessions (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  class_id uuid,
  started_by uuid not null,
  status text default 'active'::text not null,
  starts_at timestamp with time zone default now() not null,
  ends_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  publish_mode text default 'teacher_review'::text not null
);

create table public.student_app_deployment_files (
  id uuid default gen_random_uuid() not null,
  deployment_id uuid not null,
  path text not null,
  r2_key text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamp with time zone default now() not null
);

create table public.student_app_deployments (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  wall_id uuid,
  card_id uuid,
  class_id uuid,
  created_by uuid not null,
  title text not null,
  slug text not null,
  version integer default 1 not null,
  status text default 'stored'::text not null,
  source text default 'manual_files'::text not null,
  entry_file text default 'index.html'::text not null,
  r2_prefix text not null,
  manifest jsonb not null,
  safety jsonb default '{}'::jsonb not null,
  file_count integer default 0 not null,
  total_size_bytes bigint default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  stored_at timestamp with time zone,
  approved_at timestamp with time zone,
  published_at timestamp with time zone,
  archived_at timestamp with time zone,
  deleted_at timestamp with time zone,
  source_submission_id uuid
);

create table public.student_app_submission_files (
  id uuid default gen_random_uuid() not null,
  submission_id uuid not null,
  path text not null,
  r2_key text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamp with time zone default now() not null
);

create table public.student_app_submissions (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  wall_id uuid,
  card_id uuid,
  class_id uuid,
  submitted_by_name text,
  submitted_by_user_id uuid,
  title text not null,
  status text default 'submitted'::text not null,
  source text default 'manual_files'::text not null,
  validation jsonb not null,
  manifest jsonb,
  summary jsonb default '{}'::jsonb not null,
  teacher_note text,
  student_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  reviewed_at timestamp with time zone,
  archived_at timestamp with time zone,
  deleted_at timestamp with time zone,
  r2_prefix text,
  stored_at timestamp with time zone,
  class_session_id uuid,
  author_client_id text,
  app_key text,
  version integer default 1 not null,
  previous_submission_id uuid,
  is_latest boolean default true not null,
  ownership_version integer,
  owner_participant_hash text,
  status_capability_hash text
);

create table public.student_requests (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  board_id uuid,
  code text not null,
  anon_id text not null,
  type text not null,
  text text,
  meta jsonb default '{}'::jsonb not null,
  status text default 'queued'::text not null,
  decided_at timestamp with time zone,
  decided_by_user_id uuid,
  decision_reason text,
  pinned boolean default false not null
);

create table public.tag_rules (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  enabled boolean default true not null,
  priority integer default 100 not null,
  match_type text not null,
  pattern text not null,
  tag_id uuid not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid,
  updated_at timestamp with time zone default now() not null
);

create table public.tags (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  name text not null,
  color text,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);

create table public.template_collection_items (
  id uuid default gen_random_uuid() not null,
  collection_id uuid not null,
  template_id uuid not null,
  rank integer default 0 not null,
  note text
);

create table public.template_collections (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  slug text not null,
  title text not null,
  description text,
  visibility text default 'public'::text not null,
  kind text default 'picks'::text not null,
  cover_image_url text,
  is_locked boolean default false not null,
  badge text,
  tier text default 'free'::text not null,
  sort_order integer default 0 not null,
  cover jsonb
);

create table public.template_library_installs (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  user_id uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table public.template_library_items (
  id uuid default gen_random_uuid() not null,
  owner_id uuid default auth.uid() not null,
  scope text default 'private'::text not null,
  status text default 'draft'::text not null,
  title text not null,
  subtitle text,
  category text,
  grade_band text default 'ANY'::text,
  duration_min integer,
  tags text[] default '{}'::text[] not null,
  cover_key text,
  payload jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  published_at timestamp with time zone,
  installs_count integer default 0 not null,
  reports_count integer default 0 not null,
  likes_count integer default 0 not null,
  reviews_count integer default 0 not null,
  avg_rating numeric(2,1) default 0.0 not null,
  is_pro boolean default false not null,
  is_pick boolean default false not null,
  pick_rank integer
);

create table public.template_library_likes (
  template_id uuid not null,
  user_id uuid default auth.uid() not null,
  created_at timestamp with time zone default now() not null
);

create table public.template_library_reports (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  reporter_id uuid default auth.uid() not null,
  reason text not null,
  detail text,
  created_at timestamp with time zone default now() not null
);

create table public.template_library_reviews (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  user_id uuid default auth.uid() not null,
  rating integer not null,
  comment text,
  created_at timestamp with time zone default now() not null
);

create table public.template_reports (
  report_id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  template_id uuid not null,
  reporter_user_id uuid,
  reporter_anon_id text,
  reason text not null,
  note text default ''::text not null,
  request_id text,
  host text,
  reporter_hash text default ''::text not null
);

create table public.template_versions (
  id uuid default gen_random_uuid() not null,
  template_id uuid not null,
  schema_version integer default 1 not null,
  payload jsonb not null,
  preview jsonb not null,
  created_at timestamp with time zone default now() not null,
  payload_preview jsonb
);

create table public.templates (
  template_id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  owner_user_id uuid not null,
  title text not null,
  description text default ''::text not null,
  subject text,
  grade_band text,
  tags text[] default '{}'::text[] not null,
  cover_file_id uuid,
  payload jsonb not null,
  visibility text default 'unlisted'::text not null,
  pro_only boolean default false not null,
  picks_rank integer,
  stats jsonb default '{"clones": 0, "reports": 0}'::jsonb not null,
  moderation jsonb default '{"autoHidden": false, "lastReason": null, "reportCount": 0}'::jsonb not null,
  status text default 'active'::text not null,
  report_count integer default 0 not null,
  copy_count integer default 0 not null,
  last_reported_at timestamp with time zone,
  tier text default 'free'::text not null,
  source text default 'community'::text not null,
  collection_id uuid,
  access_level text default 'free'::text not null,
  is_featured boolean default false not null,
  featured_rank integer
);

create table public.upgrade_requests (
  request_id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid not null,
  org_name text default ''::text not null,
  contact_email text default ''::text not null,
  seats integer,
  message text default ''::text not null,
  status text default 'new'::text not null,
  meta jsonb default '{}'::jsonb not null
);

create table public.user_entitlements (
  user_id uuid not null,
  plan text default 'free'::text not null,
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  source text default 'system'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  provider text default 'none'::text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  pro_ends_at timestamp with time zone,
  billing_status text default 'free'::text not null
);

create table public.user_onboarding (
  user_id uuid not null,
  kickstarted_at timestamp with time zone,
  kickstart_version integer default 1 not null,
  created_at timestamp with time zone default now() not null
);

create table public.user_plans (
  user_id uuid not null,
  plan text default 'free'::text not null,
  started_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  source text default 'manual'::text not null,
  note text default ''::text not null,
  updated_at timestamp with time zone default now() not null
);

create table public.user_ui_prefs (
  user_id uuid not null,
  class_prefs jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  default_minimap_mode text default 'hover'::text not null,
  default_wall_width_px integer default 360 not null,
  default_tools_enabled text[] default '{}'::text[] not null
);

create table public.wall_cards_v2 (
  id uuid default gen_random_uuid() not null,
  section_id uuid not null,
  author_id uuid,
  "position" integer not null,
  content jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.wall_sections_v2 (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  title text not null,
  "position" integer not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.walls (
  id uuid default gen_random_uuid() not null,
  board_id uuid not null,
  owner_id uuid default auth.uid() not null,
  title text not null,
  description text,
  created_at timestamp with time zone default now() not null,
  "position" integer not null,
  ui_width_px integer default 360 not null,
  ui_color_token text,
  student_write_enabled boolean default true not null
);

create table public.website_studio_published_snapshots (
  id uuid default gen_random_uuid() not null,
  owner_user_id uuid not null,
  source_local_id text not null,
  title text not null,
  slug text not null,
  status text default 'published'::text not null,
  snapshot_version integer default 1 not null,
  html text not null,
  css text not null,
  full_document text not null,
  safety_status text not null,
  safety_summary_json jsonb default '{}'::jsonb not null,
  template_id text default 'starter'::text not null,
  origin_board_id uuid,
  origin_source text,
  origin_day text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter sequence public.card_move_mutations_id_seq owned by public.card_move_mutations.id;

-- -----------------------------------------------------------------------------
-- Constraints and standalone indexes
-- -----------------------------------------------------------------------------
alter table only public.api_rate_limits add constraint api_rate_limits_pkey PRIMARY KEY (key, window_start);

alter table only public.audit_events add constraint audit_events_pkey PRIMARY KEY (id);

alter table only public.audit_logs add constraint audit_logs_pkey PRIMARY KEY (id);

alter table only public.audit_logs_daily_summary add constraint audit_logs_daily_summary_pkey PRIMARY KEY (log_day, action);

alter table only public.billing_events add constraint billing_events_pkey PRIMARY KEY (id);

alter table only public.board_controls add constraint board_controls_pkey PRIMARY KEY (board_id);

alter table only public.board_files add constraint board_files_pkey PRIMARY KEY (id);

alter table only public.board_invites add constraint board_invites_pkey PRIMARY KEY (token);

alter table only public.board_live_session add constraint board_live_session_pkey PRIMARY KEY (board_id);

alter table only public.board_members add constraint board_members_pkey PRIMARY KEY (board_id, user_id);

alter table only public.board_policies add constraint board_policies_pkey PRIMARY KEY (board_id);

alter table only public.board_polls add constraint board_polls_pkey PRIMARY KEY (id);

alter table only public.board_question_throttles add constraint board_question_throttles_pkey PRIMARY KEY (share_code, fingerprint);

alter table only public.board_questions add constraint board_questions_pkey PRIMARY KEY (id);

alter table only public.board_share_settings add constraint board_share_settings_pkey PRIMARY KEY (board_id);

alter table only public.board_view_presets add constraint board_view_presets_pkey PRIMARY KEY (id);

alter table only public.boards add constraint boards_pkey PRIMARY KEY (id);

alter table only public.card_files add constraint card_files_pkey PRIMARY KEY (id);

alter table only public.card_move_mutations add constraint card_move_mutations_pkey PRIMARY KEY (id);

alter table only public.card_tags add constraint card_tags_pkey PRIMARY KEY (card_id, tag_id);

alter table only public.cards add constraint cards_pkey PRIMARY KEY (id);

alter table only public.class_sections add constraint class_sections_pkey PRIMARY KEY (id);

alter table only public.class_session_bookmarks add constraint class_session_bookmarks_pkey PRIMARY KEY (id);

alter table only public.class_session_clip_shares add constraint class_session_clip_shares_pkey PRIMARY KEY (id);

alter table only public.class_session_controls add constraint class_session_controls_pkey PRIMARY KEY (session_id);

alter table only public.class_session_events add constraint class_session_events_pkey PRIMARY KEY (id);

alter table only public.class_session_questions add constraint class_session_questions_pkey PRIMARY KEY (id);

alter table only public.class_sessions add constraint class_sessions_pkey PRIMARY KEY (id);

alter table only public.class_showcase_items add constraint class_showcase_items_pkey PRIMARY KEY (id);

alter table only public.class_showcases add constraint class_showcases_pkey PRIMARY KEY (id);

alter table only public.classes add constraint classes_pkey PRIMARY KEY (id);

alter table only public.community_blocked_users add constraint community_blocked_users_pkey PRIMARY KEY (user_id);

alter table only public.community_comment_moderation add constraint community_comment_moderation_pkey PRIMARY KEY (comment_id);

alter table only public.community_comment_reports add constraint community_comment_reports_pkey PRIMARY KEY (id);

alter table only public.community_comments add constraint community_comments_pkey PRIMARY KEY (id);

alter table only public.community_moderators add constraint community_moderators_pkey PRIMARY KEY (user_id);

alter table only public.community_posts add constraint community_posts_pkey PRIMARY KEY (id);

alter table only public.community_reactions add constraint community_reactions_pkey PRIMARY KEY (post_id, user_id, reaction_type);

alter table only public.community_reports add constraint community_reports_pkey PRIMARY KEY (id);

alter table only public.community_reports_archive add constraint community_reports_archive_pkey PRIMARY KEY (id);

alter table only public.coupon_codes add constraint coupon_codes_pkey PRIMARY KEY (id);

alter table only public.coupon_redemptions add constraint coupon_redemptions_pkey PRIMARY KEY (id);

alter table only public.courseware_published_snapshots add constraint courseware_published_snapshots_pkey PRIMARY KEY (id);

alter table only public.decorate_plan_cache add constraint decorate_plan_cache_pkey PRIMARY KEY (key);

alter table only public.edu_assignments add constraint edu_assignments_pkey PRIMARY KEY (id);

alter table only public.edu_broadcasts add constraint edu_broadcasts_pkey PRIMARY KEY (board_id);

alter table only public.edu_classes add constraint edu_classes_pkey PRIMARY KEY (board_id);

alter table only public.edu_feature_flags add constraint edu_feature_flags_pkey PRIMARY KEY (user_id);

alter table only public.edu_featured_projects add constraint edu_featured_projects_pkey PRIMARY KEY (id);

alter table only public.edu_gallery add constraint edu_gallery_pkey PRIMARY KEY (id);

alter table only public.edu_join_codes add constraint edu_join_codes_pkey PRIMARY KEY (code);

alter table only public.edu_join_sessions add constraint edu_join_sessions_pkey PRIMARY KEY (token);

alter table only public.edu_lesson_attendance_daily add constraint edu_lesson_attendance_daily_pkey PRIMARY KEY (code_hash, lesson_key, day_bucket);

alter table only public.edu_lesson_completions_daily add constraint edu_lesson_completions_daily_pkey PRIMARY KEY (code_hash, lesson_key, day_bucket);

alter table only public.edu_participants add constraint edu_participants_pkey PRIMARY KEY (id);

alter table only public.edu_presentation_links add constraint edu_presentation_links_pkey PRIMARY KEY (board_id);

alter table only public.edu_presentation_settings add constraint edu_presentation_settings_pkey PRIMARY KEY (board_id);

alter table only public.edu_project_feedback add constraint edu_project_feedback_pkey PRIMARY KEY (slug);

alter table only public.edu_project_files add constraint edu_project_files_pkey PRIMARY KEY (project_id, path);

alter table only public.edu_project_stats add constraint edu_project_stats_pkey PRIMARY KEY (slug);

alter table only public.edu_project_visibility add constraint edu_project_visibility_pkey PRIMARY KEY (slug);

alter table only public.edu_projects add constraint edu_projects_pkey PRIMARY KEY (id);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_pkey PRIMARY KEY (attempt_id);

alter table only public.edu_publish_slug_reservations add constraint edu_publish_slug_reservations_pkey PRIMARY KEY (slug);

alter table only public.edu_reports add constraint edu_reports_pkey PRIMARY KEY (id);

alter table only public.edu_submissions add constraint edu_submissions_pkey PRIMARY KEY (id);

alter table only public.exhibit_versions add constraint exhibit_versions_pkey PRIMARY KEY (id);

alter table only public.exhibits add constraint exhibits_pkey PRIMARY KEY (id);

alter table only public.file_savings_events add constraint file_savings_events_pkey PRIMARY KEY (id);

alter table only public.files add constraint files_pkey PRIMARY KEY (id);

alter table only public.google_drive_preferences add constraint google_drive_preferences_pkey PRIMARY KEY (user_id, purpose);

alter table only public.institution_requests add constraint institution_requests_pkey PRIMARY KEY (id);

alter table only public.lesson_activity_runs add constraint lesson_activity_runs_pkey PRIMARY KEY (id);

alter table only public.license_keys add constraint license_keys_pkey PRIMARY KEY (id);

alter table only public.live_participants add constraint live_participants_pkey PRIMARY KEY (id);

alter table only public.metaverse_progress_snapshots add constraint metaverse_progress_snapshots_pkey PRIMARY KEY (user_id);

alter table only public.moderation_hides add constraint moderation_hides_pkey PRIMARY KEY (target_type, target_id);

alter table only public.ops_banners add constraint ops_banners_pkey PRIMARY KEY (id);

alter table only public.ops_events add constraint ops_events_pkey PRIMARY KEY (id);

alter table only public.ops_reports_backlog_runs add constraint ops_reports_backlog_runs_pkey PRIMARY KEY (id);

alter table only public.ops_retention_config add constraint ops_retention_config_pkey PRIMARY KEY (id);

alter table only public.ops_retention_runs add constraint ops_retention_runs_pkey PRIMARY KEY (id);

alter table only public.ops_user_assistant_runs add constraint ops_user_assistant_runs_pkey PRIMARY KEY (id);

alter table only public.ownership_requests add constraint ownership_requests_pkey PRIMARY KEY (id);

alter table only public.poll_responses add constraint poll_responses_pkey PRIMARY KEY (poll_id, fingerprint);

alter table only public.pro_waitlist add constraint pro_waitlist_pkey PRIMARY KEY (id);

alter table only public.public_showcase_snapshots add constraint public_showcase_snapshots_pkey PRIMARY KEY (token_hash);

alter table only public.public_showcase_tokens add constraint public_showcase_tokens_pkey PRIMARY KEY (token_hash);

alter table only public.publish_events add constraint publish_events_pkey PRIMARY KEY (id);

alter table only public.pulse_events add constraint pulse_events_pkey PRIMARY KEY (share_code, fingerprint);

alter table only public.rate_limit_counters add constraint rate_limit_counters_pkey PRIMARY KEY (key);

alter table only public.rate_limits add constraint rate_limits_pkey PRIMARY KEY (key);

alter table only public.reports add constraint reports_pkey PRIMARY KEY (id);

alter table only public.session_report_shares add constraint session_report_shares_pkey PRIMARY KEY (token);

alter table only public.showcase_tokens add constraint showcase_tokens_pkey PRIMARY KEY (token);

alter table only public.showcases add constraint showcases_pkey PRIMARY KEY (id);

alter table only public.site_content add constraint site_content_pkey PRIMARY KEY (key);

alter table only public.site_content_revisions add constraint site_content_revisions_pkey PRIMARY KEY (id);

alter table only public.storage_objects add constraint storage_objects_pkey PRIMARY KEY (id);

alter table only public.storage_quota add constraint storage_quota_pkey PRIMARY KEY (owner_id);

alter table only public.storage_usage add constraint storage_usage_pkey PRIMARY KEY (user_id);

alter table only public.storage_usage_daily add constraint storage_usage_daily_pkey PRIMARY KEY (id);

alter table only public.student_activity_states add constraint student_activity_states_pkey PRIMARY KEY (id);

alter table only public.student_app_class_sessions add constraint student_app_class_sessions_pkey PRIMARY KEY (id);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_pkey PRIMARY KEY (id);

alter table only public.student_app_deployments add constraint student_app_deployments_pkey PRIMARY KEY (id);

alter table only public.student_app_submission_files add constraint student_app_submission_files_pkey PRIMARY KEY (id);

alter table only public.student_app_submissions add constraint student_app_submissions_pkey PRIMARY KEY (id);

alter table only public.student_requests add constraint student_requests_pkey PRIMARY KEY (id);

alter table only public.tag_rules add constraint tag_rules_pkey PRIMARY KEY (id);

alter table only public.tags add constraint tags_pkey PRIMARY KEY (id);

alter table only public.template_collection_items add constraint template_collection_items_pkey PRIMARY KEY (id);

alter table only public.template_collections add constraint template_collections_pkey PRIMARY KEY (id);

alter table only public.template_library_installs add constraint template_library_installs_pkey PRIMARY KEY (id);

alter table only public.template_library_items add constraint template_library_items_pkey PRIMARY KEY (id);

alter table only public.template_library_likes add constraint template_library_likes_pkey PRIMARY KEY (template_id, user_id);

alter table only public.template_library_reports add constraint template_library_reports_pkey PRIMARY KEY (id);

alter table only public.template_library_reviews add constraint template_library_reviews_pkey PRIMARY KEY (id);

alter table only public.template_reports add constraint template_reports_pkey PRIMARY KEY (report_id);

alter table only public.template_versions add constraint template_versions_pkey PRIMARY KEY (id);

alter table only public.templates add constraint templates_pkey PRIMARY KEY (template_id);

alter table only public.upgrade_requests add constraint upgrade_requests_pkey PRIMARY KEY (request_id);

alter table only public.user_entitlements add constraint user_entitlements_pkey PRIMARY KEY (user_id);

alter table only public.user_onboarding add constraint user_onboarding_pkey PRIMARY KEY (user_id);

alter table only public.user_plans add constraint user_plans_pkey PRIMARY KEY (user_id);

alter table only public.user_ui_prefs add constraint user_ui_prefs_pkey PRIMARY KEY (user_id);

alter table only public.wall_cards_v2 add constraint wall_cards_v2_pkey PRIMARY KEY (id);

alter table only public.wall_sections_v2 add constraint wall_sections_v2_pkey PRIMARY KEY (id);

alter table only public.walls add constraint walls_pkey PRIMARY KEY (id);

alter table only public.website_studio_published_snapshots add constraint website_studio_published_snapshots_pkey PRIMARY KEY (id);

alter table only public.board_files add constraint board_files_r2_key_key UNIQUE (r2_key);

alter table only public.board_invites add constraint board_invites_board_id_invited_email_key UNIQUE (board_id, invited_email);

alter table only public.board_view_presets add constraint board_view_presets_user_id_board_id_name_key UNIQUE (user_id, board_id, name);

alter table only public.card_move_mutations add constraint card_move_mutations_scope_actor_id_client_mutation_id_key UNIQUE (scope, actor_id, client_mutation_id);

alter table only public.class_session_clip_shares add constraint class_session_clip_shares_token_key UNIQUE (token);

alter table only public.classes add constraint classes_short_code_key UNIQUE (short_code);

alter table only public.coupon_codes add constraint coupon_codes_code_sha256_key UNIQUE (code_sha256);

alter table only public.coupon_redemptions add constraint coupon_redemptions_coupon_id_user_id_key UNIQUE (coupon_id, user_id);

alter table only public.courseware_published_snapshots add constraint courseware_published_snapshots_share_id_key UNIQUE (share_id);

alter table only public.edu_classes add constraint edu_classes_share_code_key UNIQUE (share_code);

alter table only public.edu_featured_projects add constraint edu_featured_projects_board_id_slug_key UNIQUE (board_id, slug);

alter table only public.edu_gallery add constraint edu_gallery_view_id_key UNIQUE (view_id);

alter table only public.edu_participants add constraint edu_participants_share_code_anon_id_key UNIQUE (share_code, anon_id);

alter table only public.edu_presentation_links add constraint edu_presentation_links_code_key UNIQUE (code);

alter table only public.edu_projects add constraint edu_projects_slug_key UNIQUE (slug);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_slug_key UNIQUE (slug);

alter table only public.edu_submissions add constraint edu_submissions_assignment_id_slug_key UNIQUE (assignment_id, slug);

alter table only public.exhibits add constraint exhibits_token_key UNIQUE (token);

alter table only public.license_keys add constraint license_keys_code_sha256_key UNIQUE (code_sha256);

alter table only public.pro_waitlist add constraint pro_waitlist_user_id_key UNIQUE (user_id);

alter table only public.storage_objects add constraint storage_objects_r2_key_key UNIQUE (r2_key);

alter table only public.storage_usage_daily add constraint storage_usage_daily_owner_id_day_key UNIQUE (owner_id, day);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_deployment_path_unique UNIQUE (deployment_id, path);

alter table only public.student_app_submission_files add constraint student_app_submission_files_submission_id_path_key UNIQUE (submission_id, path);

alter table only public.template_collections add constraint template_collections_slug_key UNIQUE (slug);

alter table only public.template_library_installs add constraint template_library_installs_template_id_user_id_key UNIQUE (template_id, user_id);

alter table only public.template_library_reports add constraint template_library_reports_template_id_reporter_id_key UNIQUE (template_id, reporter_id);

alter table only public.template_library_reviews add constraint template_library_reviews_template_id_user_id_key UNIQUE (template_id, user_id);

alter table only public.website_studio_published_snapshots add constraint website_studio_published_snapshots_slug_key UNIQUE (slug);

alter table only public.audit_logs add constraint audit_logs_actor_role_check CHECK (actor_role = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text]));

alter table only public.billing_events add constraint billing_events_status_check CHECK (status = ANY (ARRAY['received'::text, 'processed'::text, 'ignored'::text, 'failed'::text]));

alter table only public.board_invites add constraint board_invites_role_check CHECK (role = ANY (ARRAY['viewer'::text, 'editor'::text]));

alter table only public.board_members add constraint board_members_role_check CHECK (role = ANY (ARRAY['viewer'::text, 'editor'::text]));

alter table only public.board_share_settings add constraint board_share_settings_student_default_view_check CHECK (student_default_view = ANY (ARRAY['feed'::text, 'walls'::text, 'grid'::text]));

alter table only public.boards add constraint boards_board_view_type_check CHECK (board_view_type = ANY (ARRAY['grid'::text, 'wall'::text, 'mindmap'::text, 'gen'::text]));

alter table only public.boards add constraint boards_class_state_check CHECK (class_state = ANY (ARRAY['idle'::text, 'live'::text, 'ended'::text]));

alter table only public.boards add constraint boards_share_code_charset_check CHECK (share_code IS NULL OR share_code ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{6}$'::text) NOT VALID;

alter table only public.boards add constraint boards_ui_minimap_mode_check CHECK (ui_minimap_mode = ANY (ARRAY['hover'::text, 'toggle'::text, 'always'::text, 'hidden'::text]));

alter table only public.card_move_mutations add constraint card_move_mutations_scope_check CHECK (scope = ANY (ARRAY['dashboard'::text, 'share'::text]));

alter table only public.cards add constraint cards_author_type_check CHECK (author_type = ANY (ARRAY['teacher'::text, 'student'::text]));

alter table only public.cards add constraint cards_color_token_check CHECK (card_color_token IS NULL OR (card_color_token = ANY (ARRAY['default'::text, 'gray'::text, 'yellow'::text, 'pink'::text, 'green'::text, 'purple'::text, 'sky'::text, 'orange'::text])));

alter table only public.class_session_clip_shares add constraint class_session_clip_shares_mode_check CHECK (mode = ANY (ARRAY['safe'::text, 'full'::text]));

alter table only public.class_session_questions add constraint class_session_questions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'hidden'::text]));

alter table only public.class_showcase_items add constraint class_showcase_items_kind_check CHECK (kind = ANY (ARRAY['clip'::text, 'highlight'::text, 'note'::text, 'image'::text]));

alter table only public.community_blocked_users add constraint community_blocked_users_reason_check CHECK (char_length(reason) >= 3 AND char_length(reason) <= 200);

alter table only public.community_comments add constraint community_comments_body_check CHECK (char_length(body) >= 1 AND char_length(body) <= 2000);

alter table only public.community_comments add constraint community_comments_status_check CHECK (status = ANY (ARRAY['active'::text, 'hidden'::text, 'spam'::text]));

alter table only public.community_posts add constraint community_posts_body_check CHECK (char_length(body) >= 1 AND char_length(body) <= 4000);

alter table only public.community_posts add constraint community_posts_category_check CHECK (category = ANY (ARRAY['free'::text, 'edu'::text, 'qna'::text, 'usage'::text, 'updates'::text]));

alter table only public.community_posts add constraint community_posts_status_check CHECK (status = ANY (ARRAY['active'::text, 'hidden'::text, 'spam'::text]));

alter table only public.community_posts add constraint community_posts_title_check CHECK (char_length(title) >= 3 AND char_length(title) <= 140);

alter table only public.community_reactions add constraint community_reactions_reaction_type_check CHECK (reaction_type = 'like'::text);

alter table only public.community_reports add constraint community_reports_reason_check CHECK (char_length(reason) >= 5 AND char_length(reason) <= 500);

alter table only public.community_reports add constraint community_reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text]));

alter table only public.community_reports add constraint community_reports_target_type_check CHECK (target_type = ANY (ARRAY['post'::text, 'comment'::text]));

alter table only public.edu_assignments add constraint edu_assignments_lesson_id_check CHECK (lesson_id >= 1 AND lesson_id <= 4);

alter table only public.edu_feature_flags add constraint edu_feature_flags_max_bytes_check CHECK (max_bytes > 0);

alter table only public.edu_feature_flags add constraint edu_feature_flags_netsaver_mode_check CHECK (netsaver_mode = ANY (ARRAY['lease_only'::text, 'auto'::text]));

alter table only public.edu_feature_flags add constraint edu_feature_flags_netsaver_p2p_tier_check CHECK (netsaver_p2p_tier = ANY (ARRAY['meta'::text, 'small_shards'::text, 'wasm'::text]));

alter table only public.edu_presentation_settings add constraint edu_presentation_settings_interval_check CHECK (interval_sec_default = ANY (ARRAY[10, 20, 30, 60]));

alter table only public.edu_presentation_settings add constraint edu_presentation_settings_start_mode_check CHECK (start_mode = ANY (ARRAY['auto'::text, 'selected'::text]));

alter table only public.edu_projects add constraint edu_projects_lesson_id_check CHECK (lesson_id >= 1 AND lesson_id <= 4);

alter table only public.edu_projects add constraint edu_projects_publish_state_check CHECK (publish_state = ANY (ARRAY['DRAFT'::text, 'VALIDATING'::text, 'PUBLISHING'::text, 'PUBLISHED'::text, 'FAILED'::text]));

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_capability_metadata_check CHECK (capability_issued_at IS NULL AND capability_expires_at IS NULL AND capability_kid IS NULL OR capability_issued_at IS NOT NULL AND capability_expires_at IS NOT NULL AND capability_kid IS NOT NULL AND capability_expires_at > capability_issued_at AND capability_expires_at <= expires_at AND capability_kid ~ '^[A-Za-z0-9._-]{1,32}$'::text);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_commit_count_check CHECK (commit_count >= 0);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_declared_digest_check CHECK (declared_manifest_digest ~ '^[0-9a-f]{64}$'::text);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_failure_code_check CHECK (failure_code IS NULL OR (failure_code = ANY (ARRAY['R2_TEMPORARY_FAILURE'::text, 'DB_TEMPORARY_FAILURE'::text, 'RPC_TEMPORARY_FAILURE'::text, 'INTERNAL_EVALUATION_FAILED'::text, 'R2_OBJECT_MISSING'::text, 'R2_SIZE_MISMATCH'::text, 'R2_DIGEST_MISMATCH'::text, 'ATTEMPT_EXPIRED'::text, 'SLUG_CONFLICT'::text])));

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_lesson_id_check CHECK (lesson_id >= 1 AND lesson_id <= 4);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_lineage_check CHECK (parent_attempt_id IS NULL AND root_attempt_id = attempt_id OR parent_attempt_id IS NOT NULL AND parent_attempt_id <> attempt_id AND root_attempt_id <> attempt_id);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_manifest_schema_check CHECK (manifest_schema_version = 1);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_manifest_shape_check CHECK (jsonb_typeof(declared_manifest) = 'object'::text AND (declared_manifest ->> 'schemaVersion'::text) = '1'::text AND (declared_manifest ->> 'entryPoint'::text) = 'index.html'::text AND jsonb_typeof(declared_manifest -> 'files'::text) = 'array'::text);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_retry_count_check CHECK (retry_count >= 0 AND retry_count <= 3);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_state_check CHECK (state = ANY (ARRAY['PREPARED'::text, 'VALIDATING'::text, 'PUBLISHED'::text, 'FAILED_RETRYABLE'::text, 'FAILED_RESTART_REQUIRED'::text, 'ABANDONED'::text]));

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_state_shape_check CHECK (state = 'PREPARED'::text AND project_id IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL AND validation_started_at IS NULL AND published_at IS NULL AND failed_at IS NULL AND verified_manifest_digest IS NULL AND failure_code IS NULL OR state = 'VALIDATING'::text AND project_id IS NULL AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL AND validation_started_at IS NOT NULL AND published_at IS NULL AND failed_at IS NULL AND verified_manifest_digest IS NULL AND failure_code IS NULL OR state = 'PUBLISHED'::text AND project_id IS NOT NULL AND lease_owner IS NULL AND lease_expires_at IS NULL AND validation_started_at IS NOT NULL AND published_at IS NOT NULL AND failed_at IS NULL AND verified_manifest_digest IS NOT NULL AND failure_code IS NULL OR state = 'FAILED_RETRYABLE'::text AND project_id IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL AND validation_started_at IS NOT NULL AND published_at IS NULL AND failed_at IS NOT NULL AND verified_manifest_digest IS NULL AND (failure_code = ANY (ARRAY['R2_TEMPORARY_FAILURE'::text, 'DB_TEMPORARY_FAILURE'::text, 'RPC_TEMPORARY_FAILURE'::text, 'INTERNAL_EVALUATION_FAILED'::text])) OR state = 'FAILED_RESTART_REQUIRED'::text AND project_id IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL AND validation_started_at IS NOT NULL AND published_at IS NULL AND failed_at IS NOT NULL AND verified_manifest_digest IS NULL AND (failure_code = ANY (ARRAY['R2_OBJECT_MISSING'::text, 'R2_SIZE_MISMATCH'::text, 'R2_DIGEST_MISMATCH'::text, 'ATTEMPT_EXPIRED'::text, 'SLUG_CONFLICT'::text])) OR state = 'ABANDONED'::text AND project_id IS NULL AND lease_owner IS NULL AND lease_expires_at IS NULL AND published_at IS NULL AND failed_at IS NOT NULL AND verified_manifest_digest IS NULL AND failure_code = 'ATTEMPT_EXPIRED'::text);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_time_check CHECK (expires_at > prepared_at AND prepared_at >= created_at AND created_at <= updated_at AND (validation_started_at IS NULL OR validation_started_at >= prepared_at) AND (lease_expires_at IS NULL OR validation_started_at IS NOT NULL AND lease_expires_at > validation_started_at) AND (published_at IS NULL OR validation_started_at IS NOT NULL AND published_at >= validation_started_at) AND (failed_at IS NULL OR failed_at >= prepared_at));

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_verified_digest_check CHECK (verified_manifest_digest IS NULL OR verified_manifest_digest ~ '^[0-9a-f]{64}$'::text);

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_version_check CHECK (attempt_version >= 0);

alter table only public.edu_publish_slug_reservations add constraint edu_publish_slug_reservations_ownership_check CHECK (reservation_state = 'LEGACY_PROJECT'::text AND attempt_id IS NULL AND project_id IS NOT NULL AND converted_at IS NULL OR reservation_state = 'ATTEMPT_RESERVED'::text AND attempt_id IS NOT NULL AND project_id IS NULL AND converted_at IS NULL OR reservation_state = 'PROJECT_PUBLISHED'::text AND attempt_id IS NOT NULL AND project_id IS NOT NULL AND converted_at IS NOT NULL OR reservation_state = 'TOMBSTONED'::text AND attempt_id IS NULL AND project_id IS NULL);

alter table only public.edu_publish_slug_reservations add constraint edu_publish_slug_reservations_slug_format_check CHECK (length(slug) >= 1 AND length(slug) <= 64 AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text);

alter table only public.edu_publish_slug_reservations add constraint edu_publish_slug_reservations_state_check CHECK (reservation_state = ANY (ARRAY['LEGACY_PROJECT'::text, 'ATTEMPT_RESERVED'::text, 'PROJECT_PUBLISHED'::text, 'TOMBSTONED'::text]));

alter table only public.edu_publish_slug_reservations add constraint edu_publish_slug_reservations_time_check CHECK (reserved_at <= updated_at AND created_at <= updated_at AND (converted_at IS NULL OR converted_at >= reserved_at));

alter table only public.exhibits add constraint exhibits_mode_check CHECK (mode = 'safe'::text);

alter table only public.exhibits add constraint exhibits_status_check CHECK (status = ANY (ARRAY['active'::text, 'hidden'::text, 'revoked'::text]));

alter table only public.google_drive_preferences add constraint google_drive_preferences_purpose_check CHECK (purpose = ANY (ARRAY['student-records'::text, 'student-gallery'::text, 'board-backup'::text]));

alter table only public.lesson_activity_runs add constraint lesson_activity_runs_status_check CHECK (status = ANY (ARRAY['active'::text, 'ended'::text]));

alter table only public.license_keys add constraint license_keys_plan_check CHECK (plan = ANY (ARRAY['free'::text, 'pro'::text]));

alter table only public.ops_reports_backlog_runs add constraint ops_reports_backlog_runs_status_check CHECK (status = ANY (ARRAY['previewed'::text, 'executed'::text, 'expired'::text]));

alter table only public.ops_reports_backlog_runs add constraint ops_reports_backlog_runs_would_count_check CHECK (would_count >= 0);

alter table only public.ops_retention_config add constraint ops_retention_config_audit_logs_ttl_days_check CHECK (audit_logs_ttl_days >= 30 AND audit_logs_ttl_days <= 730);

alter table only public.ops_retention_config add constraint ops_retention_config_community_reports_resolved_ttl_days_check CHECK (community_reports_resolved_ttl_days >= 14 AND community_reports_resolved_ttl_days <= 365);

alter table only public.ops_retention_config add constraint ops_retention_config_id_check CHECK (id = true);

alter table only public.ops_retention_config add constraint ops_retention_config_rate_limit_counters_grace_days_check CHECK (rate_limit_counters_grace_days >= 1 AND rate_limit_counters_grace_days <= 14);

alter table only public.ops_retention_config add constraint ops_retention_config_rate_limits_ttl_days_check CHECK (rate_limits_ttl_days >= 1 AND rate_limits_ttl_days <= 60);

alter table only public.ops_retention_config add constraint ops_retention_config_run_every_hours_check CHECK (run_every_hours >= 1 AND run_every_hours <= 168);

alter table only public.ops_user_assistant_runs add constraint ops_user_assistant_runs_status_check CHECK (status = ANY (ARRAY['previewed'::text, 'executed'::text, 'expired'::text, 'failed'::text]));

alter table only public.ownership_requests add constraint ownership_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

alter table only public.showcases add constraint showcases_mode_check CHECK (mode = 'safe'::text);

alter table only public.site_content add constraint site_content_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text]));

alter table only public.site_content_revisions add constraint site_content_revisions_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'rollback'::text]));

alter table only public.student_activity_states add constraint student_activity_states_status_check CHECK (status = ANY (ARRAY['in_progress'::text, 'completed'::text]));

alter table only public.student_app_class_sessions add constraint student_app_class_sessions_publish_mode_check CHECK (publish_mode = ANY (ARRAY['teacher_review'::text, 'auto_publish'::text]));

alter table only public.student_app_class_sessions add constraint student_app_class_sessions_status_check CHECK (status = ANY (ARRAY['active'::text, 'ended'::text]));

alter table only public.student_app_class_sessions add constraint student_app_class_sessions_window_check CHECK (ends_at > starts_at);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_path_backslash_check CHECK (POSITION(('\\'::text) IN (path)) = 0);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_path_not_blank CHECK (length(TRIM(BOTH FROM path)) > 0);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_path_relative_check CHECK (path !~ '^/'::text);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_path_traversal_check CHECK (POSITION(('..'::text) IN (path)) = 0);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_r2_key_check CHECK (r2_key ~~ 'student-apps/%'::text);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_sha256_check CHECK (sha256 ~ '^[a-f0-9]{64}$'::text);

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_size_check CHECK (size_bytes >= 0);

alter table only public.student_app_deployments add constraint student_app_deployments_entry_file_check CHECK (entry_file = 'index.html'::text);

alter table only public.student_app_deployments add constraint student_app_deployments_file_count_check CHECK (file_count >= 0 AND file_count <= 100);

alter table only public.student_app_deployments add constraint student_app_deployments_r2_prefix_check CHECK (r2_prefix ~~ 'student-apps/%'::text);

alter table only public.student_app_deployments add constraint student_app_deployments_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'::text);

alter table only public.student_app_deployments add constraint student_app_deployments_source_check CHECK (source = ANY (ARRAY['manual_files'::text, 'zip_upload'::text, 'external_link_capture'::text]));

alter table only public.student_app_deployments add constraint student_app_deployments_status_check CHECK (status = ANY (ARRAY['draft'::text, 'validated'::text, 'stored'::text, 'approved'::text, 'published'::text, 'blocked'::text, 'archived'::text]));

alter table only public.student_app_deployments add constraint student_app_deployments_title_not_blank CHECK (length(TRIM(BOTH FROM title)) > 0);

alter table only public.student_app_deployments add constraint student_app_deployments_total_size_check CHECK (total_size_bytes >= 0 AND total_size_bytes <= 10485760);

alter table only public.student_app_deployments add constraint student_app_deployments_version_check CHECK (version >= 1);

alter table only public.student_app_submission_files add constraint student_app_submission_files_path_no_backslash CHECK (POSITION(('\\'::text) IN (path)) = 0);

alter table only public.student_app_submission_files add constraint student_app_submission_files_path_no_traversal CHECK (POSITION(('..'::text) IN (path)) = 0);

alter table only public.student_app_submission_files add constraint student_app_submission_files_path_nonempty CHECK (length(TRIM(BOTH FROM path)) > 0);

alter table only public.student_app_submission_files add constraint student_app_submission_files_path_relative CHECK (path !~ '^/'::text);

alter table only public.student_app_submission_files add constraint student_app_submission_files_r2_key_private_prefix CHECK (r2_key ~~ 'student-apps/submissions/private/%'::text);

alter table only public.student_app_submission_files add constraint student_app_submission_files_sha256_hex CHECK (sha256 ~ '^[a-f0-9]{64}$'::text);

alter table only public.student_app_submission_files add constraint student_app_submission_files_size_nonnegative CHECK (size_bytes >= 0);

alter table only public.student_app_submissions add constraint student_app_submissions_app_key_check CHECK (app_key IS NULL OR length(app_key) >= 1 AND length(app_key) <= 120);

alter table only public.student_app_submissions add constraint student_app_submissions_author_client_id_check CHECK (author_client_id IS NULL OR length(author_client_id) >= 8 AND length(author_client_id) <= 128);

alter table only public.student_app_submissions add constraint student_app_submissions_r2_prefix_private_prefix CHECK (r2_prefix IS NULL OR r2_prefix ~~ 'student-apps/submissions/private/%'::text);

alter table only public.student_app_submissions add constraint student_app_submissions_source_check CHECK (source = 'manual_files'::text);

alter table only public.student_app_submissions add constraint student_app_submissions_status_check CHECK (status = ANY (ARRAY['submitted'::text, 'needs_fix'::text, 'accepted'::text, 'archived'::text]));

alter table only public.student_app_submissions add constraint student_app_submissions_title_nonempty CHECK (length(TRIM(BOTH FROM title)) > 0);

alter table only public.student_app_submissions add constraint student_app_submissions_version_check CHECK (version >= 1);

alter table only public.tag_rules add constraint tag_rules_match_type CHECK (match_type = ANY (ARRAY['contains'::text, 'prefix'::text, 'regex'::text]));

alter table only public.tag_rules add constraint tag_rules_pattern_length CHECK (char_length(TRIM(BOTH FROM pattern)) >= 1 AND char_length(TRIM(BOTH FROM pattern)) <= 80);

alter table only public.tags add constraint tags_name_length CHECK (char_length(TRIM(BOTH FROM name)) >= 1 AND char_length(TRIM(BOTH FROM name)) <= 32);

alter table only public.template_collections add constraint template_collections_kind_check CHECK (kind = ANY (ARRAY['picks'::text, 'pro_pack'::text]));

alter table only public.template_collections add constraint template_collections_tier_check CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text]));

alter table only public.template_collections add constraint template_collections_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'hidden'::text]));

alter table only public.template_library_items add constraint template_library_items_grade_band_check CHECK (grade_band = ANY (ARRAY['ELEM'::text, 'MID'::text, 'ANY'::text]));

alter table only public.template_library_items add constraint template_library_items_scope_check CHECK (scope = ANY (ARRAY['private'::text, 'community'::text]));

alter table only public.template_library_items add constraint template_library_items_status_check CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'hidden'::text]));

alter table only public.template_library_reports add constraint template_library_reports_reason_check CHECK (reason = ANY (ARRAY['spam'::text, 'unsafe'::text, 'copyright'::text, 'other'::text]));

alter table only public.template_library_reviews add constraint template_library_reviews_comment_check CHECK (char_length(comment) <= 280);

alter table only public.template_library_reviews add constraint template_library_reviews_rating_check CHECK (rating >= 1 AND rating <= 5);

alter table only public.templates add constraint templates_grade_band_check CHECK (grade_band = ANY (ARRAY['elem'::text, 'middle'::text, 'mixed'::text]));

alter table only public.templates add constraint templates_source_check CHECK (source = ANY (ARRAY['community'::text, 'official'::text]));

alter table only public.templates add constraint templates_status_check CHECK (status = ANY (ARRAY['active'::text, 'hidden'::text, 'removed'::text]));

alter table only public.templates add constraint templates_tier_check CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text]));

alter table only public.templates add constraint templates_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'hidden'::text]));

alter table only public.upgrade_requests add constraint upgrade_requests_status_check CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'approved'::text, 'rejected'::text]));

alter table only public.user_entitlements add constraint user_entitlements_billing_status_check CHECK (billing_status = ANY (ARRAY['free'::text, 'trial'::text, 'active'::text, 'past_due'::text, 'canceled'::text]));

alter table only public.user_entitlements add constraint user_entitlements_plan_check CHECK (plan = ANY (ARRAY['free'::text, 'pro'::text]));

alter table only public.user_entitlements add constraint user_entitlements_provider_check CHECK (provider = ANY (ARRAY['none'::text, 'stripe'::text]));

alter table only public.user_plans add constraint user_plans_plan_check CHECK (plan = ANY (ARRAY['free'::text, 'pro'::text]));

alter table only public.user_plans add constraint user_plans_source_check CHECK (source = ANY (ARRAY['manual'::text, 'promo'::text, 'purchase'::text]));

alter table only public.user_ui_prefs add constraint user_ui_prefs_default_minimap_mode_check CHECK (default_minimap_mode = ANY (ARRAY['hover'::text, 'toggle'::text, 'always'::text, 'hidden'::text]));

alter table only public.user_ui_prefs add constraint user_ui_prefs_default_wall_width_px_min CHECK (default_wall_width_px >= 360);

alter table only public.walls add constraint walls_ui_width_px_min CHECK (ui_width_px >= 360);

alter table only public.website_studio_published_snapshots add constraint website_studio_published_snapshots_status_check CHECK (status = ANY (ARRAY['published'::text, 'unpublished'::text]));

alter table only public.audit_logs add constraint audit_logs_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_controls add constraint board_controls_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_controls add constraint board_controls_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES auth.users(id);

alter table only public.board_files add constraint board_files_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_files add constraint board_files_file_id_fkey FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL;

alter table only public.board_invites add constraint board_invites_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_members add constraint board_members_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_members add constraint board_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.board_policies add constraint board_policies_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_share_settings add constraint board_share_settings_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_view_presets add constraint board_view_presets_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.board_view_presets add constraint board_view_presets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table only public.boards add constraint boards_active_session_id_fkey FOREIGN KEY (active_session_id) REFERENCES class_sessions(id);

alter table only public.boards add constraint boards_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

alter table only public.boards add constraint boards_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table only public.card_files add constraint card_files_board_file_id_fkey FOREIGN KEY (board_file_id) REFERENCES board_files(id) ON DELETE CASCADE;

alter table only public.card_files add constraint card_files_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_move_mutations add constraint card_move_mutations_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.card_move_mutations add constraint card_move_mutations_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_move_mutations add constraint card_move_mutations_target_wall_id_fkey FOREIGN KEY (target_wall_id) REFERENCES walls(id) ON DELETE CASCADE;

alter table only public.card_tags add constraint card_tags_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.card_tags add constraint card_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

alter table only public.cards add constraint cards_wall_id_fkey FOREIGN KEY (wall_id) REFERENCES walls(id) ON DELETE CASCADE;

alter table only public.class_sections add constraint class_sections_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table only public.class_session_bookmarks add constraint class_session_bookmarks_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.class_session_bookmarks add constraint class_session_bookmarks_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.class_session_clip_shares add constraint class_session_clip_shares_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.class_session_controls add constraint class_session_controls_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.class_session_events add constraint class_session_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.class_session_questions add constraint class_session_questions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);

alter table only public.class_session_questions add constraint class_session_questions_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.class_sessions add constraint class_sessions_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.class_sessions add constraint class_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table only public.class_sessions add constraint class_sessions_section_id_fkey FOREIGN KEY (section_id) REFERENCES class_sections(id) ON DELETE SET NULL;

alter table only public.class_showcase_items add constraint class_showcase_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table only public.class_showcase_items add constraint class_showcase_items_showcase_id_fkey FOREIGN KEY (showcase_id) REFERENCES class_showcases(id) ON DELETE CASCADE;

alter table only public.class_showcases add constraint class_showcases_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table only public.class_showcases add constraint class_showcases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table only public.class_showcases add constraint class_showcases_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.classes add constraint classes_active_board_id_fkey FOREIGN KEY (active_board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table only public.classes add constraint classes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table only public.community_blocked_users add constraint community_blocked_users_blocked_by_user_id_fkey FOREIGN KEY (blocked_by_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_blocked_users add constraint community_blocked_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_comment_moderation add constraint community_comment_moderation_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE;

alter table only public.community_comment_reports add constraint community_comment_reports_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE;

alter table only public.community_comment_reports add constraint community_comment_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_comments add constraint community_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_comments add constraint community_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE;

alter table only public.community_moderators add constraint community_moderators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_posts add constraint community_posts_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_reactions add constraint community_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE;

alter table only public.community_reactions add constraint community_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_reports add constraint community_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.community_reports add constraint community_reports_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.coupon_redemptions add constraint coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupon_codes(id) ON DELETE CASCADE;

alter table only public.decorate_plan_cache add constraint decorate_plan_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.edu_classes add constraint edu_classes_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.edu_feature_flags add constraint edu_feature_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.edu_featured_projects add constraint edu_featured_projects_slug_fkey FOREIGN KEY (slug) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_gallery add constraint edu_gallery_view_id_fkey FOREIGN KEY (view_id) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_join_codes add constraint edu_join_codes_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.edu_project_feedback add constraint edu_project_feedback_slug_fkey FOREIGN KEY (slug) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_project_files add constraint edu_project_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES edu_projects(id) ON DELETE CASCADE;

alter table only public.edu_project_stats add constraint edu_project_stats_slug_fkey FOREIGN KEY (slug) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_project_visibility add constraint edu_project_visibility_slug_fkey FOREIGN KEY (slug) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_parent_attempt_id_fkey FOREIGN KEY (parent_attempt_id) REFERENCES edu_publish_attempts(attempt_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_project_id_fkey FOREIGN KEY (project_id) REFERENCES edu_projects(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_root_attempt_id_fkey FOREIGN KEY (root_attempt_id) REFERENCES edu_publish_attempts(attempt_id) ON UPDATE RESTRICT ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

alter table only public.edu_publish_attempts add constraint edu_publish_attempts_slug_fkey FOREIGN KEY (slug) REFERENCES edu_publish_slug_reservations(slug) ON UPDATE RESTRICT ON DELETE RESTRICT;

alter table only public.edu_reports add constraint edu_reports_slug_fkey FOREIGN KEY (slug) REFERENCES edu_projects(slug) ON DELETE CASCADE;

alter table only public.edu_submissions add constraint edu_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES edu_assignments(id) ON DELETE CASCADE;

alter table only public.exhibit_versions add constraint exhibit_versions_exhibit_id_fkey FOREIGN KEY (exhibit_id) REFERENCES exhibits(id) ON DELETE CASCADE;

alter table only public.exhibits add constraint exhibits_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.exhibits add constraint exhibits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table only public.files add constraint files_card_id_fkey FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

alter table only public.google_drive_preferences add constraint google_drive_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.institution_requests add constraint institution_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES auth.users(id);

alter table only public.lesson_activity_runs add constraint lesson_activity_runs_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.lesson_activity_runs add constraint lesson_activity_runs_class_session_id_fkey FOREIGN KEY (class_session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.lesson_activity_runs add constraint lesson_activity_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.license_keys add constraint license_keys_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);

alter table only public.metaverse_progress_snapshots add constraint metaverse_progress_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.ops_reports_backlog_runs add constraint ops_reports_backlog_runs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table only public.ops_user_assistant_runs add constraint ops_user_assistant_runs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table only public.ops_user_assistant_runs add constraint ops_user_assistant_runs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

alter table only public.ownership_requests add constraint ownership_requests_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.pro_waitlist add constraint pro_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.public_showcase_snapshots add constraint public_showcase_snapshots_token_hash_fkey FOREIGN KEY (token_hash) REFERENCES public_showcase_tokens(token_hash) ON DELETE CASCADE;

alter table only public.public_showcase_tokens add constraint public_showcase_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

alter table only public.public_showcase_tokens add constraint public_showcase_tokens_showcase_id_fkey FOREIGN KEY (showcase_id) REFERENCES class_showcases(id) ON DELETE CASCADE;

alter table only public.publish_events add constraint publish_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES edu_projects(id) ON DELETE CASCADE;

alter table only public.reports add constraint reports_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.session_report_shares add constraint session_report_shares_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE;

alter table only public.showcase_tokens add constraint showcase_tokens_showcase_id_fkey FOREIGN KEY (showcase_id) REFERENCES showcases(id) ON DELETE CASCADE;

alter table only public.showcases add constraint showcases_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.showcases add constraint showcases_owner_user_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table only public.storage_objects add constraint storage_objects_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table only public.storage_objects add constraint storage_objects_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

alter table only public.student_activity_states add constraint student_activity_states_activity_run_id_fkey FOREIGN KEY (activity_run_id) REFERENCES lesson_activity_runs(id) ON DELETE CASCADE;

alter table only public.student_activity_states add constraint student_activity_states_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.student_activity_states add constraint student_activity_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.student_app_deployment_files add constraint student_app_deployment_files_deployment_id_fkey FOREIGN KEY (deployment_id) REFERENCES student_app_deployments(id) ON DELETE CASCADE;

alter table only public.student_app_deployments add constraint student_app_deployments_source_submission_id_fkey FOREIGN KEY (source_submission_id) REFERENCES student_app_submissions(id) ON DELETE SET NULL;

alter table only public.student_app_submission_files add constraint student_app_submission_files_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES student_app_submissions(id) ON DELETE CASCADE;

alter table only public.student_app_submissions add constraint student_app_submissions_class_session_id_fkey FOREIGN KEY (class_session_id) REFERENCES student_app_class_sessions(id) ON DELETE SET NULL;

alter table only public.student_app_submissions add constraint student_app_submissions_previous_submission_id_fkey FOREIGN KEY (previous_submission_id) REFERENCES student_app_submissions(id) ON DELETE SET NULL;

alter table only public.student_requests add constraint student_requests_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

alter table only public.tag_rules add constraint tag_rules_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.tag_rules add constraint tag_rules_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

alter table only public.tags add constraint tags_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.template_collection_items add constraint template_collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES template_collections(id) ON DELETE CASCADE;

alter table only public.template_collection_items add constraint template_collection_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE;

alter table only public.template_library_installs add constraint template_library_installs_template_id_fkey FOREIGN KEY (template_id) REFERENCES template_library_items(id) ON DELETE CASCADE;

alter table only public.template_library_items add constraint template_library_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);

alter table only public.template_library_likes add constraint template_library_likes_template_id_fkey FOREIGN KEY (template_id) REFERENCES template_library_items(id) ON DELETE CASCADE;

alter table only public.template_library_reports add constraint template_library_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES template_library_items(id) ON DELETE CASCADE;

alter table only public.template_library_reviews add constraint template_library_reviews_template_id_fkey FOREIGN KEY (template_id) REFERENCES template_library_items(id) ON DELETE CASCADE;

alter table only public.template_reports add constraint template_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE;

alter table only public.template_versions add constraint template_versions_template_id_fkey FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE;

alter table only public.templates add constraint templates_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES template_collections(id) ON DELETE SET NULL;

alter table only public.templates add constraint templates_cover_file_id_fkey FOREIGN KEY (cover_file_id) REFERENCES board_files(id) ON DELETE SET NULL;

alter table only public.templates add constraint templates_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id);

alter table only public.upgrade_requests add constraint upgrade_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.user_entitlements add constraint user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table only public.user_onboarding add constraint user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.user_plans add constraint user_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only public.user_ui_prefs add constraint user_ui_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table only public.wall_cards_v2 add constraint wall_cards_v2_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

alter table only public.wall_cards_v2 add constraint wall_cards_v2_section_id_fkey FOREIGN KEY (section_id) REFERENCES wall_sections_v2(id) ON DELETE CASCADE;

alter table only public.wall_sections_v2 add constraint wall_sections_v2_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.walls add constraint walls_board_id_fkey FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

alter table only public.website_studio_published_snapshots add constraint website_studio_published_snapshots_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX api_rate_limits_key_window_start_idx ON public.api_rate_limits USING btree (key, window_start DESC);

CREATE INDEX audit_events_action_created_at_idx ON public.audit_events USING btree (action, created_at DESC);

CREATE INDEX audit_events_actor_created_at_idx ON public.audit_events USING btree (actor_user_id, created_at DESC);

CREATE INDEX audit_logs_action_created_at_idx ON public.audit_logs USING btree (action, created_at DESC);

CREATE INDEX audit_logs_actor_created_at_idx ON public.audit_logs USING btree (actor_user_id, created_at DESC);

CREATE INDEX audit_logs_board_created_at_idx ON public.audit_logs USING btree (board_id, created_at DESC);

CREATE INDEX audit_logs_daily_summary_summarized_at_idx ON public.audit_logs_daily_summary USING btree (summarized_at DESC);

CREATE INDEX board_files_board_created_desc_idx ON public.board_files USING btree (board_id, created_at DESC);

CREATE INDEX board_files_board_created_idx ON public.board_files USING btree (board_id, created_at DESC);

CREATE UNIQUE INDEX board_files_board_file_unique_idx ON public.board_files USING btree (board_id, file_id) WHERE (file_id IS NOT NULL);

CREATE INDEX board_files_board_id_active_idx ON public.board_files USING btree (board_id) WHERE (deleted_at IS NULL);

CREATE INDEX board_files_deleted_purge_at_idx ON public.board_files USING btree (deleted_purge_at) WHERE (deleted_purge_at IS NOT NULL);

CREATE INDEX board_files_owner_favorite_idx ON public.board_files USING btree (owner_id, is_favorite, created_at DESC);

CREATE INDEX board_files_owner_hash_variant_idx ON public.board_files USING btree (owner_id, hash_sha256, variant);

CREATE INDEX board_files_owner_last_used_idx ON public.board_files USING btree (owner_id, last_used_at DESC);

CREATE INDEX board_files_tags_idx ON public.board_files USING gin (tags);

CREATE INDEX board_invites_board_idx ON public.board_invites USING btree (board_id);

CREATE INDEX board_invites_email_idx ON public.board_invites USING btree (invited_email);

CREATE INDEX board_live_session_updated_at_idx ON public.board_live_session USING btree (updated_at);

CREATE INDEX board_members_user_board_idx ON public.board_members USING btree (user_id, board_id);

CREATE INDEX board_questions_board_id_idx ON public.board_questions USING btree (board_id, created_at DESC);

CREATE INDEX board_questions_share_code_idx ON public.board_questions USING btree (share_code, created_at DESC);

CREATE INDEX board_view_presets_board_idx ON public.board_view_presets USING btree (board_id);

CREATE UNIQUE INDEX board_view_presets_default_unique ON public.board_view_presets USING btree (user_id, board_id) WHERE (is_default = true);

CREATE INDEX board_view_presets_user_board_idx ON public.board_view_presets USING btree (user_id, board_id);

CREATE INDEX boards_class_id_idx ON public.boards USING btree (class_id);

CREATE INDEX boards_deleted_purge_at_idx ON public.boards USING btree (deleted_purge_at) WHERE (deleted_purge_at IS NOT NULL);

CREATE INDEX boards_owner_id_active_idx ON public.boards USING btree (owner_id) WHERE (deleted_at IS NULL);

CREATE INDEX boards_owner_id_created_at_idx ON public.boards USING btree (owner_id, created_at DESC);

CREATE UNIQUE INDEX boards_share_code_unique ON public.boards USING btree (share_code) WHERE (share_code IS NOT NULL);

CREATE UNIQUE INDEX card_files_card_board_file_unique_idx ON public.card_files USING btree (card_id, board_file_id);

CREATE INDEX card_files_card_created_idx ON public.card_files USING btree (card_id, created_at DESC);

CREATE INDEX card_move_mutations_board_id_idx ON public.card_move_mutations USING btree (board_id, created_at DESC);

CREATE INDEX card_move_mutations_created_at_idx ON public.card_move_mutations USING btree (created_at);

CREATE INDEX card_tags_card_id_idx ON public.card_tags USING btree (card_id);

CREATE INDEX card_tags_tag_id_idx ON public.card_tags USING btree (tag_id);

CREATE INDEX cards_deleted_purge_at_idx ON public.cards USING btree (deleted_purge_at) WHERE (deleted_purge_at IS NOT NULL);

CREATE UNIQUE INDEX cards_one_featured_per_wall ON public.cards USING btree (wall_id) WHERE (is_featured = true);

CREATE INDEX cards_wall_id_active_idx ON public.cards USING btree (wall_id) WHERE (deleted_at IS NULL);

CREATE INDEX cards_wall_id_created_at_id_idx ON public.cards USING btree (wall_id, created_at DESC, id DESC);

CREATE INDEX cards_wall_id_created_at_idx ON public.cards USING btree (wall_id, created_at DESC);

CREATE INDEX cards_wall_id_deleted_at_idx ON public.cards USING btree (wall_id, deleted_at DESC);

CREATE INDEX cards_wall_position_idx ON public.cards USING btree (wall_id, "position") WHERE (deleted_at IS NULL);

CREATE INDEX class_sections_class_sort_idx ON public.class_sections USING btree (class_id, sort_index, created_at);

CREATE INDEX class_session_bookmarks_board_id_idx ON public.class_session_bookmarks USING btree (board_id);

CREATE INDEX class_session_bookmarks_session_id_idx ON public.class_session_bookmarks USING btree (session_id);

CREATE INDEX class_session_clip_shares_board_id_created_at_idx ON public.class_session_clip_shares USING btree (board_id, created_at DESC);

CREATE INDEX class_session_clip_shares_revoked_at_idx ON public.class_session_clip_shares USING btree (revoked_at);

CREATE INDEX class_session_clip_shares_session_id_created_at_idx ON public.class_session_clip_shares USING btree (session_id, created_at DESC);

CREATE INDEX class_session_events_board_ts_idx ON public.class_session_events USING btree (board_id, ts DESC);

CREATE INDEX class_session_events_session_ts_idx ON public.class_session_events USING btree (session_id, ts);

CREATE INDEX class_session_questions_session_pinned_idx ON public.class_session_questions USING btree (session_id, pinned);

CREATE INDEX class_session_questions_session_status_idx ON public.class_session_questions USING btree (session_id, status, created_at DESC);

CREATE INDEX class_sessions_board_started_idx ON public.class_sessions USING btree (board_id, started_at DESC);

CREATE INDEX class_sessions_class_started_idx ON public.class_sessions USING btree (class_id, started_at DESC);

CREATE INDEX class_sessions_owner_idx ON public.class_sessions USING btree (owner_id, started_at DESC);

CREATE INDEX class_sessions_section_started_idx ON public.class_sessions USING btree (section_id, started_at DESC);

CREATE INDEX class_showcase_items_showcase_idx ON public.class_showcase_items USING btree (showcase_id, sort_index);

CREATE INDEX class_showcases_class_idx ON public.class_showcases USING btree (class_id, created_at DESC);

CREATE INDEX class_showcases_session_idx ON public.class_showcases USING btree (session_id, created_at DESC);

CREATE INDEX classes_owner_id_created_at_idx ON public.classes USING btree (owner_id, created_at DESC);

CREATE INDEX community_blocked_users_created_at_idx ON public.community_blocked_users USING btree (created_at DESC);

CREATE INDEX community_comment_moderation_hidden_updated_idx ON public.community_comment_moderation USING btree (is_hidden, updated_at DESC);

CREATE INDEX community_comment_reports_comment_created_idx ON public.community_comment_reports USING btree (comment_id, created_at DESC);

CREATE INDEX community_comment_reports_reporter_created_idx ON public.community_comment_reports USING btree (reporter_user_id, created_at DESC);

CREATE INDEX community_comments_post_created_at_idx ON public.community_comments USING btree (post_id, created_at);

CREATE INDEX community_comments_post_status_created_at_idx ON public.community_comments USING btree (post_id, status, created_at);

CREATE INDEX community_posts_active_created_at_idx ON public.community_posts USING btree (created_at DESC) WHERE (status = 'active'::text);

CREATE INDEX community_posts_attachment_file_ids_gin_idx ON public.community_posts USING gin (attachment_file_ids);

CREATE INDEX community_posts_category_created_at_idx ON public.community_posts USING btree (category, created_at DESC);

CREATE INDEX community_posts_created_at_idx ON public.community_posts USING btree (created_at DESC);

CREATE INDEX community_posts_pinned_created_at_idx ON public.community_posts USING btree (is_pinned DESC, created_at DESC);

CREATE INDEX community_reports_archive_archived_at_idx ON public.community_reports_archive USING btree (archived_at DESC);

CREATE INDEX community_reports_created_at_idx ON public.community_reports USING btree (created_at DESC);

CREATE INDEX community_reports_status_created_at_idx ON public.community_reports USING btree (status, created_at DESC);

CREATE INDEX community_reports_target_status_idx ON public.community_reports USING btree (target_type, target_id, status);

CREATE INDEX coupon_redemptions_user_id_idx ON public.coupon_redemptions USING btree (user_id);

CREATE INDEX decorate_plan_cache_expires_at_idx ON public.decorate_plan_cache USING btree (expires_at);

CREATE INDEX decorate_plan_cache_user_id_idx ON public.decorate_plan_cache USING btree (user_id);

CREATE INDEX edu_assignments_board_created_idx ON public.edu_assignments USING btree (board_id, created_at DESC);

CREATE INDEX edu_classes_locked_at_idx ON public.edu_classes USING btree (locked_at);

CREATE INDEX edu_featured_projects_board_created_idx ON public.edu_featured_projects USING btree (board_id, created_at DESC);

CREATE INDEX edu_featured_projects_board_id_sort_order_idx ON public.edu_featured_projects USING btree (board_id, sort_order);

CREATE INDEX edu_gallery_class_created_idx ON public.edu_gallery USING btree (class_code, created_at DESC);

CREATE INDEX edu_gallery_class_view_count_idx ON public.edu_gallery USING btree (class_code, view_count DESC);

CREATE INDEX edu_join_codes_board_id_idx ON public.edu_join_codes USING btree (board_id);

CREATE INDEX edu_join_sessions_expires_at_idx ON public.edu_join_sessions USING btree (expires_at);

CREATE INDEX edu_join_sessions_share_code_idx ON public.edu_join_sessions USING btree (share_code);

CREATE INDEX edu_participants_board_anon_idx ON public.edu_participants USING btree (board_id, anon_id);

CREATE INDEX edu_participants_last_seen_at_idx ON public.edu_participants USING btree (last_seen_at);

CREATE INDEX edu_participants_share_code_idx ON public.edu_participants USING btree (share_code);

CREATE INDEX edu_presentation_links_code_idx ON public.edu_presentation_links USING btree (code);

CREATE INDEX edu_project_feedback_board_updated_idx ON public.edu_project_feedback USING btree (board_id, updated_at DESC);

CREATE INDEX edu_project_stats_view_count_idx ON public.edu_project_stats USING btree (view_count DESC);

CREATE INDEX edu_project_visibility_board_hidden_idx ON public.edu_project_visibility USING btree (board_id, hidden);

CREATE INDEX edu_projects_board_anon_idx ON public.edu_projects USING btree (board_id, anon_id);

CREATE INDEX edu_projects_expires_at_idx ON public.edu_projects USING btree (expires_at);

CREATE INDEX edu_projects_publish_quota_key_idx ON public.edu_projects USING btree (publish_quota_key, last_published_at) WHERE (publish_state = 'PUBLISHED'::text);

CREATE INDEX edu_publish_attempts_expires_at_idx ON public.edu_publish_attempts USING btree (expires_at);

CREATE INDEX edu_publish_attempts_parent_attempt_id_idx ON public.edu_publish_attempts USING btree (parent_attempt_id) WHERE (parent_attempt_id IS NOT NULL);

CREATE UNIQUE INDEX edu_publish_attempts_project_id_key ON public.edu_publish_attempts USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX edu_publish_attempts_root_created_at_idx ON public.edu_publish_attempts USING btree (root_attempt_id, created_at);

CREATE INDEX edu_publish_attempts_state_updated_at_idx ON public.edu_publish_attempts USING btree (state, updated_at);

CREATE INDEX edu_publish_attempts_validating_lease_idx ON public.edu_publish_attempts USING btree (lease_expires_at) WHERE (state = 'VALIDATING'::text);

CREATE UNIQUE INDEX edu_publish_slug_reservations_attempt_id_key ON public.edu_publish_slug_reservations USING btree (attempt_id) WHERE (attempt_id IS NOT NULL);

CREATE UNIQUE INDEX edu_publish_slug_reservations_project_id_key ON public.edu_publish_slug_reservations USING btree (project_id) WHERE (project_id IS NOT NULL);

CREATE INDEX edu_publish_slug_reservations_state_updated_at_idx ON public.edu_publish_slug_reservations USING btree (reservation_state, updated_at);

CREATE INDEX edu_reports_board_created_idx ON public.edu_reports USING btree (board_id, created_at DESC);

CREATE INDEX edu_submissions_assignment_created_idx ON public.edu_submissions USING btree (assignment_id, created_at DESC);

CREATE INDEX exhibit_versions_exhibit_created_idx ON public.exhibit_versions USING btree (exhibit_id, created_at DESC);

CREATE INDEX exhibits_board_idx ON public.exhibits USING btree (board_id);

CREATE INDEX exhibits_owner_created_idx ON public.exhibits USING btree (owner_id, created_at DESC);

CREATE INDEX files_card_id_active_idx ON public.files USING btree (card_id) WHERE (deleted_at IS NULL);

CREATE INDEX files_card_id_created_at_idx ON public.files USING btree (card_id, created_at DESC);

CREATE INDEX files_deleted_purge_at_idx ON public.files USING btree (deleted_purge_at) WHERE (deleted_purge_at IS NOT NULL);

CREATE INDEX files_owner_content_hash_idx ON public.files USING btree (owner_id, content_hash) WHERE (content_hash IS NOT NULL);

CREATE INDEX files_owner_content_sha_idx ON public.files USING btree (owner_id, content_sha256) WHERE (content_sha256 IS NOT NULL);

CREATE INDEX files_owner_created_idx ON public.files USING btree (owner_user_id, created_at DESC);

CREATE INDEX files_owner_deleted_idx ON public.files USING btree (owner_user_id, deleted_at);

CREATE INDEX files_owner_object_key_idx ON public.files USING btree (owner_id, object_key);

CREATE INDEX files_owner_sha_idx ON public.files USING btree (owner_id, sha256_hex) WHERE (sha256_hex IS NOT NULL);

CREATE UNIQUE INDEX files_r2_key_unique_idx ON public.files USING btree (r2_key);

CREATE INDEX files_tags_gin_idx ON public.files USING gin (tags);

CREATE INDEX idx_cards_author_client_id ON public.cards USING btree (author_client_id);

CREATE INDEX idx_student_app_submissions_active_owner ON public.student_app_submissions USING btree (board_id, id, owner_participant_hash) WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX idx_student_app_submissions_capability_hash ON public.student_app_submissions USING btree (status_capability_hash) WHERE (status_capability_hash IS NOT NULL);

CREATE INDEX idx_student_app_submissions_latest ON public.student_app_submissions USING btree (board_id, class_session_id, is_latest);

CREATE INDEX idx_student_app_submissions_previous_submission_id ON public.student_app_submissions USING btree (previous_submission_id);

CREATE INDEX idx_student_app_submissions_version_lookup ON public.student_app_submissions USING btree (board_id, class_session_id, author_client_id, app_key);

CREATE INDEX idx_ws_published_owner ON public.website_studio_published_snapshots USING btree (owner_user_id);

CREATE INDEX idx_ws_published_slug ON public.website_studio_published_snapshots USING btree (slug);

CREATE INDEX lesson_activity_runs_board_status_idx ON public.lesson_activity_runs USING btree (board_id, status, started_at DESC);

CREATE INDEX lesson_activity_runs_class_session_idx ON public.lesson_activity_runs USING btree (class_session_id);

CREATE UNIQUE INDEX lesson_activity_runs_session_activity_unique ON public.lesson_activity_runs USING btree (class_session_id, activity_type);

CREATE INDEX license_keys_code_sha256_idx ON public.license_keys USING btree (code_sha256);

CREATE INDEX live_participants_active_idx ON public.live_participants USING btree (board_id, share_code, last_seen_at DESC);

CREATE UNIQUE INDEX live_participants_unique ON public.live_participants USING btree (board_id, share_code, fingerprint);

CREATE INDEX metaverse_progress_snapshots_updated_at_idx ON public.metaverse_progress_snapshots USING btree (updated_at DESC);

CREATE INDEX moderation_hides_hidden_idx ON public.moderation_hides USING btree (hidden, hidden_at DESC);

CREATE INDEX ops_banners_updated_at_idx ON public.ops_banners USING btree (updated_at DESC);

CREATE INDEX ops_events_kind_ts_desc_idx ON public.ops_events USING btree (kind, ts DESC);

CREATE INDEX ops_events_level_ts_desc_idx ON public.ops_events USING btree (level, ts DESC);

CREATE INDEX ops_events_route_ts_desc_idx ON public.ops_events USING btree (route, ts DESC);

CREATE INDEX ops_events_ts_desc_idx ON public.ops_events USING btree (ts DESC);

CREATE INDEX ops_reports_backlog_runs_created_at_idx ON public.ops_reports_backlog_runs USING btree (created_at DESC);

CREATE INDEX ops_reports_backlog_runs_status_created_at_idx ON public.ops_reports_backlog_runs USING btree (status, created_at DESC);

CREATE INDEX ops_retention_runs_started_at_idx ON public.ops_retention_runs USING btree (started_at DESC);

CREATE INDEX ops_user_assistant_runs_actor_target_created_idx ON public.ops_user_assistant_runs USING btree (actor_user_id, target_user_id, created_at DESC);

CREATE INDEX ownership_requests_board_status_created_idx ON public.ownership_requests USING btree (board_id, status, created_at DESC);

CREATE INDEX public_showcase_tokens_created_idx ON public.public_showcase_tokens USING btree (created_by, created_at DESC);

CREATE INDEX publish_events_project_id_created_at_idx ON public.publish_events USING btree (project_id, created_at DESC);

CREATE INDEX rate_limit_counters_reset_at_idx ON public.rate_limit_counters USING btree (reset_at);

CREATE INDEX rate_limits_window_start_idx ON public.rate_limits USING btree (window_start);

CREATE INDEX reports_target_created_at_idx ON public.reports USING btree (target_type, target_id, created_at DESC);

CREATE INDEX session_report_shares_board_id_idx ON public.session_report_shares USING btree (board_id);

CREATE INDEX session_report_shares_expires_at_idx ON public.session_report_shares USING btree (expires_at);

CREATE INDEX session_report_shares_session_id_idx ON public.session_report_shares USING btree (session_id);

CREATE INDEX showcase_tokens_showcase_idx ON public.showcase_tokens USING btree (showcase_id);

CREATE INDEX showcases_board_created_idx ON public.showcases USING btree (board_id, created_at DESC);

CREATE INDEX showcases_board_updated_idx ON public.showcases USING btree (board_id, updated_at DESC);

CREATE INDEX showcases_owner_updated_idx ON public.showcases USING btree (owner_id, updated_at DESC);

CREATE INDEX site_content_publish_window_idx ON public.site_content USING btree (publish_at, expires_at);

CREATE INDEX site_content_revisions_key_created_at_idx ON public.site_content_revisions USING btree (key, created_at DESC);

CREATE INDEX storage_objects_board_id_idx ON public.storage_objects USING btree (board_id);

CREATE INDEX storage_objects_class_id_idx ON public.storage_objects USING btree (class_id);

CREATE INDEX storage_objects_owner_created_idx ON public.storage_objects USING btree (owner_id, created_at DESC);

CREATE INDEX student_activity_states_activity_run_idx ON public.student_activity_states USING btree (activity_run_id);

CREATE INDEX student_activity_states_board_updated_idx ON public.student_activity_states USING btree (board_id, updated_at DESC);

CREATE UNIQUE INDEX student_activity_states_run_participant_unique ON public.student_activity_states USING btree (activity_run_id, participant_key_hash);

CREATE INDEX student_app_class_sessions_board_id_idx ON public.student_app_class_sessions USING btree (board_id);

CREATE INDEX student_app_class_sessions_created_at_desc_idx ON public.student_app_class_sessions USING btree (created_at DESC);

CREATE INDEX student_app_class_sessions_ends_at_idx ON public.student_app_class_sessions USING btree (ends_at);

CREATE INDEX student_app_class_sessions_status_idx ON public.student_app_class_sessions USING btree (status);

CREATE INDEX student_app_deployment_files_deployment_id_idx ON public.student_app_deployment_files USING btree (deployment_id);

CREATE INDEX student_app_deployment_files_sha256_idx ON public.student_app_deployment_files USING btree (sha256);

CREATE INDEX student_app_deployments_board_id_idx ON public.student_app_deployments USING btree (board_id);

CREATE UNIQUE INDEX student_app_deployments_board_slug_version_unique_active_idx ON public.student_app_deployments USING btree (board_id, slug, version) WHERE (deleted_at IS NULL);

CREATE INDEX student_app_deployments_card_id_idx ON public.student_app_deployments USING btree (card_id);

CREATE INDEX student_app_deployments_created_at_idx ON public.student_app_deployments USING btree (created_at);

CREATE INDEX student_app_deployments_created_by_idx ON public.student_app_deployments USING btree (created_by);

CREATE UNIQUE INDEX student_app_deployments_source_submission_unique_active_idx ON public.student_app_deployments USING btree (source_submission_id) WHERE ((source_submission_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE INDEX student_app_deployments_status_idx ON public.student_app_deployments USING btree (status);

CREATE INDEX student_app_submission_files_sha256_idx ON public.student_app_submission_files USING btree (sha256);

CREATE INDEX student_app_submission_files_submission_id_idx ON public.student_app_submission_files USING btree (submission_id);

CREATE INDEX student_app_submissions_board_id_idx ON public.student_app_submissions USING btree (board_id);

CREATE INDEX student_app_submissions_card_id_idx ON public.student_app_submissions USING btree (card_id);

CREATE INDEX student_app_submissions_class_id_idx ON public.student_app_submissions USING btree (class_id);

CREATE INDEX student_app_submissions_created_at_desc_idx ON public.student_app_submissions USING btree (created_at DESC);

CREATE INDEX student_app_submissions_status_idx ON public.student_app_submissions USING btree (status);

CREATE INDEX student_requests_board_created_at_idx ON public.student_requests USING btree (board_id, created_at DESC);

CREATE INDEX student_requests_code_created_at_idx ON public.student_requests USING btree (code, created_at DESC);

CREATE INDEX student_requests_code_status_created_at_idx ON public.student_requests USING btree (code, status, created_at DESC);

CREATE INDEX tag_rules_board_enabled_priority_idx ON public.tag_rules USING btree (board_id, enabled, priority);

CREATE INDEX tag_rules_board_lower_pattern_idx ON public.tag_rules USING btree (board_id, lower(pattern));

CREATE UNIQUE INDEX tags_board_lower_name_idx ON public.tags USING btree (board_id, lower(name));

CREATE INDEX tags_board_name_idx ON public.tags USING btree (board_id, name);

CREATE INDEX template_collection_items_template_idx ON public.template_collection_items USING btree (template_id);

CREATE UNIQUE INDEX template_collection_items_unique_idx ON public.template_collection_items USING btree (collection_id, template_id);

CREATE INDEX template_library_items_installs_idx ON public.template_library_items USING btree (scope, status, installs_count DESC);

CREATE INDEX template_library_items_likes_idx ON public.template_library_items USING btree (scope, status, likes_count DESC);

CREATE INDEX template_library_items_owner_updated_idx ON public.template_library_items USING btree (owner_id, updated_at DESC);

CREATE INDEX template_library_items_pick_idx ON public.template_library_items USING btree (scope, status, is_pick, pick_rank);

CREATE INDEX template_library_items_scope_status_published_at_idx ON public.template_library_items USING btree (scope, status, published_at DESC);

CREATE INDEX template_library_items_tags_idx ON public.template_library_items USING gin (tags);

CREATE INDEX template_reports_template_created_at_idx ON public.template_reports USING btree (template_id, created_at DESC);

CREATE INDEX template_reports_template_created_idx ON public.template_reports USING btree (template_id, created_at DESC);

CREATE UNIQUE INDEX template_reports_template_reporter_hash_idx ON public.template_reports USING btree (template_id, reporter_hash) WHERE (reporter_hash <> ''::text);

CREATE UNIQUE INDEX template_reports_unique_reporter_idx ON public.template_reports USING btree (template_id, reporter_user_id) WHERE (reporter_user_id IS NOT NULL);

CREATE INDEX template_versions_template_created_idx ON public.template_versions USING btree (template_id, created_at DESC);

CREATE INDEX templates_access_level_idx ON public.templates USING btree (access_level, created_at DESC);

CREATE INDEX templates_collection_id_idx ON public.templates USING btree (collection_id);

CREATE INDEX templates_featured_rank_idx ON public.templates USING btree (is_featured, featured_rank, created_at DESC);

CREATE INDEX templates_grade_subject_idx ON public.templates USING btree (grade_band, subject);

CREATE INDEX templates_tags_idx ON public.templates USING gin (tags);

CREATE INDEX templates_visibility_created_at_idx ON public.templates USING btree (visibility, created_at DESC);

CREATE INDEX templates_visibility_rank_created_idx ON public.templates USING btree (visibility, picks_rank, created_at DESC);

CREATE INDEX templates_visibility_status_idx ON public.templates USING btree (visibility, status, created_at DESC);

CREATE INDEX upgrade_requests_status_idx ON public.upgrade_requests USING btree (status);

CREATE INDEX upgrade_requests_user_idx ON public.upgrade_requests USING btree (user_id);

CREATE INDEX user_entitlements_plan_idx ON public.user_entitlements USING btree (plan);

CREATE INDEX user_entitlements_stripe_customer_idx ON public.user_entitlements USING btree (stripe_customer_id);

CREATE INDEX user_entitlements_stripe_subscription_idx ON public.user_entitlements USING btree (stripe_subscription_id);

CREATE INDEX user_plans_plan_idx ON public.user_plans USING btree (plan);

CREATE INDEX wall_cards_v2_author_id_idx ON public.wall_cards_v2 USING btree (author_id);

CREATE INDEX wall_cards_v2_section_position_idx ON public.wall_cards_v2 USING btree (section_id, "position");

CREATE INDEX wall_sections_v2_board_position_idx ON public.wall_sections_v2 USING btree (board_id, "position");

CREATE INDEX walls_board_id_created_at_idx ON public.walls USING btree (board_id, created_at DESC);

CREATE INDEX walls_board_position_idx ON public.walls USING btree (board_id, "position");

-- -----------------------------------------------------------------------------
-- Functions and triggers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid)
 RETURNS TABLE(outcome text, attempt_id uuid, slug text, state text, attempt_version bigint, retry_count integer, commit_count integer, lease_expires_at timestamp with time zone, expires_at timestamp with time zone, project_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_now timestamptz;
  v_attempt public.edu_publish_attempts%rowtype;
  v_lease_expires_at timestamptz;
  v_outcome text;
  v_next_retry_count integer;
  v_updated_rows integer;
  v_has_attempt boolean := false;
begin
  if p_attempt_id is null
     or p_slug is null
     or pg_catalog.length(p_slug) not between 1 and 64
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_manifest_schema_version is null
     or p_manifest_schema_version <> 1
     or p_declared_manifest_digest is null
     or p_declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or p_lease_owner is null then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();

  select attempt.*
    into v_attempt
    from public.edu_publish_attempts as attempt
   where attempt.attempt_id = p_attempt_id
   for update;
  v_has_attempt := found;

  if not v_has_attempt then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  if v_attempt.attempt_id is null
     or v_attempt.slug is null
     or pg_catalog.length(v_attempt.slug) not between 1 and 64
     or v_attempt.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_attempt.manifest_schema_version is null
     or v_attempt.manifest_schema_version <> 1
     or v_attempt.declared_manifest_digest is null
     or v_attempt.declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or v_attempt.state is null
     or v_attempt.state not in (
       'PREPARED',
       'VALIDATING',
       'PUBLISHED',
       'FAILED_RETRYABLE',
       'FAILED_RESTART_REQUIRED',
       'ABANDONED'
     )
     or v_attempt.attempt_version is null
     or v_attempt.attempt_version < 0
     or v_attempt.retry_count is null
     or v_attempt.retry_count not between 0 and 3
     or v_attempt.commit_count is null
     or v_attempt.commit_count < 0
     or v_attempt.expires_at is null
     or not pg_catalog.isfinite(v_attempt.expires_at)
     or (
       (v_attempt.lease_owner is null and v_attempt.lease_expires_at is not null)
       or (v_attempt.lease_owner is not null and v_attempt.lease_expires_at is null)
     )
     or (
       v_attempt.lease_expires_at is not null
       and not pg_catalog.isfinite(v_attempt.lease_expires_at)
     )
     or (
       v_attempt.failure_code is not null
       and v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED',
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       )
     ) then
    raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.state = 'PREPARED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'VALIDATING' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is null
       or v_attempt.lease_expires_at is null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'PUBLISHED' then
    if v_attempt.project_id is null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RETRYABLE' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED'
       ) then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RESTART_REQUIRED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       ) then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'ABANDONED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is distinct from 'ATTEMPT_EXPIRED' then
      raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
    end if;
  else
    raise exception 'edu_publish_begin_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.attempt_id is distinct from p_attempt_id
     or v_attempt.slug is distinct from p_slug
     or v_attempt.manifest_schema_version is distinct from p_manifest_schema_version
     or v_attempt.declared_manifest_digest is distinct from p_declared_manifest_digest then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  if v_attempt.state = 'PUBLISHED' then
    return query
      select
        'ALREADY_PUBLISHED'::text,
        v_attempt.attempt_id,
        v_attempt.slug,
        v_attempt.state,
        v_attempt.attempt_version,
        v_attempt.retry_count,
        v_attempt.commit_count,
        null::timestamptz,
        v_attempt.expires_at,
        v_attempt.project_id;
    return;
  end if;

  if v_attempt.state = 'FAILED_RESTART_REQUIRED' then
    return query
      select
        'STATE_CONFLICT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  if v_attempt.state = 'ABANDONED' then
    return query
      select
        'ATTEMPT_EXPIRED'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  if v_attempt.state in ('PREPARED', 'FAILED_RETRYABLE', 'VALIDATING')
     and v_attempt.expires_at <= v_now then
    if v_attempt.attempt_version = 9223372036854775807 then
      raise exception 'edu_publish_begin_commit_invariant_counter_overflow';
    end if;

    update public.edu_publish_attempts as attempt
       set state = 'ABANDONED',
           failure_code = 'ATTEMPT_EXPIRED',
           lease_owner = null,
           lease_expires_at = null,
           validation_started_at = null,
           failed_at = v_now,
           attempt_version = attempt.attempt_version + 1,
           updated_at = v_now
     where attempt.attempt_id = p_attempt_id
     returning attempt.* into v_attempt;
    get diagnostics v_updated_rows = row_count;

    if v_updated_rows <> 1 then
      raise exception 'edu_publish_begin_commit_invariant_mutation_cardinality';
    end if;

    return query
      select
        'ATTEMPT_EXPIRED'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::timestamptz,
        null::timestamptz,
        null::uuid;
    return;
  end if;

  if v_attempt.state = 'PREPARED' then
    v_outcome := 'CLAIMED';
    v_next_retry_count := v_attempt.retry_count;
  elsif v_attempt.state = 'FAILED_RETRYABLE' then
    if v_attempt.retry_count = 3 then
      return query
        select
          'RETRY_EXHAUSTED'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::timestamptz,
          null::timestamptz,
          null::uuid;
      return;
    end if;
    v_outcome := 'RECLAIMED_RETRYABLE';
    v_next_retry_count := v_attempt.retry_count + 1;
  elsif v_attempt.state = 'VALIDATING' then
    if v_attempt.lease_expires_at > v_now then
      return query
        select
          'LEASE_ACTIVE'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::timestamptz,
          null::timestamptz,
          null::uuid;
      return;
    end if;
    v_outcome := 'TAKEN_OVER_STALE_LEASE';
    v_next_retry_count := v_attempt.retry_count;
  else
    raise exception 'edu_publish_begin_commit_invariant_unhandled_state';
  end if;

  if v_attempt.attempt_version = 9223372036854775807
     or v_attempt.commit_count = 2147483647 then
    raise exception 'edu_publish_begin_commit_invariant_counter_overflow';
  end if;

  v_lease_expires_at := least(
    v_attempt.expires_at,
    v_now + interval '300 seconds'
  );

  if v_lease_expires_at is null
     or not pg_catalog.isfinite(v_lease_expires_at)
     or v_lease_expires_at <= v_now then
    raise exception 'edu_publish_begin_commit_invariant_lease_expiry_invalid';
  end if;

  update public.edu_publish_attempts as attempt
     set state = 'VALIDATING',
         attempt_version = attempt.attempt_version + 1,
         retry_count = v_next_retry_count,
         commit_count = attempt.commit_count + 1,
         lease_owner = p_lease_owner,
         lease_expires_at = v_lease_expires_at,
         validation_started_at = v_now,
         failed_at = null,
         failure_code = null,
         updated_at = v_now
   where attempt.attempt_id = p_attempt_id
   returning attempt.* into v_attempt;
  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> 1 then
    raise exception 'edu_publish_begin_commit_invariant_mutation_cardinality';
  end if;

  return query
    select
      v_outcome,
      v_attempt.attempt_id,
      v_attempt.slug,
      v_attempt.state,
      v_attempt.attempt_version,
      v_attempt.retry_count,
      v_attempt.commit_count,
      v_attempt.lease_expires_at,
      v_attempt.expires_at,
      v_attempt.project_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.board_role(bid uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when exists (
      select 1 from public.boards where id = bid and owner_id = auth.uid()
    ) then 'owner'
    when exists (
      select 1 from public.board_members where board_id = bid and user_id = auth.uid()
    ) then 'member'
    else null
  end;
$function$;

CREATE OR REPLACE FUNCTION public.community_guard_moderation_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if public.community_is_moderator(auth.uid()) then
    return new;
  end if;

  if auth.uid() = old.author_user_id then
    if new.status is distinct from old.status then
      raise exception 'only moderators can change moderation status';
    end if;

    if new.moderation_note is distinct from old.moderation_note then
      raise exception 'only moderators can change moderation note';
    end if;

    if new.author_user_id is distinct from old.author_user_id then
      raise exception 'author_user_id is immutable';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_is_blocked(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1 from public.community_blocked_users b where b.user_id = p_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.community_is_moderator(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select exists (
    select 1 from public.community_moderators m where m.user_id = p_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.community_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_verified_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_project_id uuid, p_share_code text, p_lesson_id smallint, p_author_name text, p_title text, p_anon_id text, p_board_id uuid, p_expires_at timestamp with time zone, p_files jsonb, p_preview_url text, p_gallery_preview_url text, p_public_url text, p_classroom_url text, p_request_id text, p_publish_quota_key text)
 RETURNS TABLE(outcome text, attempt_id uuid, slug text, state text, attempt_version bigint, retry_count integer, commit_count integer, project_id uuid, verified_manifest_digest text, reservation_state text, published_at timestamp with time zone, preview_url text, public_url text, classroom_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_attempt public.edu_publish_attempts%rowtype;
  v_reservation public.edu_publish_slug_reservations%rowtype;
  v_project public.edu_projects%rowtype;
  v_has_attempt boolean := false;
  v_has_reservation boolean := false;
  v_has_project boolean := false;
  v_affected_rows bigint;
  v_file jsonb;
  v_file_count integer;
  v_path text;
  v_content_type text;
  v_size_text text;
  v_size numeric;
  v_total_bytes numeric := 0;
  v_lower_path text;
  v_filename text;
  v_segment text;
  v_slash_position integer;
  v_top_level_directory text;
  v_multiple_top_level_directories boolean := false;
  v_has_root_level_file boolean := false;
  v_has_root_index boolean := false;
  v_seen_paths text[] := '{}'::text[];
begin
  if p_attempt_id is null
     or p_slug is null
     or pg_catalog.length(p_slug) not between 1 and 64
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_manifest_schema_version is null
     or p_manifest_schema_version <> 1
     or p_declared_manifest_digest is null
     or p_declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or p_verified_manifest_digest is null
     or p_verified_manifest_digest !~ '^[0-9a-f]{64}$'
     or p_verified_manifest_digest is distinct from p_declared_manifest_digest
     or p_lease_owner is null
     or p_expected_attempt_version is null
     or p_expected_attempt_version < 0
     or p_expected_attempt_version > 9007199254740991
     or p_project_id is null
     or p_project_id = p_attempt_id
     or p_project_id = p_lease_owner
     or p_share_code is null
     or pg_catalog.length(p_share_code) not between 4 and 8
     or p_share_code !~ '^[a-z0-9]{4,8}$'
     or p_share_code in ('join', 'dashboard', 'auth', 'pricing', 'templates', 'public')
     or p_lesson_id is null
     or p_lesson_id not in (1, 2, 3, 4)
     or p_slug !~ (
       '^'
       || p_share_code
       || '-[a-z0-9]{6}-p'
       || p_lesson_id::text
       || '(?:-v(?:[2-9]|[1-9][0-9]|1[0-9]{2}|200))?$'
     )
     or p_author_name is null
     or pg_catalog.btrim(p_author_name) <> p_author_name
     or pg_catalog.length(p_author_name) = 0
     or p_title is null
     or pg_catalog.btrim(p_title) <> p_title
     or pg_catalog.length(p_title) = 0
     or (
       p_anon_id is not null
       and (
         pg_catalog.btrim(p_anon_id) <> p_anon_id
         or pg_catalog.length(p_anon_id) = 0
       )
     )
     or p_expires_at is null
     or p_files is null
     or pg_catalog.jsonb_typeof(p_files) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_files) not between 1 and 30
     or p_preview_url is null
     or p_public_url is null
     or p_gallery_preview_url is null
     or p_classroom_url is null
     or p_public_url !~ (
       '^https?://[^/?#@[:space:]]+(?::[0-9]{1,5})?/edu/view/'
       || p_slug
       || '/$'
     )
     or p_preview_url is distinct from p_public_url || '?preview=1'
     or p_classroom_url is distinct from p_public_url || '?classroom=1'
     or p_gallery_preview_url !~ (
       '^https?://[^/?#@[:space:]]+(?::[0-9]{1,5})?/v1/'
       || p_slug
       || '/thumb[.]png$'
     )
     or p_request_id is null
     or pg_catalog.btrim(p_request_id) <> p_request_id
     or pg_catalog.length(p_request_id) = 0
     or p_publish_quota_key is null
     or pg_catalog.btrim(p_publish_quota_key) <> p_publish_quota_key
     or pg_catalog.length(p_publish_quota_key) = 0
     or not (
       p_publish_quota_key ~ (
         '^guest:'
         || p_share_code
         || ':p'
         || p_lesson_id::text
         || ':nick:[^:[:space:]][^:]*$'
       )
       or p_publish_quota_key ~ (
         '^uid:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:'
         || p_share_code
         || ':p'
         || p_lesson_id::text
         || '$'
       )
     ) then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  v_file_count := pg_catalog.jsonb_array_length(p_files);
  for v_file in
    select item.value
    from pg_catalog.jsonb_array_elements(p_files) as item(value)
  loop
    if pg_catalog.jsonb_typeof(v_file) is distinct from 'object'
       or (select count(*) from pg_catalog.jsonb_object_keys(v_file)) <> 3
       or not (v_file ? 'path')
       or not (v_file ? 'content_type')
       or not (v_file ? 'size_bytes')
       or pg_catalog.jsonb_typeof(v_file->'path') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_file->'content_type') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_file->'size_bytes') is distinct from 'number' then
      return query
        select
          'INVALID_INPUT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    v_path := v_file->>'path';
    v_content_type := v_file->>'content_type';
    v_size_text := v_file->>'size_bytes';

    if v_path <> pg_catalog.btrim(v_path)
       or pg_catalog.length(v_path) not between 1 and 120
       or pg_catalog.left(v_path, 1) = '/'
       or pg_catalog.strpos(v_path, pg_catalog.chr(92)) > 0
       or pg_catalog.strpos(v_path, ':') > 0
       or v_size_text !~ '^(0|[1-9][0-9]*)$'
       or pg_catalog.length(v_size_text) > 7
       or v_content_type <> pg_catalog.btrim(v_content_type)
       or pg_catalog.length(v_content_type) = 0 then
      return query
        select
          'INVALID_INPUT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    v_size := v_size_text::numeric;
    v_total_bytes := v_total_bytes + v_size;
    v_lower_path := pg_catalog.lower(v_path);

    if v_lower_path = any(v_seen_paths)
       or v_size < 0
       or v_size > 2097152
       or v_total_bytes > 8388608
       or v_lower_path ~ '(^|/)(?:\.|\.\.)($|/)'
       or v_lower_path ~ '(^|/)[.][^/]*'
       or v_lower_path !~ '[.](html|css|js|json|png|jpg|jpeg|webp|svg|ico|txt|woff2)$' then
      return query
        select
          'INVALID_INPUT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    v_filename := null;
    foreach v_segment in array pg_catalog.string_to_array(v_lower_path, '/')
    loop
      if v_segment is null
         or pg_catalog.length(v_segment) = 0
         or v_segment in ('.', '..')
         or pg_catalog.left(v_segment, 1) = '.'
         or pg_catalog.length(v_segment) > 64 then
        return query
          select
            'INVALID_INPUT'::text,
            null::uuid,
            null::text,
            null::text,
            null::bigint,
            null::integer,
            null::integer,
            null::uuid,
            null::text,
            null::text,
            null::timestamptz,
            null::text,
            null::text,
            null::text;
        return;
      end if;
      v_filename := v_segment;
    end loop;

    if v_filename in (
         'service-worker.js',
         'sw.js',
         'worker.js',
         '_headers',
         '_redirects',
         '.env',
         'wrangler.toml'
       ) then
      return query
        select
          'INVALID_INPUT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    v_slash_position := pg_catalog.strpos(v_lower_path, '/');
    if v_slash_position = 0 then
      v_has_root_level_file := true;
    else
      if v_top_level_directory is null then
        v_top_level_directory := pg_catalog.left(v_lower_path, v_slash_position - 1);
      elsif v_top_level_directory <> pg_catalog.left(v_lower_path, v_slash_position - 1) then
        v_multiple_top_level_directories := true;
      end if;
    end if;

    if v_lower_path = 'index.html' then
      v_has_root_index := true;
    end if;

    v_seen_paths := pg_catalog.array_append(v_seen_paths, v_lower_path);
  end loop;

  if not v_has_root_index
     and (
       v_has_root_level_file
       or v_multiple_top_level_directories
       or v_top_level_directory is null
       or (v_top_level_directory || '/index.html') <> all(v_seen_paths)
     ) then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select attempt.*
    into v_attempt
    from public.edu_publish_attempts as attempt
   where attempt.attempt_id = p_attempt_id
   for update;
  v_has_attempt := found;

  if not v_has_attempt then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.attempt_id is null
     or v_attempt.slug is null
     or pg_catalog.length(v_attempt.slug) not between 1 and 64
     or v_attempt.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_attempt.lesson_id is null
     or v_attempt.lesson_id not between 1 and 4
     or v_attempt.manifest_schema_version is null
     or v_attempt.manifest_schema_version <> 1
     or v_attempt.declared_manifest_digest is null
     or v_attempt.declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or (
       v_attempt.verified_manifest_digest is not null
       and v_attempt.verified_manifest_digest !~ '^[0-9a-f]{64}$'
     )
     or v_attempt.state is null
     or v_attempt.state not in (
       'PREPARED',
       'VALIDATING',
       'PUBLISHED',
       'FAILED_RETRYABLE',
       'FAILED_RESTART_REQUIRED',
       'ABANDONED'
     )
     or v_attempt.retry_count is null
     or v_attempt.retry_count not between 0 and 3
     or v_attempt.commit_count is null
     or v_attempt.commit_count < 0
     or v_attempt.attempt_version is null
     or v_attempt.attempt_version not between 0 and 9007199254740991
     or v_attempt.expires_at is null
     or not pg_catalog.isfinite(v_attempt.expires_at)
     or (
       (v_attempt.lease_owner is null and v_attempt.lease_expires_at is not null)
       or (v_attempt.lease_owner is not null and v_attempt.lease_expires_at is null)
     )
     or (
       v_attempt.lease_expires_at is not null
       and not pg_catalog.isfinite(v_attempt.lease_expires_at)
     )
     or (
       v_attempt.failure_code is not null
       and v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED',
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       )
     ) then
    raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.state = 'PREPARED' then
    if v_attempt.project_id is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'VALIDATING' then
    if v_attempt.project_id is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.lease_owner is null
       or v_attempt.lease_expires_at is null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'PUBLISHED' then
    if v_attempt.project_id is null
       or v_attempt.verified_manifest_digest is null
       or v_attempt.verified_manifest_digest is distinct from v_attempt.declared_manifest_digest
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is null
       or v_attempt.failed_at is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RETRYABLE' then
    if v_attempt.project_id is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED'
       ) then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RESTART_REQUIRED' then
    if v_attempt.project_id is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       ) then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'ABANDONED' then
    if v_attempt.project_id is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.failure_code is distinct from 'ATTEMPT_EXPIRED' then
      raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
    end if;
  else
    raise exception 'edu_publish_complete_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.attempt_id is distinct from p_attempt_id
     or v_attempt.slug is distinct from p_slug
     or v_attempt.lesson_id is distinct from p_lesson_id
     or v_attempt.manifest_schema_version is distinct from p_manifest_schema_version
     or v_attempt.declared_manifest_digest is distinct from p_declared_manifest_digest then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select reservation.*
    into v_reservation
    from public.edu_publish_slug_reservations as reservation
   where reservation.slug = p_slug
   for update;
  v_has_reservation := found;

  if not v_has_reservation then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_reservation.slug is null
     or pg_catalog.length(v_reservation.slug) not between 1 and 64
     or v_reservation.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_reservation.reservation_state is null
     or v_reservation.reservation_state not in (
       'LEGACY_PROJECT',
       'ATTEMPT_RESERVED',
       'PROJECT_PUBLISHED',
       'TOMBSTONED'
     )
     or v_reservation.reserved_at is null
     or v_reservation.created_at is null
     or v_reservation.updated_at is null
     or v_reservation.reserved_at > v_reservation.updated_at
     or v_reservation.created_at > v_reservation.updated_at
     or (
       v_reservation.converted_at is not null
       and v_reservation.converted_at < v_reservation.reserved_at
     ) then
    raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
  end if;

  if v_reservation.reservation_state = 'LEGACY_PROJECT' then
    if v_reservation.attempt_id is not null
       or v_reservation.project_id is null
       or v_reservation.converted_at is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
    end if;
  elsif v_reservation.reservation_state = 'ATTEMPT_RESERVED' then
    if v_reservation.attempt_id is null
       or v_reservation.project_id is not null
       or v_reservation.converted_at is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
    end if;
  elsif v_reservation.reservation_state = 'PROJECT_PUBLISHED' then
    if v_reservation.attempt_id is null
       or v_reservation.project_id is null
       or v_reservation.converted_at is null then
      raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
    end if;
  elsif v_reservation.reservation_state = 'TOMBSTONED' then
    if v_reservation.attempt_id is not null
       or v_reservation.project_id is not null then
      raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
    end if;
  else
    raise exception 'edu_publish_complete_commit_invariant_stored_reservation_invalid';
  end if;

  if v_reservation.slug is distinct from p_slug
     or v_reservation.attempt_id is distinct from p_attempt_id then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.state = 'PUBLISHED' then
    if v_attempt.project_id is distinct from p_project_id
       or v_attempt.verified_manifest_digest is distinct from p_verified_manifest_digest then
      return query
        select
          'BINDING_MISMATCH'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    if v_reservation.reservation_state is distinct from 'PROJECT_PUBLISHED'
       or v_reservation.attempt_id is distinct from p_attempt_id
       or v_reservation.project_id is distinct from p_project_id
       or v_reservation.converted_at is null then
      return query
        select
          'RESERVATION_MISMATCH'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::integer,
          null::integer,
          null::uuid,
          null::text,
          null::text,
          null::timestamptz,
          null::text,
          null::text,
          null::text;
      return;
    end if;

    select project.*
      into v_project
      from public.edu_projects as project
     where project.id = p_project_id
     for update;
    v_has_project := found;

    if not v_has_project
       or v_project.id is distinct from p_project_id
       or v_project.slug is distinct from p_slug
       or v_project.share_code is distinct from p_share_code
       or v_project.lesson_id is distinct from p_lesson_id
       or v_project.author_name is distinct from p_author_name
       or v_project.title is distinct from p_title
       or v_project.anon_id is distinct from p_anon_id
       or v_project.board_id is distinct from p_board_id
       or v_project.expires_at is distinct from p_expires_at
       or v_project.publish_state is distinct from 'PUBLISHED'
       or v_project.publish_state_reason is not null
       or v_project.last_validated_at is null
       or v_project.last_published_at is distinct from v_attempt.published_at
       or v_project.preview_url is distinct from p_preview_url
       or v_project.public_url is distinct from p_public_url
       or v_project.classroom_url is distinct from p_classroom_url
       or v_project.last_request_id is distinct from p_request_id
       or v_project.publish_quota_key is distinct from p_publish_quota_key then
      raise exception 'edu_publish_complete_commit_invariant_stored_publication_invalid';
    end if;

    if exists (
      (
        select stored.path, stored.content_type, stored.size_bytes
        from public.edu_project_files as stored
        where stored.project_id = p_project_id
        except
        select file.path, file.content_type, file.size_bytes
        from pg_catalog.jsonb_to_recordset(p_files) as file(
          path text,
          content_type text,
          size_bytes bigint
        )
      )
    )
    or exists (
      (
        select file.path, file.content_type, file.size_bytes
        from pg_catalog.jsonb_to_recordset(p_files) as file(
          path text,
          content_type text,
          size_bytes bigint
        )
        except
        select stored.path, stored.content_type, stored.size_bytes
        from public.edu_project_files as stored
        where stored.project_id = p_project_id
      )
    ) then
      raise exception 'edu_publish_complete_commit_invariant_stored_publication_invalid';
    end if;

    if not exists (
      select 1
      from public.edu_gallery as gallery
      where gallery.view_id = p_slug
        and gallery.class_code is not distinct from p_share_code
        and gallery.lesson_key is not distinct from 'P' || p_lesson_id::text
        and gallery.title is not distinct from p_title
        and gallery.author_name is not distinct from p_author_name
        and gallery.preview_url is not distinct from p_gallery_preview_url
    ) then
      raise exception 'edu_publish_complete_commit_invariant_stored_publication_invalid';
    end if;

    if not exists (
      select 1
      from public.publish_events as event
      where event.project_id = p_project_id
        and event.state = 'PUBLISHED'
        and event.reason_code is null
        and event.request_id is not distinct from p_request_id
    ) then
      raise exception 'edu_publish_complete_commit_invariant_stored_publication_invalid';
    end if;

    return query
      select
        'ALREADY_PUBLISHED'::text,
        v_attempt.attempt_id,
        v_attempt.slug,
        'PUBLISHED'::text,
        v_attempt.attempt_version,
        v_attempt.retry_count,
        v_attempt.commit_count,
        v_attempt.project_id,
        v_attempt.verified_manifest_digest,
        'PROJECT_PUBLISHED'::text,
        v_attempt.published_at,
        v_project.preview_url,
        v_project.public_url,
        v_project.classroom_url;
    return;
  end if;

  if v_reservation.reservation_state is distinct from 'ATTEMPT_RESERVED'
     or v_reservation.attempt_id is distinct from p_attempt_id
     or v_reservation.project_id is not null
     or v_reservation.converted_at is not null then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.state <> 'VALIDATING' then
    return query
      select
        'STATE_CONFLICT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.attempt_version = 9007199254740991 then
    raise exception 'edu_publish_complete_commit_invariant_counter_overflow';
  end if;

  if v_attempt.attempt_version <> p_expected_attempt_version then
    return query
      select
        'VERSION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.lease_owner is distinct from p_lease_owner then
    return query
      select
        'LEASE_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if v_attempt.lease_expires_at <= v_now then
    return query
      select
        'LEASE_EXPIRED'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  select project.*
    into v_project
    from public.edu_projects as project
   where project.id = p_project_id
      or project.slug = p_slug
   for update;
  v_has_project := found;

  if v_has_project then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  if exists (
    select 1
    from public.edu_gallery as gallery
    where gallery.view_id = p_slug
  ) then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  insert into public.edu_projects as project (
    id,
    share_code,
    author_name,
    title,
    slug,
    anon_id,
    board_id,
    lesson_id,
    expires_at,
    publish_state,
    publish_state_reason,
    last_validated_at,
    last_published_at,
    preview_url,
    public_url,
    classroom_url,
    last_request_id,
    publish_quota_key,
    created_at,
    updated_at
  )
  values (
    p_project_id,
    p_share_code,
    p_author_name,
    p_title,
    p_slug,
    p_anon_id,
    p_board_id,
    p_lesson_id,
    p_expires_at,
    'PUBLISHED',
    null,
    v_now,
    v_now,
    p_preview_url,
    p_public_url,
    p_classroom_url,
    p_request_id,
    p_publish_quota_key,
    v_now,
    v_now
  )
  on conflict do nothing
  returning project.* into v_project;
  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    return query
      select
        'RESERVATION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::uuid,
        null::text,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        null::text;
    return;
  end if;

  insert into public.edu_project_files (
    project_id,
    path,
    content_type,
    size_bytes
  )
  select
    p_project_id,
    file.path,
    file.content_type,
    file.size_bytes
  from pg_catalog.jsonb_to_recordset(p_files) as file(
    path text,
    content_type text,
    size_bytes bigint
  );
  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> pg_catalog.jsonb_array_length(p_files) then
    raise exception 'edu_publish_complete_commit_invariant_file_insert_mismatch';
  end if;

  insert into public.edu_gallery (
    class_code,
    view_id,
    lesson_key,
    title,
    author_name,
    preview_url,
    created_at,
    updated_at
  )
  values (
    p_share_code,
    p_slug,
    'P' || p_lesson_id::text,
    p_title,
    p_author_name,
    p_gallery_preview_url,
    v_now,
    v_now
  )
  on conflict do nothing;
  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    raise exception 'edu_publish_complete_commit_invariant_gallery_insert_conflict';
  end if;

  insert into public.publish_events (
    project_id,
    state,
    reason_code,
    meta,
    request_id,
    created_at
  )
  values (
    p_project_id,
    'PUBLISHED',
    null,
    pg_catalog.jsonb_build_object('slug', p_slug, 'share_code', p_share_code),
    p_request_id,
    v_now
  );

  update public.edu_publish_slug_reservations as reservation
     set reservation_state = 'PROJECT_PUBLISHED',
         attempt_id = p_attempt_id,
         project_id = p_project_id,
         converted_at = v_now,
         updated_at = v_now
   where reservation.slug = p_slug
     and reservation.attempt_id = p_attempt_id
     and reservation.reservation_state = 'ATTEMPT_RESERVED'
     and reservation.project_id is null
     and reservation.converted_at is null
   returning reservation.* into v_reservation;
  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    raise exception 'edu_publish_complete_commit_invariant_reservation_update_missing';
  end if;

  update public.edu_publish_attempts as attempt
     set state = 'PUBLISHED',
         attempt_version = attempt.attempt_version + 1,
         retry_count = attempt.retry_count,
         commit_count = attempt.commit_count,
         lease_owner = null,
         lease_expires_at = null,
         project_id = p_project_id,
         verified_manifest_digest = p_verified_manifest_digest,
         failure_code = null,
         published_at = v_now,
         failed_at = null,
         updated_at = v_now
   where attempt.attempt_id = p_attempt_id
     and attempt.state = 'VALIDATING'
     and attempt.attempt_version = p_expected_attempt_version
     and attempt.lease_owner = p_lease_owner
     and attempt.lease_expires_at > v_now
     and attempt.project_id is null
     and attempt.verified_manifest_digest is null
     and attempt.failure_code is null
   returning attempt.* into v_attempt;
  get diagnostics v_affected_rows = row_count;

  if v_affected_rows <> 1 then
    raise exception 'edu_publish_complete_commit_invariant_attempt_update_missing';
  end if;

  return query
    select
      'PUBLISHED'::text,
      v_attempt.attempt_id,
      v_attempt.slug,
      v_attempt.state,
      v_attempt.attempt_version,
      v_attempt.retry_count,
      v_attempt.commit_count,
      v_attempt.project_id,
      v_attempt.verified_manifest_digest,
      v_reservation.reservation_state,
      v_attempt.published_at,
      v_project.preview_url,
      v_project.public_url,
      v_project.classroom_url;
end;
$function$;

CREATE OR REPLACE FUNCTION public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- DEPRECATED: legacy compatibility wrapper. Prefer calling public.edu_atomic_publish_v2 with in_slug.
  RETURN public.edu_atomic_publish_v2(
    share_code,
    lesson_id,
    author_name,
    title,
    slug,
    anon_id,
    board_id,
    expires_at,
    files,
    preview_url,
    gallery_preview_url,
    public_url,
    classroom_url,
    request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_project_id uuid;
  v_share_code text := share_code;
  v_lesson_id int := lesson_id;
  v_author_name text := author_name;
  v_title text := title;
  v_slug text := in_slug;
  v_anon_id text := anon_id;
  v_board_id uuid := board_id;
  v_expires_at timestamptz := expires_at;
  v_files jsonb := COALESCE(files, '[]'::jsonb);
  v_preview_url text := preview_url;
  v_gallery_preview_url text := gallery_preview_url;
  v_public_url text := public_url;
  v_classroom_url text := classroom_url;
  v_request_id text := request_id;
BEGIN
  INSERT INTO public.edu_projects AS ep (
    share_code, author_name, title, slug, anon_id, board_id, lesson_id, expires_at
  ) VALUES (
    v_share_code, v_author_name, v_title, v_slug, v_anon_id, v_board_id, v_lesson_id, v_expires_at
  )
  ON CONFLICT (slug) DO UPDATE
    SET share_code = EXCLUDED.share_code,
        author_name = EXCLUDED.author_name,
        title = EXCLUDED.title,
        anon_id = EXCLUDED.anon_id,
        board_id = EXCLUDED.board_id,
        lesson_id = EXCLUDED.lesson_id,
        expires_at = EXCLUDED.expires_at
  RETURNING ep.id INTO v_project_id;

  INSERT INTO public.edu_project_files AS epf (project_id, path, content_type, size_bytes)
  SELECT
    v_project_id,
    payload.path,
    payload.content_type,
    payload.size_bytes
  FROM jsonb_to_recordset(v_files) AS payload(
    path text,
    content_type text,
    size_bytes bigint
  )
  ON CONFLICT (project_id, path) DO UPDATE
    SET content_type = EXCLUDED.content_type,
        size_bytes = EXCLUDED.size_bytes;

  INSERT INTO public.edu_gallery AS eg (
    class_code, view_id, lesson_key, title, author_name, preview_url
  ) VALUES (
    v_share_code,
    v_slug,
    CASE
      WHEN v_lesson_id = 1 THEN 'P1'
      WHEN v_lesson_id = 2 THEN 'P2'
      WHEN v_lesson_id = 3 THEN 'P3'
      WHEN v_lesson_id = 4 THEN 'P4'
      ELSE NULL
    END,
    v_title,
    v_author_name,
    v_gallery_preview_url
  )
  ON CONFLICT (view_id) DO UPDATE
    SET class_code = EXCLUDED.class_code,
        lesson_key = EXCLUDED.lesson_key,
        title = EXCLUDED.title,
        author_name = EXCLUDED.author_name,
        preview_url = EXCLUDED.preview_url,
        updated_at = now();

  UPDATE public.edu_projects AS ep
    SET publish_state = 'PUBLISHED',
        publish_state_reason = NULL,
        last_published_at = now(),
        preview_url = v_preview_url,
        public_url = v_public_url,
        classroom_url = v_classroom_url,
        last_request_id = v_request_id
  WHERE ep.id = v_project_id;

  INSERT INTO public.publish_events AS pe (project_id, state, reason_code, meta, request_id)
  VALUES (
    v_project_id,
    'PUBLISHED',
    NULL,
    jsonb_build_object('slug', v_slug, 'share_code', v_share_code),
    v_request_id
  );

  RETURN v_project_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.edu_check_publish_ready()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  missing text[] := ARRAY[]::text[];
  has_atomic boolean := false;
BEGIN
  -- 1) edu_atomic_publish 함수 존재 확인
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'edu_atomic_publish'
  ) INTO has_atomic;

  IF NOT has_atomic THEN
    missing := missing || ARRAY['function:public.edu_atomic_publish'];
  END IF;

  -- 2) 핵심 테이블 존재 확인(선택이지만 운영에 도움)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='edu_projects') THEN
    missing := missing || ARRAY['table:public.edu_projects'];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='edu_gallery') THEN
    missing := missing || ARRAY['table:public.edu_gallery'];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='publish_events') THEN
    missing := missing || ARRAY['table:public.publish_events'];
  END IF;

  RETURN jsonb_build_object(
    'ok', (array_length(missing, 1) IS NULL),
    'missing', missing,
    'notes', 'Call this before publish commit. If ok=false, run migrations on the correct Supabase project and reload schema.'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_failure_code text)
 RETURNS TABLE(outcome text, attempt_id uuid, slug text, state text, attempt_version bigint, retry_count integer, commit_count integer, failure_code text, failed_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_now timestamptz;
  v_attempt public.edu_publish_attempts%rowtype;
  v_has_attempt boolean := false;
  v_target_state text;
  v_outcome text;
  v_updated_rows integer;
begin
  if p_attempt_id is null
     or p_slug is null
     or pg_catalog.length(p_slug) not between 1 and 64
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_manifest_schema_version is null
     or p_manifest_schema_version <> 1
     or p_declared_manifest_digest is null
     or p_declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or p_lease_owner is null
     or p_expected_attempt_version is null
     or p_expected_attempt_version < 0
     or p_expected_attempt_version > 9007199254740991
     or p_failure_code is null
     or p_failure_code not in (
       'R2_TEMPORARY_FAILURE',
       'DB_TEMPORARY_FAILURE',
       'RPC_TEMPORARY_FAILURE',
       'INTERNAL_EVALUATION_FAILED',
       'R2_OBJECT_MISSING',
       'R2_SIZE_MISMATCH',
       'R2_DIGEST_MISMATCH',
       'SLUG_CONFLICT'
     ) then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();

  select attempt.*
    into v_attempt
    from public.edu_publish_attempts as attempt
   where attempt.attempt_id = p_attempt_id
   for update;
  v_has_attempt := found;

  if not v_has_attempt then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if v_attempt.attempt_id is null
     or v_attempt.slug is null
     or pg_catalog.length(v_attempt.slug) not between 1 and 64
     or v_attempt.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_attempt.manifest_schema_version is null
     or v_attempt.manifest_schema_version <> 1
     or v_attempt.declared_manifest_digest is null
     or v_attempt.declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or v_attempt.state is null
     or v_attempt.state not in (
       'PREPARED',
       'VALIDATING',
       'PUBLISHED',
       'FAILED_RETRYABLE',
       'FAILED_RESTART_REQUIRED',
       'ABANDONED'
     )
     or v_attempt.attempt_version is null
     or v_attempt.attempt_version not between 0 and 9007199254740991
     or v_attempt.retry_count is null
     or v_attempt.retry_count not between 0 and 3
     or v_attempt.commit_count is null
     or v_attempt.commit_count < 0
     or v_attempt.expires_at is null
     or not pg_catalog.isfinite(v_attempt.expires_at)
     or (
       (v_attempt.lease_owner is null and v_attempt.lease_expires_at is not null)
       or (v_attempt.lease_owner is not null and v_attempt.lease_expires_at is null)
     )
     or (
       v_attempt.lease_expires_at is not null
       and not pg_catalog.isfinite(v_attempt.lease_expires_at)
     )
     or (
       v_attempt.failure_code is not null
       and v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED',
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       )
     ) then
    raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.state = 'PREPARED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'VALIDATING' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is null
       or v_attempt.lease_expires_at is null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'PUBLISHED' then
    if v_attempt.project_id is null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is null
       or v_attempt.failed_at is not null
       or v_attempt.verified_manifest_digest is null
       or v_attempt.failure_code is not null then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RETRYABLE' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_TEMPORARY_FAILURE',
         'DB_TEMPORARY_FAILURE',
         'RPC_TEMPORARY_FAILURE',
         'INTERNAL_EVALUATION_FAILED'
       ) then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'FAILED_RESTART_REQUIRED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.validation_started_at is null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is null
       or v_attempt.failure_code not in (
         'R2_OBJECT_MISSING',
         'R2_SIZE_MISMATCH',
         'R2_DIGEST_MISMATCH',
         'ATTEMPT_EXPIRED',
         'SLUG_CONFLICT'
       ) then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  elsif v_attempt.state = 'ABANDONED' then
    if v_attempt.project_id is not null
       or v_attempt.lease_owner is not null
       or v_attempt.lease_expires_at is not null
       or v_attempt.published_at is not null
       or v_attempt.failed_at is null
       or v_attempt.verified_manifest_digest is not null
       or v_attempt.failure_code is distinct from 'ATTEMPT_EXPIRED' then
      raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
    end if;
  else
    raise exception 'edu_publish_fail_commit_invariant_stored_attempt_invalid';
  end if;

  if v_attempt.attempt_id is distinct from p_attempt_id
     or v_attempt.slug is distinct from p_slug
     or v_attempt.manifest_schema_version is distinct from p_manifest_schema_version
     or v_attempt.declared_manifest_digest is distinct from p_declared_manifest_digest then
    return query
      select
        'BINDING_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if v_attempt.state <> 'VALIDATING' then
    return query
      select
        'STATE_CONFLICT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if v_attempt.attempt_version = 9007199254740991 then
    raise exception 'edu_publish_fail_commit_invariant_counter_overflow';
  end if;

  if v_attempt.attempt_version <> p_expected_attempt_version then
    return query
      select
        'VERSION_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if v_attempt.lease_owner is distinct from p_lease_owner then
    return query
      select
        'LEASE_MISMATCH'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if v_attempt.lease_expires_at <= v_now then
    return query
      select
        'LEASE_EXPIRED'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::integer,
        null::integer,
        null::text,
        null::timestamptz,
        null::timestamptz;
    return;
  end if;

  if p_failure_code in (
    'R2_TEMPORARY_FAILURE',
    'DB_TEMPORARY_FAILURE',
    'RPC_TEMPORARY_FAILURE',
    'INTERNAL_EVALUATION_FAILED'
  ) then
    v_target_state := 'FAILED_RETRYABLE';
    v_outcome := 'FAILED_RETRYABLE';
  elsif p_failure_code in (
    'R2_OBJECT_MISSING',
    'R2_SIZE_MISMATCH',
    'R2_DIGEST_MISMATCH',
    'SLUG_CONFLICT'
  ) then
    v_target_state := 'FAILED_RESTART_REQUIRED';
    v_outcome := 'FAILED_RESTART_REQUIRED';
  else
    raise exception 'edu_publish_fail_commit_invariant_unhandled_failure_code';
  end if;

  update public.edu_publish_attempts as attempt
     set state = v_target_state,
         attempt_version = attempt.attempt_version + 1,
         lease_owner = null,
         lease_expires_at = null,
         failure_code = p_failure_code,
         failed_at = v_now,
         updated_at = v_now
   where attempt.attempt_id = p_attempt_id
   returning attempt.* into v_attempt;
  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> 1 then
    raise exception 'edu_publish_fail_commit_invariant_update_missing';
  end if;

  return query
    select
      v_outcome,
      v_attempt.attempt_id,
      v_attempt.slug,
      v_attempt.state,
      v_attempt.attempt_version,
      v_attempt.retry_count,
      v_attempt.commit_count,
      v_attempt.failure_code,
      v_attempt.failed_at,
      v_attempt.expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.find_file_by_hash_v1(p_sha256 text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select f.id
  from public.files f
  where f.owner_id = auth.uid()
    and f.status = 'ready'
    and f.content_sha256 = p_sha256
  order by f.created_at desc
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_ops_retention_status()
 RETURNS TABLE(enabled boolean, run_every_hours integer, community_reports_resolved_ttl_days integer, audit_logs_ttl_days integer, rate_limits_ttl_days integer, rate_limit_counters_grace_days integer, next_purge_due_at timestamp with time zone, last_run_at timestamp with time zone, last_success boolean, last_dry_run boolean, last_note text, last_community_reports_purged integer, last_audit_logs_purged integer, last_rate_limits_purged integer, last_would_community_reports_purged integer, last_would_audit_logs_purged integer, last_would_rate_limits_purged integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with cfg as (
    select *
    from public.ops_retention_config
    where id = true
  ), latest as (
    select *
    from public.ops_retention_runs
    order by started_at desc
    limit 1
  )
  select
    cfg.enabled,
    cfg.run_every_hours,
    cfg.community_reports_resolved_ttl_days,
    cfg.audit_logs_ttl_days,
    cfg.rate_limits_ttl_days,
    cfg.rate_limit_counters_grace_days,
    coalesce(latest.started_at, now()) + make_interval(hours => cfg.run_every_hours) as next_purge_due_at,
    latest.started_at as last_run_at,
    latest.success as last_success,
    latest.dry_run as last_dry_run,
    latest.note as last_note,
    latest.community_reports_purged as last_community_reports_purged,
    latest.audit_logs_purged as last_audit_logs_purged,
    (latest.rate_limits_purged + latest.api_rate_limits_purged + latest.rate_limit_counters_purged)::integer as last_rate_limits_purged,
    latest.would_community_reports_purged as last_would_community_reports_purged,
    latest.would_audit_logs_purged as last_would_audit_logs_purged,
    (latest.would_rate_limits_purged + latest.would_api_rate_limits_purged + latest.would_rate_limit_counters_purged)::integer as last_would_rate_limits_purged
  from cfg
  left join latest on true;
$function$;

CREATE OR REPLACE FUNCTION public.handle_template_report_autohide()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  report_count int;
  next_moderation jsonb;
begin
  select count(*) into report_count from public.template_reports where template_id = NEW.template_id;

  next_moderation := coalesce(
    jsonb_set(
      jsonb_set(
        coalesce((select moderation from public.templates where template_id = NEW.template_id), '{}'::jsonb),
        '{reportCount}',
        to_jsonb(report_count),
        true
      ),
      '{lastReason}',
      to_jsonb('reports'),
      true
    ),
    '{}'::jsonb
  );

  if report_count >= 3 then
    next_moderation := jsonb_set(next_moderation, '{autoHidden}', 'true', true);
    update public.templates
      set visibility = 'hidden',
          moderation = next_moderation
      where template_id = NEW.template_id;
  else
    next_moderation := jsonb_set(next_moderation, '{autoHidden}', 'false', true);
    update public.templates
      set moderation = next_moderation
      where template_id = NEW.template_id;
  end if;

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  next_count integer;
begin
  insert into public.api_rate_limits as limits (key, window_start, count, updated_at)
  values (p_key, p_window_start, 1, now())
  on conflict (key, window_start)
  do update set count = limits.count + 1, updated_at = now()
  returning count into next_count;

  return next_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_edu_project_view(slug_input text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  insert into public.edu_project_stats (slug, view_count, last_viewed_at)
  values (slug_input, 1, now())
  on conflict (slug) do update
    set view_count = public.edu_project_stats.view_count + 1,
        last_viewed_at = excluded.last_viewed_at;

  update public.edu_gallery
    set view_count = public.edu_gallery.view_count + 1,
        updated_at = now()
    where view_id = slug_input;
$function$;

CREATE OR REPLACE FUNCTION public.is_board_member(bid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.board_members
    where board_id = bid and user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_board_owner(bid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.boards
    where id = bid and owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.prepare_edu_publish_attempt_v1(p_attempt_id uuid, p_slug text, p_lesson_id smallint, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_declared_manifest jsonb, p_capability_issued_at timestamp with time zone, p_capability_expires_at timestamp with time zone, p_capability_kid text)
 RETURNS TABLE(outcome text, attempt_id uuid, slug text, state text, attempt_version bigint, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_inserted integer := 0;

  v_attempt public.edu_publish_attempts%rowtype;
  v_reservation_by_slug public.edu_publish_slug_reservations%rowtype;
  v_reservation_by_attempt public.edu_publish_slug_reservations%rowtype;

  v_has_attempt boolean := false;
  v_has_reservation_by_slug boolean := false;
  v_has_reservation_by_attempt boolean := false;
begin
  if p_attempt_id is null
     or p_slug is null
     or length(p_slug) not between 1 and 64
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or p_lesson_id is null
     or p_lesson_id not between 1 and 4
     or p_manifest_schema_version is null
     or p_manifest_schema_version <> 1
     or p_declared_manifest_digest is null
     or p_declared_manifest_digest !~ '^[0-9a-f]{64}$'
     or p_declared_manifest is null
     or jsonb_typeof(p_declared_manifest) is distinct from 'object'
     or p_declared_manifest->>'schemaVersion' is distinct from '1'
     or p_declared_manifest->>'entryPoint' is distinct from 'index.html'
     or jsonb_typeof(p_declared_manifest->'files') is distinct from 'array'
     or p_capability_issued_at is null
     or p_capability_expires_at is null
     or p_capability_kid is null
     or date_trunc('second', p_capability_issued_at) is distinct from p_capability_issued_at
     or date_trunc('second', p_capability_expires_at) is distinct from p_capability_expires_at
     or p_capability_expires_at <= p_capability_issued_at
     or p_capability_expires_at - p_capability_issued_at <> interval '2700 seconds'
     or p_capability_kid !~ '^[A-Za-z0-9._-]{1,32}$' then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::timestamptz;
    return;
  end if;

  select attempt.*
    into v_attempt
    from public.edu_publish_attempts as attempt
   where attempt.attempt_id = p_attempt_id
   for update;
  v_has_attempt := found;

  if v_has_attempt then
    -- Binding mismatch is decided before reservation locking.
    if v_attempt.attempt_id is distinct from p_attempt_id
       or v_attempt.slug is distinct from p_slug
       or v_attempt.lesson_id is distinct from p_lesson_id
       or v_attempt.manifest_schema_version is distinct from p_manifest_schema_version
       or v_attempt.declared_manifest_digest is distinct from p_declared_manifest_digest
       or v_attempt.declared_manifest is distinct from p_declared_manifest
       or v_attempt.capability_issued_at is distinct from p_capability_issued_at
       or v_attempt.capability_expires_at is distinct from p_capability_expires_at
       or v_attempt.capability_kid is distinct from p_capability_kid
       or v_attempt.expires_at is distinct from p_capability_expires_at
       or v_attempt.parent_attempt_id is not null
       or v_attempt.root_attempt_id is distinct from v_attempt.attempt_id then
      return query
        select
          'ATTEMPT_ID_CONFLICT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::timestamptz;
      return;
    end if;

    select reservation.*
      into v_reservation_by_attempt
      from public.edu_publish_slug_reservations as reservation
     where reservation.attempt_id = p_attempt_id
     for update;
    v_has_reservation_by_attempt := found;

    if not v_has_reservation_by_attempt
       or v_reservation_by_attempt.slug is distinct from p_slug
       or v_reservation_by_attempt.attempt_id is distinct from p_attempt_id
       or v_reservation_by_attempt.reservation_state is distinct from 'ATTEMPT_RESERVED'
       or v_reservation_by_attempt.project_id is not null
       or v_reservation_by_attempt.converted_at is not null then
      raise exception 'edu_publish_prepare_attempt_invariant_reservation_mismatch';
    end if;

    if v_attempt.state = 'PREPARED' and v_attempt.expires_at > v_now then
      return query
        select
          'ALREADY_PREPARED'::text,
          v_attempt.attempt_id,
          v_attempt.slug,
          v_attempt.state,
          v_attempt.attempt_version,
          v_attempt.expires_at;
      return;
    end if;

    return query
      select
        'STATE_CONFLICT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::timestamptz;
    return;
  end if;

  if p_capability_issued_at < v_now - interval '60 seconds'
     or p_capability_issued_at > v_now + interval '60 seconds'
     or p_capability_expires_at <= v_now then
    return query
      select
        'INVALID_INPUT'::text,
        null::uuid,
        null::text,
        null::text,
        null::bigint,
        null::timestamptz;
    return;
  end if;

  insert into public.edu_publish_slug_reservations (
    slug,
    attempt_id,
    project_id,
    reservation_state,
    reserved_at,
    converted_at,
    created_at,
    updated_at
  )
  values (
    p_slug,
    p_attempt_id,
    null,
    'ATTEMPT_RESERVED',
    v_now,
    null,
    v_now,
    v_now
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- Conflict reclassification locks at most one reservation row per path.
    select attempt.*
      into v_attempt
      from public.edu_publish_attempts as attempt
     where attempt.attempt_id = p_attempt_id
     for update;
    v_has_attempt := found;

    if v_has_attempt then
      if v_attempt.attempt_id is distinct from p_attempt_id
         or v_attempt.slug is distinct from p_slug
         or v_attempt.lesson_id is distinct from p_lesson_id
         or v_attempt.manifest_schema_version is distinct from p_manifest_schema_version
         or v_attempt.declared_manifest_digest is distinct from p_declared_manifest_digest
         or v_attempt.declared_manifest is distinct from p_declared_manifest
         or v_attempt.capability_issued_at is distinct from p_capability_issued_at
         or v_attempt.capability_expires_at is distinct from p_capability_expires_at
         or v_attempt.capability_kid is distinct from p_capability_kid
         or v_attempt.expires_at is distinct from p_capability_expires_at
         or v_attempt.parent_attempt_id is not null
         or v_attempt.root_attempt_id is distinct from v_attempt.attempt_id then
        return query
          select
            'ATTEMPT_ID_CONFLICT'::text,
            null::uuid,
            null::text,
            null::text,
            null::bigint,
            null::timestamptz;
        return;
      end if;

      select reservation.*
        into v_reservation_by_attempt
        from public.edu_publish_slug_reservations as reservation
       where reservation.attempt_id = p_attempt_id
       for update;
      v_has_reservation_by_attempt := found;

      if not v_has_reservation_by_attempt
         or v_reservation_by_attempt.slug is distinct from p_slug
         or v_reservation_by_attempt.attempt_id is distinct from p_attempt_id
         or v_reservation_by_attempt.reservation_state is distinct from 'ATTEMPT_RESERVED'
         or v_reservation_by_attempt.project_id is not null
         or v_reservation_by_attempt.converted_at is not null then
        raise exception 'edu_publish_prepare_attempt_invariant_reservation_mismatch';
      end if;

      if v_attempt.state = 'PREPARED' and v_attempt.expires_at > v_now then
        return query
          select
            'ALREADY_PREPARED'::text,
            v_attempt.attempt_id,
            v_attempt.slug,
            v_attempt.state,
            v_attempt.attempt_version,
            v_attempt.expires_at;
        return;
      end if;

      return query
        select
          'STATE_CONFLICT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::timestamptz;
      return;
    end if;

    select reservation.*
      into v_reservation_by_attempt
      from public.edu_publish_slug_reservations as reservation
     where reservation.attempt_id = p_attempt_id
     for update;
    v_has_reservation_by_attempt := found;

    if v_has_reservation_by_attempt then
      raise exception 'edu_publish_prepare_attempt_invariant_marker_without_attempt';
    end if;

    select reservation.*
      into v_reservation_by_slug
      from public.edu_publish_slug_reservations as reservation
     where reservation.slug = p_slug
     for update;
    v_has_reservation_by_slug := found;

    if v_has_reservation_by_slug then
      return query
        select
          'SLUG_CONFLICT'::text,
          null::uuid,
          null::text,
          null::text,
          null::bigint,
          null::timestamptz;
      return;
    end if;

    raise exception 'edu_publish_prepare_attempt_invariant_missing_conflict_owner';
  end if;

  insert into public.edu_publish_attempts (
    attempt_id,
    parent_attempt_id,
    root_attempt_id,
    project_id,
    slug,
    lesson_id,
    manifest_schema_version,
    declared_manifest_digest,
    declared_manifest,
    verified_manifest_digest,
    state,
    failure_code,
    retry_count,
    commit_count,
    attempt_version,
    lease_owner,
    lease_expires_at,
    prepared_at,
    validation_started_at,
    published_at,
    failed_at,
    expires_at,
    capability_issued_at,
    capability_expires_at,
    capability_kid,
    created_at,
    updated_at
  )
  values (
    p_attempt_id,
    null,
    p_attempt_id,
    null,
    p_slug,
    p_lesson_id,
    p_manifest_schema_version,
    p_declared_manifest_digest,
    p_declared_manifest,
    null,
    'PREPARED',
    null,
    0,
    0,
    0,
    null,
    null,
    v_now,
    null,
    null,
    null,
    p_capability_expires_at,
    p_capability_issued_at,
    p_capability_expires_at,
    p_capability_kid,
    v_now,
    v_now
  );

  select attempt.*
    into v_attempt
    from public.edu_publish_attempts as attempt
   where attempt.attempt_id = p_attempt_id
   for update;
  v_has_attempt := found;

  select reservation.*
    into v_reservation_by_attempt
    from public.edu_publish_slug_reservations as reservation
   where reservation.attempt_id = p_attempt_id
   for update;
  v_has_reservation_by_attempt := found;

  if not v_has_attempt
     or not v_has_reservation_by_attempt
     or v_reservation_by_attempt.slug is distinct from v_attempt.slug
     or v_reservation_by_attempt.attempt_id is distinct from v_attempt.attempt_id
     or v_reservation_by_attempt.reservation_state is distinct from 'ATTEMPT_RESERVED'
     or v_reservation_by_attempt.project_id is not null
     or v_reservation_by_attempt.converted_at is not null
     or v_attempt.parent_attempt_id is not null
     or v_attempt.root_attempt_id is distinct from v_attempt.attempt_id
     or v_attempt.state is distinct from 'PREPARED'
     or v_attempt.expires_at is distinct from v_attempt.capability_expires_at then
    raise exception 'edu_publish_prepare_attempt_invariant_created_binding_mismatch';
  end if;

  return query
    select
      'CREATED'::text,
      p_attempt_id,
      p_slug,
      'PREPARED'::text,
      0::bigint,
      p_capability_expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_hidden_republish()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if old.status = 'hidden' and new.status = 'published' then
    raise exception 'Hidden templates cannot be republished directly';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_user_id uuid, p_code_sha256 text)
 RETURNS TABLE(ok boolean, reason text, effect_type text, effect_value bigint, new_quota_bytes bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  coupon_record public.coupon_codes%rowtype;
  redemption_id uuid;
  computed_quota bigint;
begin
  if auth.role() <> 'service_role' and auth.uid() <> p_user_id then
    return query select false, 'unauthorized', null, null, null;
    return;
  end if;

  select *
    into coupon_record
    from public.coupon_codes
    where code_sha256 = p_code_sha256
    for update;

  if not found then
    return query select false, 'not_found', null, null, null;
    return;
  end if;

  if coupon_record.expires_at is not null and coupon_record.expires_at <= now() then
    return query select false, 'expired', coupon_record.effect_type, coupon_record.effect_value, null;
    return;
  end if;

  if coupon_record.uses >= coupon_record.max_uses then
    return query select false, 'used_up', coupon_record.effect_type, coupon_record.effect_value, null;
    return;
  end if;

  insert into public.coupon_redemptions (coupon_id, user_id, meta)
  values (coupon_record.id, p_user_id, '{}'::jsonb)
  on conflict (coupon_id, user_id) do nothing
  returning id into redemption_id;

  if redemption_id is null then
    return query select false, 'already_redeemed', coupon_record.effect_type, coupon_record.effect_value, null;
    return;
  end if;

  update public.coupon_codes
  set uses = uses + 1,
      updated_at = now()
  where id = coupon_record.id;

  if coupon_record.effect_type = 'quota_bonus_bytes' then
    insert into public.storage_quota (owner_id, quota_bytes, updated_at)
    values (p_user_id, 10737418240 + coupon_record.effect_value, now())
    on conflict (owner_id)
    do update set
      quota_bytes = public.storage_quota.quota_bytes + coupon_record.effect_value,
      updated_at = now()
    returning quota_bytes into computed_quota;

    return query
      select true, 'ok', coupon_record.effect_type, coupon_record.effect_value, computed_quota;
    return;
  end if;

  return query select true, 'ok', coupon_record.effect_type, coupon_record.effect_value, null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.run_ops_data_retention(p_trigger_source text DEFAULT 'manual'::text, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cfg public.ops_retention_config%rowtype;
  v_run_id bigint;
  v_archived integer := 0;
  v_purged_reports integer := 0;
  v_audit_summarized integer := 0;
  v_audit_purged integer := 0;
  v_rate_purged integer := 0;
  v_api_rate_purged integer := 0;
  v_counter_purged integer := 0;
  v_would_archive integer := 0;
  v_would_reports_purge integer := 0;
  v_would_audit_summarize integer := 0;
  v_would_audit_purge integer := 0;
  v_would_rate_purge integer := 0;
  v_would_api_rate_purge integer := 0;
  v_would_counter_purge integer := 0;
  v_small_ttl_note text;
begin
  select * into v_cfg
  from public.ops_retention_config
  where id = true;

  if not found then
    raise exception 'ops_retention_config row is missing';
  end if;

  insert into public.ops_retention_runs (trigger_source, dry_run)
  values (coalesce(nullif(trim(p_trigger_source), ''), 'manual'), p_dry_run)
  returning id into v_run_id;

  if not v_cfg.enabled then
    update public.ops_retention_runs
    set finished_at = now(), success = true, note = 'retention disabled in ops_retention_config'
    where id = v_run_id;

    return jsonb_build_object('ok', true, 'disabled', true, 'runId', v_run_id, 'dryRun', p_dry_run);
  end if;

  v_small_ttl_note := null;
  if v_cfg.rate_limits_ttl_days <= 1 then
    v_small_ttl_note := 'blocked: rate_limits_ttl_days must be >= 2';
  elsif v_cfg.rate_limit_counters_grace_days <= 1 then
    v_small_ttl_note := 'blocked: rate_limit_counters_grace_days must be >= 2';
  end if;

  if v_small_ttl_note is not null then
    update public.ops_retention_runs
    set finished_at = now(), success = false, note = v_small_ttl_note
    where id = v_run_id;

    return jsonb_build_object(
      'ok', false,
      'blocked', true,
      'runId', v_run_id,
      'dryRun', p_dry_run,
      'reason', v_small_ttl_note
    );
  end if;

  select count(*)::integer
    into v_would_archive
  from public.community_reports r
  where r.status = 'resolved'
    and r.resolved_at is not null
    and r.resolved_at < now() - make_interval(days => v_cfg.community_reports_resolved_ttl_days)
    and not exists (
      select 1 from public.community_reports_archive a where a.id = r.id
    );

  select count(*)::integer
    into v_would_reports_purge
  from public.community_reports r
  where r.status = 'resolved'
    and r.resolved_at is not null
    and r.resolved_at < now() - make_interval(days => v_cfg.community_reports_resolved_ttl_days);

  select count(*)::integer
    into v_would_audit_summarize
  from (
    select 1
    from public.audit_logs a
    where a.created_at < now() - make_interval(days => v_cfg.audit_logs_ttl_days)
    group by (a.created_at at time zone 'utc')::date, a.action
  ) grouped;

  select count(*)::integer
    into v_would_audit_purge
  from public.audit_logs a
  where a.created_at < now() - make_interval(days => v_cfg.audit_logs_ttl_days);

  select count(*)::integer
    into v_would_rate_purge
  from public.rate_limits
  where window_start < now() - make_interval(days => v_cfg.rate_limits_ttl_days);

  select count(*)::integer
    into v_would_api_rate_purge
  from public.api_rate_limits
  where window_start < now() - make_interval(days => v_cfg.rate_limits_ttl_days);

  select count(*)::integer
    into v_would_counter_purge
  from public.rate_limit_counters
  where reset_at < now() - make_interval(days => v_cfg.rate_limit_counters_grace_days);

  if not p_dry_run then
    insert into public.community_reports_archive (
      id, target_type, target_id, reporter_user_id, reason, status,
      created_at, resolved_at, resolved_by_user_id, archived_at
    )
    select
      r.id, r.target_type, r.target_id, r.reporter_user_id, r.reason, r.status,
      r.created_at, r.resolved_at, r.resolved_by_user_id, now()
    from public.community_reports r
    where r.status = 'resolved'
      and r.resolved_at is not null
      and r.resolved_at < now() - make_interval(days => v_cfg.community_reports_resolved_ttl_days)
      and not exists (
        select 1 from public.community_reports_archive a where a.id = r.id
      );

    get diagnostics v_archived = row_count;

    delete from public.community_reports r
    where r.status = 'resolved'
      and r.resolved_at is not null
      and r.resolved_at < now() - make_interval(days => v_cfg.community_reports_resolved_ttl_days);

    get diagnostics v_purged_reports = row_count;

    insert into public.audit_logs_daily_summary (
      log_day, action, row_count, first_created_at, last_created_at, summarized_at
    )
    select
      (a.created_at at time zone 'utc')::date as log_day,
      a.action,
      count(*)::bigint as row_count,
      min(a.created_at) as first_created_at,
      max(a.created_at) as last_created_at,
      now() as summarized_at
    from public.audit_logs a
    where a.created_at < now() - make_interval(days => v_cfg.audit_logs_ttl_days)
    group by (a.created_at at time zone 'utc')::date, a.action
    on conflict (log_day, action)
    do update set
      row_count = excluded.row_count,
      first_created_at = excluded.first_created_at,
      last_created_at = excluded.last_created_at,
      summarized_at = excluded.summarized_at;

    get diagnostics v_audit_summarized = row_count;

    delete from public.audit_logs a
    where a.created_at < now() - make_interval(days => v_cfg.audit_logs_ttl_days);

    get diagnostics v_audit_purged = row_count;

    delete from public.rate_limits
    where window_start < now() - make_interval(days => v_cfg.rate_limits_ttl_days);
    get diagnostics v_rate_purged = row_count;

    delete from public.api_rate_limits
    where window_start < now() - make_interval(days => v_cfg.rate_limits_ttl_days);
    get diagnostics v_api_rate_purged = row_count;

    delete from public.rate_limit_counters
    where reset_at < now() - make_interval(days => v_cfg.rate_limit_counters_grace_days);
    get diagnostics v_counter_purged = row_count;
  end if;

  update public.ops_retention_runs
  set finished_at = now(),
      success = true,
      community_reports_archived = v_archived,
      community_reports_purged = v_purged_reports,
      audit_logs_summarized = v_audit_summarized,
      audit_logs_purged = v_audit_purged,
      rate_limits_purged = v_rate_purged,
      api_rate_limits_purged = v_api_rate_purged,
      rate_limit_counters_purged = v_counter_purged,
      would_community_reports_archived = v_would_archive,
      would_community_reports_purged = v_would_reports_purge,
      would_audit_logs_summarized = v_would_audit_summarize,
      would_audit_logs_purged = v_would_audit_purge,
      would_rate_limits_purged = v_would_rate_purge,
      would_api_rate_limits_purged = v_would_api_rate_purge,
      would_rate_limit_counters_purged = v_would_counter_purge,
      note = case
        when p_dry_run then 'dry_run: no archive/summarize/purge executed'
        else null
      end
  where id = v_run_id;

  return jsonb_build_object(
    'ok', true,
    'runId', v_run_id,
    'dryRun', p_dry_run,
    'communityReportsArchived', v_archived,
    'communityReportsPurged', v_purged_reports,
    'auditLogsSummarized', v_audit_summarized,
    'auditLogsPurged', v_audit_purged,
    'rateLimitsPurged', v_rate_purged,
    'apiRateLimitsPurged', v_api_rate_purged,
    'rateLimitCountersPurged', v_counter_purged,
    'wouldCommunityReportsArchived', v_would_archive,
    'wouldCommunityReportsPurged', v_would_reports_purge,
    'wouldAuditLogsSummarized', v_would_audit_summarize,
    'wouldAuditLogsPurged', v_would_audit_purge,
    'wouldRateLimitsPurged', v_would_rate_purge,
    'wouldApiRateLimitsPurged', v_would_api_rate_purge,
    'wouldRateLimitCountersPurged', v_would_counter_purge
  );
exception when others then
  if v_run_id is not null then
    update public.ops_retention_runs
    set finished_at = now(), success = false, note = left(sqlerrm, 400)
    where id = v_run_id;
  end if;
  raise;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_community_comment_moderation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_edu_feature_flags_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at_ws_published()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.storage_total_bytes()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(sum(coalesce(stored_bytes, size_bytes)), 0)::bigint
  from public.files
  where owner_id = auth.uid()
    and status = 'ready'
    and deduped is false;
$function$;

CREATE OR REPLACE FUNCTION public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.role() <> 'service_role' and input_user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  insert into public.storage_usage (user_id, bytes_used, bytes_saved_estimate, updated_at)
  values (input_user_id, input_used_bytes, input_saved_bytes, now())
  on conflict (user_id)
  do update set
    bytes_used = public.storage_usage.bytes_used + excluded.bytes_used,
    bytes_saved_estimate = public.storage_usage.bytes_saved_estimate + excluded.bytes_saved_estimate,
    updated_at = now();
end;
$function$;

CREATE OR REPLACE FUNCTION public.storage_usage_v1()
 RETURNS TABLE(total_bytes bigint, files_count bigint, images_bytes bigint, other_bytes bigint, recent_30d_bytes bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    coalesce(sum(f.size_bytes), 0)::bigint as total_bytes,
    coalesce(count(*), 0)::bigint as files_count,
    coalesce(sum(case when f.content_type like 'image/%' then f.size_bytes else 0 end), 0)::bigint as images_bytes,
    coalesce(sum(case when f.content_type like 'image/%' then 0 else f.size_bytes end), 0)::bigint as other_bytes,
    coalesce(
      sum(case when f.created_at >= now() - interval '30 days' then f.size_bytes else 0 end),
      0
    )::bigint as recent_30d_bytes
  from public.files f
  where f.owner_id = auth.uid()
    and f.status = 'ready';
$function$;

CREATE OR REPLACE FUNCTION public.storage_usage_v2()
 RETURNS TABLE(total_bytes bigint, files_count bigint, images_bytes bigint, other_bytes bigint, recent_30d_bytes bigint, original_total_bytes bigint, optimized_total_bytes bigint, saved_by_optimization_bytes bigint, saved_by_dedup_30d_bytes bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select
      f.content_type,
      f.created_at,
      coalesce(nullif(f.optimized_size_bytes, 0), f.stored_bytes, f.size_bytes) as optimized_bytes,
      coalesce(nullif(f.original_size_bytes, 0), f.original_bytes, f.size_bytes) as original_bytes
    from public.files f
    where f.owner_id = auth.uid()
      and f.status = 'ready'
  ),
  dedup as (
    select
      coalesce(sum(greatest(original_bytes - optimized_bytes, 0)), 0)::bigint as saved_by_dedup_30d_bytes
    from public.file_savings_events
    where user_id = auth.uid()
      and kind = 'dedup_reuse'
      and created_at >= now() - interval '30 days'
  )
  select
    coalesce(sum(optimized_bytes), 0)::bigint as total_bytes,
    coalesce(count(*), 0)::bigint as files_count,
    coalesce(sum(case when content_type like 'image/%' then optimized_bytes else 0 end), 0)::bigint as images_bytes,
    coalesce(sum(case when content_type like 'image/%' then 0 else optimized_bytes end), 0)::bigint as other_bytes,
    coalesce(sum(case when created_at >= now() - interval '30 days' then optimized_bytes else 0 end), 0)::bigint as recent_30d_bytes,
    coalesce(sum(original_bytes), 0)::bigint as original_total_bytes,
    coalesce(sum(optimized_bytes), 0)::bigint as optimized_total_bytes,
    greatest(coalesce(sum(original_bytes), 0) - coalesce(sum(optimized_bytes), 0), 0)::bigint as saved_by_optimization_bytes,
    (select saved_by_dedup_30d_bytes from dedup) as saved_by_dedup_30d_bytes
  from base;
$function$;

CREATE OR REPLACE FUNCTION public.template_library_decrement_likes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.template_library_items
    set likes_count = greatest(likes_count - 1, 0),
        updated_at = now()
    where id = old.template_id;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.template_library_handle_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  new_reports integer;
begin
  update public.template_library_items
    set reports_count = reports_count + 1,
        status = case when reports_count + 1 >= 3 then 'hidden' else status end,
        scope = case when reports_count + 1 >= 3 then 'community' else scope end,
        updated_at = now()
    where id = new.template_id
    returning reports_count into new_reports;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.template_library_increment_installs()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.template_library_items
    set installs_count = installs_count + 1,
        updated_at = now()
    where id = new.template_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.template_library_increment_likes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update public.template_library_items
    set likes_count = likes_count + 1,
        updated_at = now()
    where id = new.template_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.template_library_refresh_reviews()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  new_avg numeric(2,1);
  new_count integer;
begin
  select coalesce(avg(rating), 0), count(*)
    into new_avg, new_count
    from public.template_library_reviews
    where template_id = coalesce(new.template_id, old.template_id);

  update public.template_library_items
    set avg_rating = coalesce(round(new_avg::numeric, 1), 0),
        reviews_count = new_count,
        updated_at = now()
    where id = coalesce(new.template_id, old.template_id);

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$function$;

CREATE TRIGGER set_board_members_updated_at BEFORE UPDATE ON board_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_board_policies_updated_at BEFORE UPDATE ON board_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER board_questions_set_updated_at BEFORE UPDATE ON board_questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_board_share_settings_updated_at BEFORE UPDATE ON board_share_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_board_view_presets_updated_at BEFORE UPDATE ON board_view_presets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_class_session_controls_updated_at BEFORE UPDATE ON class_session_controls FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_class_session_questions_updated_at BEFORE UPDATE ON class_session_questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_class_showcases_updated_at BEFORE UPDATE ON class_showcases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER community_blocked_users_set_updated_at BEFORE UPDATE ON community_blocked_users FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

CREATE TRIGGER community_comment_moderation_set_updated_at BEFORE UPDATE ON community_comment_moderation FOR EACH ROW EXECUTE FUNCTION set_community_comment_moderation_updated_at();

CREATE TRIGGER community_comments_guard_moderation_fields BEFORE UPDATE ON community_comments FOR EACH ROW EXECUTE FUNCTION community_guard_moderation_fields();

CREATE TRIGGER community_comments_set_updated_at BEFORE UPDATE ON community_comments FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

CREATE TRIGGER community_moderators_set_updated_at BEFORE UPDATE ON community_moderators FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

CREATE TRIGGER community_posts_guard_moderation_fields BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION community_guard_moderation_fields();

CREATE TRIGGER community_posts_set_updated_at BEFORE UPDATE ON community_posts FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

CREATE TRIGGER community_reports_set_updated_at BEFORE UPDATE ON community_reports FOR EACH ROW EXECUTE FUNCTION community_set_updated_at();

CREATE TRIGGER set_coupon_codes_updated_at BEFORE UPDATE ON coupon_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_edu_assignments_updated_at BEFORE UPDATE ON edu_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_edu_classes_updated_at BEFORE UPDATE ON edu_classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_edu_feature_flags_updated_at BEFORE UPDATE ON edu_feature_flags FOR EACH ROW EXECUTE FUNCTION set_edu_feature_flags_updated_at();

CREATE TRIGGER set_edu_gallery_updated_at BEFORE UPDATE ON edu_gallery FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_edu_participants_updated_at BEFORE UPDATE ON edu_participants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_edu_project_feedback_updated_at BEFORE UPDATE ON edu_project_feedback FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_edu_projects_updated_at BEFORE UPDATE ON edu_projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER edu_publish_attempts_set_updated_at BEFORE UPDATE ON edu_publish_attempts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER edu_publish_slug_reservations_set_updated_at BEFORE UPDATE ON edu_publish_slug_reservations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_exhibits_updated_at BEFORE UPDATE ON exhibits FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_google_drive_preferences_updated_at BEFORE UPDATE ON google_drive_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_showcases_updated_at BEFORE UPDATE ON showcases FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER template_library_installs_after_insert AFTER INSERT ON template_library_installs FOR EACH ROW EXECUTE FUNCTION template_library_increment_installs();

CREATE TRIGGER template_library_prevent_hidden_republish BEFORE UPDATE ON template_library_items FOR EACH ROW EXECUTE FUNCTION prevent_hidden_republish();

CREATE TRIGGER template_library_likes_after_delete AFTER DELETE ON template_library_likes FOR EACH ROW EXECUTE FUNCTION template_library_decrement_likes();

CREATE TRIGGER template_library_likes_after_insert AFTER INSERT ON template_library_likes FOR EACH ROW EXECUTE FUNCTION template_library_increment_likes();

CREATE TRIGGER template_library_reports_after_insert AFTER INSERT ON template_library_reports FOR EACH ROW EXECUTE FUNCTION template_library_handle_report();

CREATE TRIGGER template_library_reviews_after_delete AFTER DELETE ON template_library_reviews FOR EACH ROW EXECUTE FUNCTION template_library_refresh_reviews();

CREATE TRIGGER template_library_reviews_after_insert AFTER INSERT ON template_library_reviews FOR EACH ROW EXECUTE FUNCTION template_library_refresh_reviews();

CREATE TRIGGER template_library_reviews_after_update AFTER UPDATE ON template_library_reviews FOR EACH ROW EXECUTE FUNCTION template_library_refresh_reviews();

CREATE TRIGGER template_reports_autohide AFTER INSERT ON template_reports FOR EACH ROW EXECUTE FUNCTION handle_template_report_autohide();

CREATE TRIGGER set_templates_updated_at_v1 BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_user_entitlements_updated_at BEFORE UPDATE ON user_entitlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_user_plans_updated_at BEFORE UPDATE ON user_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_user_ui_prefs_updated_at BEFORE UPDATE ON user_ui_prefs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_wall_cards_v2_updated_at BEFORE UPDATE ON wall_cards_v2 FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_wall_sections_v2_updated_at BEFORE UPDATE ON wall_sections_v2 FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_ws_published_updated_at BEFORE UPDATE ON website_studio_published_snapshots FOR EACH ROW EXECUTE FUNCTION set_updated_at_ws_published();

-- -----------------------------------------------------------------------------
-- RLS and policies
-- -----------------------------------------------------------------------------
alter table public.api_rate_limits enable row level security;

alter table public.audit_events enable row level security;

alter table public.audit_logs enable row level security;

alter table public.audit_logs_daily_summary enable row level security;

alter table public.billing_events enable row level security;

alter table public.board_controls enable row level security;

alter table public.board_files enable row level security;

alter table public.board_invites enable row level security;

alter table public.board_live_session enable row level security;

alter table public.board_members enable row level security;

alter table public.board_policies enable row level security;

alter table public.board_polls enable row level security;

alter table public.board_question_throttles enable row level security;

alter table public.board_questions enable row level security;

alter table public.board_share_settings enable row level security;

alter table public.board_view_presets enable row level security;

alter table public.boards enable row level security;

alter table public.card_files enable row level security;

alter table public.card_move_mutations enable row level security;

alter table public.card_tags enable row level security;

alter table public.cards enable row level security;

alter table public.class_sections enable row level security;

alter table public.class_session_bookmarks enable row level security;

alter table public.class_session_clip_shares enable row level security;

alter table public.class_session_controls enable row level security;

alter table public.class_session_events enable row level security;

alter table public.class_session_questions enable row level security;

alter table public.class_sessions enable row level security;

alter table public.class_showcase_items enable row level security;

alter table public.class_showcases enable row level security;

alter table public.classes enable row level security;

alter table public.community_blocked_users enable row level security;

alter table public.community_comment_moderation enable row level security;

alter table public.community_comment_reports enable row level security;

alter table public.community_comments enable row level security;

alter table public.community_moderators enable row level security;

alter table public.community_posts enable row level security;

alter table public.community_reactions enable row level security;

alter table public.community_reports enable row level security;

alter table public.community_reports_archive enable row level security;

alter table public.coupon_codes enable row level security;

alter table public.coupon_redemptions enable row level security;

alter table public.courseware_published_snapshots enable row level security;

alter table public.decorate_plan_cache enable row level security;

alter table public.edu_assignments enable row level security;

alter table public.edu_broadcasts enable row level security;

alter table public.edu_classes enable row level security;

alter table public.edu_feature_flags enable row level security;

alter table public.edu_featured_projects enable row level security;

alter table public.edu_gallery enable row level security;

alter table public.edu_join_codes enable row level security;

alter table public.edu_join_sessions enable row level security;

alter table public.edu_lesson_attendance_daily enable row level security;

alter table public.edu_lesson_completions_daily enable row level security;

alter table public.edu_participants enable row level security;

alter table public.edu_presentation_links enable row level security;

alter table public.edu_presentation_settings enable row level security;

alter table public.edu_project_feedback enable row level security;

alter table public.edu_project_files enable row level security;

alter table public.edu_project_stats enable row level security;

alter table public.edu_project_visibility enable row level security;

alter table public.edu_projects enable row level security;

alter table public.edu_publish_attempts enable row level security;

alter table public.edu_publish_slug_reservations enable row level security;

alter table public.edu_reports enable row level security;

alter table public.edu_submissions enable row level security;

alter table public.exhibit_versions enable row level security;

alter table public.exhibits enable row level security;

alter table public.file_savings_events enable row level security;

alter table public.files enable row level security;

alter table public.google_drive_preferences enable row level security;

alter table public.institution_requests enable row level security;

alter table public.lesson_activity_runs enable row level security;

alter table public.license_keys enable row level security;

alter table public.live_participants enable row level security;

alter table public.metaverse_progress_snapshots enable row level security;

alter table public.moderation_hides enable row level security;

alter table public.ops_banners enable row level security;

alter table public.ops_events enable row level security;

alter table public.ops_reports_backlog_runs enable row level security;

alter table public.ops_retention_config enable row level security;

alter table public.ops_retention_runs enable row level security;

alter table public.ops_user_assistant_runs enable row level security;

alter table public.ownership_requests enable row level security;

alter table public.poll_responses enable row level security;

alter table public.pro_waitlist enable row level security;

alter table public.public_showcase_snapshots enable row level security;

alter table public.public_showcase_tokens enable row level security;

alter table public.publish_events enable row level security;

alter table public.pulse_events enable row level security;

alter table public.rate_limit_counters enable row level security;

alter table public.rate_limits enable row level security;

alter table public.reports enable row level security;

alter table public.session_report_shares enable row level security;

alter table public.showcase_tokens enable row level security;

alter table public.showcases enable row level security;

alter table public.site_content enable row level security;
alter table public.site_content force row level security;

alter table public.site_content_revisions enable row level security;
alter table public.site_content_revisions force row level security;

alter table public.storage_objects enable row level security;

alter table public.storage_quota enable row level security;

alter table public.storage_usage enable row level security;

alter table public.storage_usage_daily enable row level security;

alter table public.student_activity_states enable row level security;

alter table public.student_app_class_sessions enable row level security;

alter table public.student_app_deployment_files enable row level security;

alter table public.student_app_deployments enable row level security;

alter table public.student_app_submission_files enable row level security;

alter table public.student_app_submissions enable row level security;

alter table public.student_requests enable row level security;

alter table public.tag_rules enable row level security;

alter table public.tags enable row level security;

alter table public.template_collection_items enable row level security;

alter table public.template_collections enable row level security;

alter table public.template_library_installs enable row level security;

alter table public.template_library_items enable row level security;

alter table public.template_library_likes enable row level security;

alter table public.template_library_reports enable row level security;

alter table public.template_library_reviews enable row level security;

alter table public.template_reports enable row level security;

alter table public.template_versions enable row level security;

alter table public.templates enable row level security;

alter table public.upgrade_requests enable row level security;

alter table public.user_entitlements enable row level security;

alter table public.user_onboarding enable row level security;

alter table public.user_plans enable row level security;

alter table public.user_ui_prefs enable row level security;

alter table public.wall_cards_v2 enable row level security;

alter table public.wall_sections_v2 enable row level security;

alter table public.walls enable row level security;

alter table public.website_studio_published_snapshots enable row level security;

drop policy if exists api_rate_limits__service_role_all on public.api_rate_limits;
create policy api_rate_limits__service_role_all on public.api_rate_limits as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists audit_events__service_role_all on public.audit_events;
create policy audit_events__service_role_all on public.audit_events as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Audit logs insertable by editors" on public.audit_logs;
create policy "Audit logs insertable by editors" on public.audit_logs as permissive for insert to public
  with check ((((board_id IS NOT NULL) AND (board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])) AND ((actor_user_id IS NULL) OR (actor_user_id = auth.uid()))) OR ((board_id IS NULL) AND (actor_user_id = auth.uid()))));

drop policy if exists "Audit logs selectable by board members" on public.audit_logs;
create policy "Audit logs selectable by board members" on public.audit_logs as permissive for select to public
  using ((((board_id IS NOT NULL) AND (board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text]))) OR ((board_id IS NULL) AND (actor_user_id = auth.uid()))));

drop policy if exists audit_logs_daily_summary_service_role_all on public.audit_logs_daily_summary;
create policy audit_logs_daily_summary_service_role_all on public.audit_logs_daily_summary as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists billing_events__service_role_all on public.billing_events;
create policy billing_events__service_role_all on public.billing_events as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists board_controls_insert on public.board_controls;
create policy board_controls_insert on public.board_controls as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists board_controls_select on public.board_controls;
create policy board_controls_select on public.board_controls as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists board_controls_update on public.board_controls;
create policy board_controls_update on public.board_controls as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Board files are deletable by owner" on public.board_files;
create policy "Board files are deletable by owner" on public.board_files as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Board files are insertable by owner" on public.board_files;
create policy "Board files are insertable by owner" on public.board_files as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Board files are updatable by owner" on public.board_files;
create policy "Board files are updatable by owner" on public.board_files as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Board files are viewable by owner" on public.board_files;
create policy "Board files are viewable by owner" on public.board_files as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Board invites manageable by owner" on public.board_invites;
create policy "Board invites manageable by owner" on public.board_invites as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_invites.board_id) AND (b.owner_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_invites.board_id) AND (b.owner_id = auth.uid())))));

drop policy if exists board_live_session_delete_authenticated on public.board_live_session;
create policy board_live_session_delete_authenticated on public.board_live_session as permissive for delete to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists board_live_session_insert_authenticated on public.board_live_session;
create policy board_live_session_insert_authenticated on public.board_live_session as permissive for insert to authenticated
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists board_live_session_select_authenticated on public.board_live_session;
create policy board_live_session_select_authenticated on public.board_live_session as permissive for select to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists board_live_session_service_role_all on public.board_live_session;
create policy board_live_session_service_role_all on public.board_live_session as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists board_live_session_update_authenticated on public.board_live_session;
create policy board_live_session_update_authenticated on public.board_live_session as permissive for update to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Board members deletable by owner" on public.board_members;
create policy "Board members deletable by owner" on public.board_members as permissive for delete to public
  using (is_board_owner(board_id));

drop policy if exists "Board members deletable by owner or self" on public.board_members;
create policy "Board members deletable by owner or self" on public.board_members as permissive for delete to public
  using (((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_members.board_id) AND (b.owner_id = auth.uid())))) OR (user_id = auth.uid())));

drop policy if exists "Board members insertable by owner" on public.board_members;
create policy "Board members insertable by owner" on public.board_members as permissive for insert to public
  with check (is_board_owner(board_id));

drop policy if exists "Board members selectable by board role" on public.board_members;
create policy "Board members selectable by board role" on public.board_members as permissive for select to public
  using ((board_role(board_id) IS NOT NULL));

drop policy if exists "Board members updatable by owner" on public.board_members;
create policy "Board members updatable by owner" on public.board_members as permissive for update to public
  using (is_board_owner(board_id))
  with check (is_board_owner(board_id));

drop policy if exists "Board members viewable by owner/members" on public.board_members;
create policy "Board members viewable by owner/members" on public.board_members as permissive for select to authenticated
  using ((user_id = auth.uid()));

drop policy if exists "Board policies deletable by owner" on public.board_policies;
create policy "Board policies deletable by owner" on public.board_policies as permissive for delete to public
  using ((board_role(board_id) = 'owner'::text));

drop policy if exists "Board policies insertable by owner" on public.board_policies;
create policy "Board policies insertable by owner" on public.board_policies as permissive for insert to public
  with check ((board_role(board_id) = 'owner'::text));

drop policy if exists "Board policies selectable by members" on public.board_policies;
create policy "Board policies selectable by members" on public.board_policies as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Board policies updatable by owner" on public.board_policies;
create policy "Board policies updatable by owner" on public.board_policies as permissive for update to public
  using ((board_role(board_id) = 'owner'::text))
  with check ((board_role(board_id) = 'owner'::text));

drop policy if exists board_polls_service_role_all on public.board_polls;
create policy board_polls_service_role_all on public.board_polls as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists board_question_throttles_service_role_all on public.board_question_throttles;
create policy board_question_throttles_service_role_all on public.board_question_throttles as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists board_questions_service_role_all on public.board_questions;
create policy board_questions_service_role_all on public.board_questions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Board share settings deletable by owner" on public.board_share_settings;
create policy "Board share settings deletable by owner" on public.board_share_settings as permissive for delete to public
  using ((board_role(board_id) = 'owner'::text));

drop policy if exists "Board share settings insertable by owner" on public.board_share_settings;
create policy "Board share settings insertable by owner" on public.board_share_settings as permissive for insert to public
  with check ((board_role(board_id) = 'owner'::text));

drop policy if exists "Board share settings selectable by members" on public.board_share_settings;
create policy "Board share settings selectable by members" on public.board_share_settings as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Board share settings updatable by owner" on public.board_share_settings;
create policy "Board share settings updatable by owner" on public.board_share_settings as permissive for update to public
  using ((board_role(board_id) = 'owner'::text))
  with check ((board_role(board_id) = 'owner'::text));

drop policy if exists "Board view presets are deletable by owner" on public.board_view_presets;
create policy "Board view presets are deletable by owner" on public.board_view_presets as permissive for delete to public
  using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_view_presets.board_id) AND (b.owner_id = auth.uid()))))));

drop policy if exists "Board view presets are insertable by owner" on public.board_view_presets;
create policy "Board view presets are insertable by owner" on public.board_view_presets as permissive for insert to public
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_view_presets.board_id) AND (b.owner_id = auth.uid()))))));

drop policy if exists "Board view presets are updatable by owner" on public.board_view_presets;
create policy "Board view presets are updatable by owner" on public.board_view_presets as permissive for update to public
  using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_view_presets.board_id) AND (b.owner_id = auth.uid()))))))
  with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_view_presets.board_id) AND (b.owner_id = auth.uid()))))));

drop policy if exists "Board view presets are viewable by owner" on public.board_view_presets;
create policy "Board view presets are viewable by owner" on public.board_view_presets as permissive for select to public
  using (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = board_view_presets.board_id) AND (b.owner_id = auth.uid()))))));

drop policy if exists "Boards are deletable by owner" on public.boards;
create policy "Boards are deletable by owner" on public.boards as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Boards are insertable by owner" on public.boards;
create policy "Boards are insertable by owner" on public.boards as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Boards are updatable by owner" on public.boards;
create policy "Boards are updatable by owner" on public.boards as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Boards are viewable by owner" on public.boards;
create policy "Boards are viewable by owner" on public.boards as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Boards deletable by owner" on public.boards;
create policy "Boards deletable by owner" on public.boards as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Boards insertable by owner" on public.boards;
create policy "Boards insertable by owner" on public.boards as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Boards selectable by owner or member" on public.boards;
create policy "Boards selectable by owner or member" on public.boards as permissive for select to public
  using (((owner_id = auth.uid()) OR is_board_member(id)));

drop policy if exists "Boards updatable by owner or editor" on public.boards;
create policy "Boards updatable by owner or editor" on public.boards as permissive for update to public
  using (((owner_id = auth.uid()) OR (board_role(id) = ANY (ARRAY['editor'::text, 'owner'::text]))))
  with check (((owner_id = auth.uid()) OR (board_role(id) = ANY (ARRAY['editor'::text, 'owner'::text]))));

drop policy if exists "Boards viewable by members" on public.boards;
create policy "Boards viewable by members" on public.boards as permissive for select to public
  using (((owner_id = auth.uid()) OR is_board_member(id)));

drop policy if exists "Card files deletable by owning editors" on public.card_files;
create policy "Card files deletable by owning editors" on public.card_files as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN board_files bf ON ((bf.id = card_files.board_file_id)))
  WHERE ((c.id = card_files.card_id) AND (bf.board_id = w.board_id) AND (bf.owner_id = ( SELECT auth.uid() AS uid)) AND (( SELECT board_role(w.board_id) AS board_role) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Card files insertable by owning editors" on public.card_files;
create policy "Card files insertable by owning editors" on public.card_files as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN board_files bf ON ((bf.id = card_files.board_file_id)))
  WHERE ((c.id = card_files.card_id) AND (bf.board_id = w.board_id) AND (bf.owner_id = ( SELECT auth.uid() AS uid)) AND (( SELECT board_role(w.board_id) AS board_role) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Card files viewable by owning editors" on public.card_files;
create policy "Card files viewable by owning editors" on public.card_files as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN board_files bf ON ((bf.id = card_files.board_file_id)))
  WHERE ((c.id = card_files.card_id) AND (bf.board_id = w.board_id) AND (bf.owner_id = ( SELECT auth.uid() AS uid)) AND (( SELECT board_role(w.board_id) AS board_role) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Card tags deletable by editors" on public.card_tags;
create policy "Card tags deletable by editors" on public.card_tags as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = card_tags.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Card tags insertable by editors" on public.card_tags;
create policy "Card tags insertable by editors" on public.card_tags as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN tags t ON ((t.id = card_tags.tag_id)))
  WHERE ((c.id = card_tags.card_id) AND (t.board_id = w.board_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Card tags selectable by members" on public.card_tags;
create policy "Card tags selectable by members" on public.card_tags as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = card_tags.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text]))))));

drop policy if exists "Card tags updatable by editors" on public.card_tags;
create policy "Card tags updatable by editors" on public.card_tags as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = card_tags.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN tags t ON ((t.id = card_tags.tag_id)))
  WHERE ((c.id = card_tags.card_id) AND (t.board_id = w.board_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Cards are deletable by owner" on public.cards;
create policy "Cards are deletable by owner" on public.cards as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Cards are insertable by owner" on public.cards;
create policy "Cards are insertable by owner" on public.cards as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Cards are updatable by owner" on public.cards;
create policy "Cards are updatable by owner" on public.cards as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Cards are viewable by owner" on public.cards;
create policy "Cards are viewable by owner" on public.cards as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Cards deletable by editors" on public.cards;
create policy "Cards deletable by editors" on public.cards as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM walls w
  WHERE ((w.id = cards.wall_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Cards updatable by editors" on public.cards;
create policy "Cards updatable by editors" on public.cards as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM walls w
  WHERE ((w.id = cards.wall_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM walls w
  WHERE ((w.id = cards.wall_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Cards viewable by members" on public.cards;
create policy "Cards viewable by members" on public.cards as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (walls w
     JOIN boards b ON ((b.id = w.board_id)))
  WHERE ((w.id = cards.wall_id) AND ((b.owner_id = auth.uid()) OR is_board_member(w.board_id))))));

drop policy if exists "Cards writable by editors" on public.cards;
create policy "Cards writable by editors" on public.cards as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM walls w
  WHERE ((w.id = cards.wall_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Class sections deletable by creator" on public.class_sections;
create policy "Class sections deletable by creator" on public.class_sections as permissive for delete to public
  using ((created_by = auth.uid()));

drop policy if exists "Class sections insertable by creator" on public.class_sections;
create policy "Class sections insertable by creator" on public.class_sections as permissive for insert to public
  with check ((created_by = auth.uid()));

drop policy if exists "Class sections updatable by creator" on public.class_sections;
create policy "Class sections updatable by creator" on public.class_sections as permissive for update to public
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

drop policy if exists "Class sections viewable by creator" on public.class_sections;
create policy "Class sections viewable by creator" on public.class_sections as permissive for select to public
  using ((created_by = auth.uid()));

drop policy if exists "Class session bookmarks deletable by members" on public.class_session_bookmarks;
create policy "Class session bookmarks deletable by members" on public.class_session_bookmarks as permissive for delete to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session bookmarks insertable by members" on public.class_session_bookmarks;
create policy "Class session bookmarks insertable by members" on public.class_session_bookmarks as permissive for insert to authenticated
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session bookmarks selectable by members" on public.class_session_bookmarks;
create policy "Class session bookmarks selectable by members" on public.class_session_bookmarks as permissive for select to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session bookmarks updatable by members" on public.class_session_bookmarks;
create policy "Class session bookmarks updatable by members" on public.class_session_bookmarks as permissive for update to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session clip shares delete by authenticated" on public.class_session_clip_shares;
create policy "Class session clip shares delete by authenticated" on public.class_session_clip_shares as permissive for delete to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session clip shares insert by authenticated" on public.class_session_clip_shares;
create policy "Class session clip shares insert by authenticated" on public.class_session_clip_shares as permissive for insert to authenticated
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session clip shares readable" on public.class_session_clip_shares;
create policy "Class session clip shares readable" on public.class_session_clip_shares as permissive for select to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session clip shares update by authenticated" on public.class_session_clip_shares;
create policy "Class session clip shares update by authenticated" on public.class_session_clip_shares as permissive for update to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session controls delete by authenticated" on public.class_session_controls;
create policy "Class session controls delete by authenticated" on public.class_session_controls as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_controls.session_id) AND (is_board_owner(cs.board_id) OR is_board_member(cs.board_id))))));

drop policy if exists "Class session controls insert by authenticated" on public.class_session_controls;
create policy "Class session controls insert by authenticated" on public.class_session_controls as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_controls.session_id) AND (is_board_owner(cs.board_id) OR is_board_member(cs.board_id))))));

drop policy if exists "Class session controls readable" on public.class_session_controls;
create policy "Class session controls readable" on public.class_session_controls as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_controls.session_id) AND (is_board_owner(cs.board_id) OR is_board_member(cs.board_id))))));

drop policy if exists "Class session controls update by authenticated" on public.class_session_controls;
create policy "Class session controls update by authenticated" on public.class_session_controls as permissive for update to authenticated
  using ((EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_controls.session_id) AND (is_board_owner(cs.board_id) OR is_board_member(cs.board_id))))))
  with check ((EXISTS ( SELECT 1
   FROM class_sessions cs
  WHERE ((cs.id = class_session_controls.session_id) AND (is_board_owner(cs.board_id) OR is_board_member(cs.board_id))))));

drop policy if exists "Class session events deletable by members" on public.class_session_events;
create policy "Class session events deletable by members" on public.class_session_events as permissive for delete to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session events insertable by members" on public.class_session_events;
create policy "Class session events insertable by members" on public.class_session_events as permissive for insert to authenticated
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session events selectable by members" on public.class_session_events;
create policy "Class session events selectable by members" on public.class_session_events as permissive for select to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session events updatable by members" on public.class_session_events;
create policy "Class session events updatable by members" on public.class_session_events as permissive for update to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session questions delete by authenticated" on public.class_session_questions;
create policy "Class session questions delete by authenticated" on public.class_session_questions as permissive for delete to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session questions insert by authenticated" on public.class_session_questions;
create policy "Class session questions insert by authenticated" on public.class_session_questions as permissive for insert to authenticated
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session questions readable" on public.class_session_questions;
create policy "Class session questions readable" on public.class_session_questions as permissive for select to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class session questions update by authenticated" on public.class_session_questions;
create policy "Class session questions update by authenticated" on public.class_session_questions as permissive for update to authenticated
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class sessions deletable by creator" on public.class_sessions;
create policy "Class sessions deletable by creator" on public.class_sessions as permissive for delete to public
  using ((created_by = auth.uid()));

drop policy if exists "Class sessions deletable by owner" on public.class_sessions;
create policy "Class sessions deletable by owner" on public.class_sessions as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = class_sessions.board_id) AND (b.owner_id = auth.uid())))));

drop policy if exists "Class sessions insertable by creator" on public.class_sessions;
create policy "Class sessions insertable by creator" on public.class_sessions as permissive for insert to public
  with check ((created_by = auth.uid()));

drop policy if exists "Class sessions updatable by creator" on public.class_sessions;
create policy "Class sessions updatable by creator" on public.class_sessions as permissive for update to public
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

drop policy if exists "Class sessions updatable by editors" on public.class_sessions;
create policy "Class sessions updatable by editors" on public.class_sessions as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Class sessions viewable by creator" on public.class_sessions;
create policy "Class sessions viewable by creator" on public.class_sessions as permissive for select to public
  using ((created_by = auth.uid()));

drop policy if exists "Class sessions viewable by members" on public.class_sessions;
create policy "Class sessions viewable by members" on public.class_sessions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = class_sessions.board_id) AND ((b.owner_id = auth.uid()) OR is_board_member(class_sessions.board_id))))));

drop policy if exists "Class sessions writable by editors" on public.class_sessions;
create policy "Class sessions writable by editors" on public.class_sessions as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists class_sessions_delete_board_members on public.class_sessions;
create policy class_sessions_delete_board_members on public.class_sessions as permissive for delete to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists class_sessions_insert_board_members on public.class_sessions;
create policy class_sessions_insert_board_members on public.class_sessions as permissive for insert to public
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists class_sessions_select_board_members on public.class_sessions;
create policy class_sessions_select_board_members on public.class_sessions as permissive for select to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists class_sessions_update_board_members on public.class_sessions;
create policy class_sessions_update_board_members on public.class_sessions as permissive for update to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Class showcase items owned by creator" on public.class_showcase_items;
create policy "Class showcase items owned by creator" on public.class_showcase_items as permissive for all to public
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

drop policy if exists "Class showcases owned by creator" on public.class_showcases;
create policy "Class showcases owned by creator" on public.class_showcases as permissive for all to public
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

drop policy if exists "Classes are deletable by owner" on public.classes;
create policy "Classes are deletable by owner" on public.classes as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Classes are insertable by owner" on public.classes;
create policy "Classes are insertable by owner" on public.classes as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Classes are updatable by owner" on public.classes;
create policy "Classes are updatable by owner" on public.classes as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Classes are viewable by owner" on public.classes;
create policy "Classes are viewable by owner" on public.classes as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists community_blocked_users_select_own_or_mod on public.community_blocked_users;
create policy community_blocked_users_select_own_or_mod on public.community_blocked_users as permissive for select to authenticated
  using (((auth.uid() = user_id) OR community_is_moderator(auth.uid())));

drop policy if exists community_blocked_users_write_mod on public.community_blocked_users;
create policy community_blocked_users_write_mod on public.community_blocked_users as permissive for all to authenticated
  using (community_is_moderator(auth.uid()))
  with check (community_is_moderator(auth.uid()));

drop policy if exists community_comment_moderation_service_role_all on public.community_comment_moderation;
create policy community_comment_moderation_service_role_all on public.community_comment_moderation as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists community_comment_reports_insert_own on public.community_comment_reports;
create policy community_comment_reports_insert_own on public.community_comment_reports as permissive for insert to authenticated
  with check ((reporter_user_id = auth.uid()));

drop policy if exists community_comment_reports_select_own on public.community_comment_reports;
create policy community_comment_reports_select_own on public.community_comment_reports as permissive for select to authenticated
  using ((reporter_user_id = auth.uid()));

drop policy if exists community_comments_delete_owner_or_mod on public.community_comments;
create policy community_comments_delete_owner_or_mod on public.community_comments as permissive for delete to authenticated
  using (((auth.uid() = author_user_id) OR community_is_moderator(auth.uid())));

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert on public.community_comments as permissive for insert to authenticated
  with check (((auth.uid() = author_user_id) AND (NOT community_is_blocked(auth.uid()))));

drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments as permissive for select to authenticated
  using (((deleted_at IS NULL) AND ((status = 'active'::text) OR community_is_moderator(auth.uid()))));

drop policy if exists community_comments_soft_delete_owner_or_mod on public.community_comments;
create policy community_comments_soft_delete_owner_or_mod on public.community_comments as permissive for update to authenticated
  using (((auth.uid() = author_user_id) OR community_is_moderator(auth.uid())))
  with check (((auth.uid() = author_user_id) OR community_is_moderator(auth.uid())));

drop policy if exists community_moderators_select_mod on public.community_moderators;
create policy community_moderators_select_mod on public.community_moderators as permissive for select to authenticated
  using (community_is_moderator(auth.uid()));

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts as permissive for insert to authenticated
  with check (((auth.uid() = author_user_id) AND (NOT community_is_blocked(auth.uid())) AND (is_pinned = false) AND ((category = ANY (ARRAY['free'::text, 'edu'::text, 'qna'::text])) OR ((category = ANY (ARRAY['usage'::text, 'updates'::text])) AND community_is_moderator(auth.uid())))));

drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts as permissive for select to public
  using (((status = 'active'::text) OR community_is_moderator(auth.uid())));

drop policy if exists community_posts_update_owner_or_mod on public.community_posts;
create policy community_posts_update_owner_or_mod on public.community_posts as permissive for update to authenticated
  using (((auth.uid() = author_user_id) OR community_is_moderator(auth.uid())))
  with check ((((auth.uid() = author_user_id) AND (status = 'active'::text) AND (is_pinned = false) AND (category = ANY (ARRAY['free'::text, 'edu'::text, 'qna'::text]))) OR community_is_moderator(auth.uid())));

drop policy if exists community_reactions_delete_own on public.community_reactions;
create policy community_reactions_delete_own on public.community_reactions as permissive for delete to authenticated
  using ((auth.uid() = user_id));

drop policy if exists community_reactions_insert on public.community_reactions;
create policy community_reactions_insert on public.community_reactions as permissive for insert to authenticated
  with check (((auth.uid() = user_id) AND (NOT community_is_blocked(auth.uid()))));

drop policy if exists community_reactions_select on public.community_reactions;
create policy community_reactions_select on public.community_reactions as permissive for select to public
  using (true);

drop policy if exists community_reports_insert on public.community_reports;
create policy community_reports_insert on public.community_reports as permissive for insert to authenticated
  with check (((auth.uid() = reporter_user_id) AND (NOT community_is_blocked(auth.uid()))));

drop policy if exists community_reports_select_own_or_mod on public.community_reports;
create policy community_reports_select_own_or_mod on public.community_reports as permissive for select to authenticated
  using (((auth.uid() = reporter_user_id) OR community_is_moderator(auth.uid())));

drop policy if exists community_reports_update_mod on public.community_reports;
create policy community_reports_update_mod on public.community_reports as permissive for update to authenticated
  using (community_is_moderator(auth.uid()))
  with check (community_is_moderator(auth.uid()));

drop policy if exists community_reports_archive_service_role_all on public.community_reports_archive;
create policy community_reports_archive_service_role_all on public.community_reports_archive as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists coupon_codes__service_role_all on public.coupon_codes;
create policy coupon_codes__service_role_all on public.coupon_codes as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists coupon_redemptions__service_role_all on public.coupon_redemptions;
create policy coupon_redemptions__service_role_all on public.coupon_redemptions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists courseware_published_snapshots__service_role_all on public.courseware_published_snapshots;
create policy courseware_published_snapshots__service_role_all on public.courseware_published_snapshots as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists decorate_plan_cache_service_role_all on public.decorate_plan_cache;
create policy decorate_plan_cache_service_role_all on public.decorate_plan_cache as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_assignments_service_role_all on public.edu_assignments;
create policy edu_assignments_service_role_all on public.edu_assignments as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_broadcasts_service_role_all on public.edu_broadcasts;
create policy edu_broadcasts_service_role_all on public.edu_broadcasts as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_classes_service_role_all on public.edu_classes;
create policy edu_classes_service_role_all on public.edu_classes as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_feature_flags__service_role_all on public.edu_feature_flags;
create policy edu_feature_flags__service_role_all on public.edu_feature_flags as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_featured_projects_service_role_all on public.edu_featured_projects;
create policy edu_featured_projects_service_role_all on public.edu_featured_projects as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_gallery_service_role_all on public.edu_gallery;
create policy edu_gallery_service_role_all on public.edu_gallery as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_join_codes__service_role_all on public.edu_join_codes;
create policy edu_join_codes__service_role_all on public.edu_join_codes as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_join_sessions_service_role_all on public.edu_join_sessions;
create policy edu_join_sessions_service_role_all on public.edu_join_sessions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_lesson_attendance_daily_service_role_all on public.edu_lesson_attendance_daily;
create policy edu_lesson_attendance_daily_service_role_all on public.edu_lesson_attendance_daily as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_lesson_completions_daily_service_role_all on public.edu_lesson_completions_daily;
create policy edu_lesson_completions_daily_service_role_all on public.edu_lesson_completions_daily as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_participants_service_role_all on public.edu_participants;
create policy edu_participants_service_role_all on public.edu_participants as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_presentation_links_service_role_all on public.edu_presentation_links;
create policy edu_presentation_links_service_role_all on public.edu_presentation_links as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_presentation_settings__service_role_all on public.edu_presentation_settings;
create policy edu_presentation_settings__service_role_all on public.edu_presentation_settings as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_project_feedback_service_role_all on public.edu_project_feedback;
create policy edu_project_feedback_service_role_all on public.edu_project_feedback as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_project_files_service_role_all on public.edu_project_files;
create policy edu_project_files_service_role_all on public.edu_project_files as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_project_stats_service_role_all on public.edu_project_stats;
create policy edu_project_stats_service_role_all on public.edu_project_stats as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_project_visibility_service_role_all on public.edu_project_visibility;
create policy edu_project_visibility_service_role_all on public.edu_project_visibility as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_projects_service_role_all on public.edu_projects;
create policy edu_projects_service_role_all on public.edu_projects as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_publish_attempts_service_role_all on public.edu_publish_attempts;
create policy edu_publish_attempts_service_role_all on public.edu_publish_attempts as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_publish_slug_reservations_service_role_all on public.edu_publish_slug_reservations;
create policy edu_publish_slug_reservations_service_role_all on public.edu_publish_slug_reservations as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_reports_service_role_all on public.edu_reports;
create policy edu_reports_service_role_all on public.edu_reports as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists edu_submissions_service_role_all on public.edu_submissions;
create policy edu_submissions_service_role_all on public.edu_submissions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Exhibit versions owned by creator" on public.exhibit_versions;
create policy "Exhibit versions owned by creator" on public.exhibit_versions as permissive for all to public
  using ((exhibit_id IN ( SELECT exhibits.id
   FROM exhibits
  WHERE (exhibits.owner_id = auth.uid()))))
  with check ((exhibit_id IN ( SELECT exhibits.id
   FROM exhibits
  WHERE (exhibits.owner_id = auth.uid()))));

drop policy if exists "Exhibits owned by creator" on public.exhibits;
create policy "Exhibits owned by creator" on public.exhibits as permissive for all to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "File savings events are insertable by owner" on public.file_savings_events;
create policy "File savings events are insertable by owner" on public.file_savings_events as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "File savings events are viewable by owner" on public.file_savings_events;
create policy "File savings events are viewable by owner" on public.file_savings_events as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "Files are deletable by owner" on public.files;
create policy "Files are deletable by owner" on public.files as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Files are insertable by owner" on public.files;
create policy "Files are insertable by owner" on public.files as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Files are updatable by owner" on public.files;
create policy "Files are updatable by owner" on public.files as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Files are viewable by owner" on public.files;
create policy "Files are viewable by owner" on public.files as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Files deletable by editors" on public.files;
create policy "Files deletable by editors" on public.files as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = files.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Files updatable by editors" on public.files;
create policy "Files updatable by editors" on public.files as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = files.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = files.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Files viewable by members" on public.files;
create policy "Files viewable by members" on public.files as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM ((cards c
     JOIN walls w ON ((w.id = c.wall_id)))
     JOIN boards b ON ((b.id = w.board_id)))
  WHERE ((c.id = files.card_id) AND ((b.owner_id = auth.uid()) OR is_board_member(w.board_id))))));

drop policy if exists "Files writable by editors" on public.files;
create policy "Files writable by editors" on public.files as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM (cards c
     JOIN walls w ON ((w.id = c.wall_id)))
  WHERE ((c.id = files.card_id) AND (board_role(w.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Google Drive preferences are deletable by owner" on public.google_drive_preferences;
create policy "Google Drive preferences are deletable by owner" on public.google_drive_preferences as permissive for delete to public
  using ((user_id = auth.uid()));

drop policy if exists "Google Drive preferences are insertable by owner" on public.google_drive_preferences;
create policy "Google Drive preferences are insertable by owner" on public.google_drive_preferences as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "Google Drive preferences are readable by owner" on public.google_drive_preferences;
create policy "Google Drive preferences are readable by owner" on public.google_drive_preferences as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "Google Drive preferences are updatable by owner" on public.google_drive_preferences;
create policy "Google Drive preferences are updatable by owner" on public.google_drive_preferences as permissive for update to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

drop policy if exists "Requester can insert institution request" on public.institution_requests;
create policy "Requester can insert institution request" on public.institution_requests as permissive for insert to public
  with check ((requester_user_id = auth.uid()));

drop policy if exists "Requester can read own institution request" on public.institution_requests;
create policy "Requester can read own institution request" on public.institution_requests as permissive for select to public
  using ((requester_user_id = auth.uid()));

drop policy if exists lesson_activity_runs_service_role_all on public.lesson_activity_runs;
create policy lesson_activity_runs_service_role_all on public.lesson_activity_runs as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists license_keys__service_role_all on public.license_keys;
create policy license_keys__service_role_all on public.license_keys as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists live_participants_service_role_all on public.live_participants;
create policy live_participants_service_role_all on public.live_participants as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists metaverse_progress_snapshots__owner_update on public.metaverse_progress_snapshots;
create policy metaverse_progress_snapshots__owner_update on public.metaverse_progress_snapshots as permissive for update to authenticated
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

drop policy if exists metaverse_progress_snapshots__owner_select on public.metaverse_progress_snapshots;
create policy metaverse_progress_snapshots__owner_select on public.metaverse_progress_snapshots as permissive for select to authenticated
  using ((auth.uid() = user_id));

drop policy if exists metaverse_progress_snapshots__owner_insert on public.metaverse_progress_snapshots;
create policy metaverse_progress_snapshots__owner_insert on public.metaverse_progress_snapshots as permissive for insert to authenticated
  with check ((auth.uid() = user_id));

drop policy if exists moderation_hides__service_role_all on public.moderation_hides;
create policy moderation_hides__service_role_all on public.moderation_hides as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_banners__service_role_all on public.ops_banners;
create policy ops_banners__service_role_all on public.ops_banners as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_events_service_role_all on public.ops_events;
create policy ops_events_service_role_all on public.ops_events as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_reports_backlog_runs_service_role_all on public.ops_reports_backlog_runs;
create policy ops_reports_backlog_runs_service_role_all on public.ops_reports_backlog_runs as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_retention_config_service_role_all on public.ops_retention_config;
create policy ops_retention_config_service_role_all on public.ops_retention_config as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_retention_runs_service_role_all on public.ops_retention_runs;
create policy ops_retention_runs_service_role_all on public.ops_retention_runs as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ops_user_assistant_runs_service_role_all on public.ops_user_assistant_runs;
create policy ops_user_assistant_runs_service_role_all on public.ops_user_assistant_runs as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists ownership_requests_service_role_all on public.ownership_requests;
create policy ownership_requests_service_role_all on public.ownership_requests as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists poll_responses_service_role_all on public.poll_responses;
create policy poll_responses_service_role_all on public.poll_responses as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists pro_waitlist_service_role_all on public.pro_waitlist;
create policy pro_waitlist_service_role_all on public.pro_waitlist as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Showcase snapshots accessible to all" on public.public_showcase_snapshots;
create policy "Showcase snapshots accessible to all" on public.public_showcase_snapshots as permissive for select to public
  using (true);

drop policy if exists "Showcase tokens managed by creator" on public.public_showcase_tokens;
create policy "Showcase tokens managed by creator" on public.public_showcase_tokens as permissive for all to public
  using ((created_by = auth.uid()))
  with check ((created_by = auth.uid()));

drop policy if exists publish_events_service_role_all on public.publish_events;
create policy publish_events_service_role_all on public.publish_events as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists pulse_events_service_role_all on public.pulse_events;
create policy pulse_events_service_role_all on public.pulse_events as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists rate_limit_counters__service_role_all on public.rate_limit_counters;
create policy rate_limit_counters__service_role_all on public.rate_limit_counters as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists rate_limits_service_role_all on public.rate_limits;
create policy rate_limits_service_role_all on public.rate_limits as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists reports__service_role_all on public.reports;
create policy reports__service_role_all on public.reports as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists session_report_shares_delete_board_members on public.session_report_shares;
create policy session_report_shares_delete_board_members on public.session_report_shares as permissive for delete to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists session_report_shares_insert_board_members on public.session_report_shares;
create policy session_report_shares_insert_board_members on public.session_report_shares as permissive for insert to public
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists session_report_shares_select_board_members on public.session_report_shares;
create policy session_report_shares_select_board_members on public.session_report_shares as permissive for select to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists session_report_shares_update_board_members on public.session_report_shares;
create policy session_report_shares_update_board_members on public.session_report_shares as permissive for update to public
  using ((is_board_owner(board_id) OR is_board_member(board_id)))
  with check ((is_board_owner(board_id) OR is_board_member(board_id)));

drop policy if exists "Showcase tokens owned by creator" on public.showcase_tokens;
create policy "Showcase tokens owned by creator" on public.showcase_tokens as permissive for all to public
  using ((showcase_id IN ( SELECT showcases.id
   FROM showcases
  WHERE (showcases.owner_id = auth.uid()))))
  with check ((showcase_id IN ( SELECT showcases.id
   FROM showcases
  WHERE (showcases.owner_id = auth.uid()))));

drop policy if exists "Showcases owned by creator" on public.showcases;
create policy "Showcases owned by creator" on public.showcases as permissive for all to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists site_content_service_role_all on public.site_content;
create policy site_content_service_role_all on public.site_content as permissive for all to service_role
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

drop policy if exists site_content_revisions__service_role_all on public.site_content_revisions;
create policy site_content_revisions__service_role_all on public.site_content_revisions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Storage objects are insertable by owner" on public.storage_objects;
create policy "Storage objects are insertable by owner" on public.storage_objects as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Storage objects are updatable by owner" on public.storage_objects;
create policy "Storage objects are updatable by owner" on public.storage_objects as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Storage objects are viewable by owner" on public.storage_objects;
create policy "Storage objects are viewable by owner" on public.storage_objects as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Storage quota is viewable by owner" on public.storage_quota;
create policy "Storage quota is viewable by owner" on public.storage_quota as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Storage usage is insertable by owner" on public.storage_usage;
create policy "Storage usage is insertable by owner" on public.storage_usage as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "Storage usage is updatable by owner" on public.storage_usage;
create policy "Storage usage is updatable by owner" on public.storage_usage as permissive for update to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

drop policy if exists "Storage usage is viewable by owner" on public.storage_usage;
create policy "Storage usage is viewable by owner" on public.storage_usage as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "Storage usage daily is viewable by owner" on public.storage_usage_daily;
create policy "Storage usage daily is viewable by owner" on public.storage_usage_daily as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists student_activity_states_service_role_all on public.student_activity_states;
create policy student_activity_states_service_role_all on public.student_activity_states as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists student_app_class_sessions_service_role_all on public.student_app_class_sessions;
create policy student_app_class_sessions_service_role_all on public.student_app_class_sessions as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Student requests insertable by public" on public.student_requests;
create policy "Student requests insertable by public" on public.student_requests as permissive for insert to public
  with check ((auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text])));

drop policy if exists "Student requests selectable by anon" on public.student_requests;
create policy "Student requests selectable by anon" on public.student_requests as permissive for select to public
  using (((auth.role() = 'anon'::text) AND (anon_id = COALESCE((auth.jwt() ->> 'anon_id'::text), ''::text))));

drop policy if exists "Student requests selectable by members" on public.student_requests;
create policy "Student requests selectable by members" on public.student_requests as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Student requests updatable by members" on public.student_requests;
create policy "Student requests updatable by members" on public.student_requests as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Tag rules deletable by editors" on public.tag_rules;
create policy "Tag rules deletable by editors" on public.tag_rules as permissive for delete to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Tag rules insertable by editors" on public.tag_rules;
create policy "Tag rules insertable by editors" on public.tag_rules as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Tag rules selectable by members" on public.tag_rules;
create policy "Tag rules selectable by members" on public.tag_rules as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Tag rules updatable by editors" on public.tag_rules;
create policy "Tag rules updatable by editors" on public.tag_rules as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Tags deletable by editors" on public.tags;
create policy "Tags deletable by editors" on public.tags as permissive for delete to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Tags selectable by members" on public.tags;
create policy "Tags selectable by members" on public.tags as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Tags updatable by editors" on public.tags;
create policy "Tags updatable by editors" on public.tags as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Tags writable by editors" on public.tags;
create policy "Tags writable by editors" on public.tags as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Template collection items admin access" on public.template_collection_items;
create policy "Template collection items admin access" on public.template_collection_items as permissive for all to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

drop policy if exists "Template collection items public readable" on public.template_collection_items;
create policy "Template collection items public readable" on public.template_collection_items as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM template_collections
  WHERE ((template_collections.id = template_collection_items.collection_id) AND (template_collections.visibility = 'public'::text)))));

drop policy if exists "Template collections admin access" on public.template_collections;
create policy "Template collections admin access" on public.template_collections as permissive for all to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

drop policy if exists "Template collections public readable" on public.template_collections;
create policy "Template collections public readable" on public.template_collections as permissive for select to public
  using ((visibility = 'public'::text));

drop policy if exists "Template installs insert" on public.template_library_installs;
create policy "Template installs insert" on public.template_library_installs as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "Template installs select" on public.template_library_installs;
create policy "Template installs select" on public.template_library_installs as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "Template library delete" on public.template_library_items;
create policy "Template library delete" on public.template_library_items as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Template library insert" on public.template_library_items;
create policy "Template library insert" on public.template_library_items as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Template library select" on public.template_library_items;
create policy "Template library select" on public.template_library_items as permissive for select to public
  using (((owner_id = auth.uid()) OR ((scope = 'community'::text) AND (status = 'published'::text))));

drop policy if exists "Template library update" on public.template_library_items;
create policy "Template library update" on public.template_library_items as permissive for update to public
  using ((owner_id = auth.uid()))
  with check (((owner_id = auth.uid()) AND ((status <> 'published'::text) OR (scope <> 'community'::text) OR true)));

drop policy if exists "Template likes delete" on public.template_library_likes;
create policy "Template likes delete" on public.template_library_likes as permissive for delete to public
  using ((auth.uid() = user_id));

drop policy if exists "Template likes insert" on public.template_library_likes;
create policy "Template likes insert" on public.template_library_likes as permissive for insert to public
  with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM template_library_items i
  WHERE ((i.id = template_library_likes.template_id) AND (i.scope = 'community'::text) AND (i.status = 'published'::text))))));

drop policy if exists "Template likes select" on public.template_library_likes;
create policy "Template likes select" on public.template_library_likes as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM template_library_items i
  WHERE ((i.id = template_library_likes.template_id) AND (i.scope = 'community'::text) AND (i.status = 'published'::text)))));

drop policy if exists "Template reports insert" on public.template_library_reports;
create policy "Template reports insert" on public.template_library_reports as permissive for insert to public
  with check ((reporter_id = auth.uid()));

drop policy if exists "Template reports select" on public.template_library_reports;
create policy "Template reports select" on public.template_library_reports as permissive for select to public
  using ((reporter_id = auth.uid()));

drop policy if exists "Template reviews delete" on public.template_library_reviews;
create policy "Template reviews delete" on public.template_library_reviews as permissive for delete to public
  using ((auth.uid() = user_id));

drop policy if exists "Template reviews insert" on public.template_library_reviews;
create policy "Template reviews insert" on public.template_library_reviews as permissive for insert to public
  with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM template_library_items i
  WHERE ((i.id = template_library_reviews.template_id) AND (i.scope = 'community'::text) AND (i.status = 'published'::text))))));

drop policy if exists "Template reviews select" on public.template_library_reviews;
create policy "Template reviews select" on public.template_library_reviews as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM template_library_items i
  WHERE ((i.id = template_library_reviews.template_id) AND (i.scope = 'community'::text) AND (i.status = 'published'::text)))));

drop policy if exists "Template reviews update" on public.template_library_reviews;
create policy "Template reviews update" on public.template_library_reviews as permissive for update to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

drop policy if exists "Template reports admin read" on public.template_reports;
create policy "Template reports admin read" on public.template_reports as permissive for select to public
  using ((auth.role() = 'service_role'::text));

drop policy if exists "Template reports admin write" on public.template_reports;
create policy "Template reports admin write" on public.template_reports as permissive for all to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

drop policy if exists template_reports__service_role_all on public.template_reports;
create policy template_reports__service_role_all on public.template_reports as permissive for all to service_role
  using (true)
  with check (true);

drop policy if exists "Template versions owner access" on public.template_versions;
create policy "Template versions owner access" on public.template_versions as permissive for all to public
  using ((EXISTS ( SELECT 1
   FROM templates
  WHERE ((templates.template_id = template_versions.template_id) AND (templates.owner_user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM templates
  WHERE ((templates.template_id = template_versions.template_id) AND (templates.owner_user_id = auth.uid())))));

drop policy if exists "Template versions public readable" on public.template_versions;
create policy "Template versions public readable" on public.template_versions as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM templates
  WHERE ((templates.template_id = template_versions.template_id) AND (templates.status = 'active'::text) AND (templates.visibility = ANY (ARRAY['public'::text, 'unlisted'::text])) AND (COALESCE(((templates.moderation ->> 'autoHidden'::text))::boolean, false) = false)))));

drop policy if exists "Templates admin access" on public.templates;
create policy "Templates admin access" on public.templates as permissive for all to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

drop policy if exists "Templates owner access" on public.templates;
create policy "Templates owner access" on public.templates as permissive for all to public
  using ((owner_user_id = auth.uid()))
  with check ((owner_user_id = auth.uid()));

drop policy if exists "Templates public readable" on public.templates;
create policy "Templates public readable" on public.templates as permissive for select to public
  using (((status = 'active'::text) AND (visibility = ANY (ARRAY['public'::text, 'unlisted'::text])) AND (COALESCE(((moderation ->> 'autoHidden'::text))::boolean, false) = false)));

drop policy if exists "Upgrade requests insertable by owner" on public.upgrade_requests;
create policy "Upgrade requests insertable by owner" on public.upgrade_requests as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "Upgrade requests readable by owner" on public.upgrade_requests;
create policy "Upgrade requests readable by owner" on public.upgrade_requests as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "User entitlements are readable by owner" on public.user_entitlements;
create policy "User entitlements are readable by owner" on public.user_entitlements as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "User onboarding is insertable by owner" on public.user_onboarding;
create policy "User onboarding is insertable by owner" on public.user_onboarding as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "User onboarding is updatable by owner" on public.user_onboarding;
create policy "User onboarding is updatable by owner" on public.user_onboarding as permissive for update to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

drop policy if exists "User onboarding is viewable by owner" on public.user_onboarding;
create policy "User onboarding is viewable by owner" on public.user_onboarding as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "User plans readable by owner" on public.user_plans;
create policy "User plans readable by owner" on public.user_plans as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "User ui prefs are insertable by owner" on public.user_ui_prefs;
create policy "User ui prefs are insertable by owner" on public.user_ui_prefs as permissive for insert to public
  with check ((user_id = auth.uid()));

drop policy if exists "User ui prefs are updatable by owner" on public.user_ui_prefs;
create policy "User ui prefs are updatable by owner" on public.user_ui_prefs as permissive for update to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

drop policy if exists "User ui prefs are viewable by owner" on public.user_ui_prefs;
create policy "User ui prefs are viewable by owner" on public.user_ui_prefs as permissive for select to public
  using ((user_id = auth.uid()));

drop policy if exists "Wall cards v2 are deletable by owners" on public.wall_cards_v2;
create policy "Wall cards v2 are deletable by owners" on public.wall_cards_v2 as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM wall_sections_v2 ws
  WHERE ((ws.id = wall_cards_v2.section_id) AND (board_role(ws.board_id) = 'owner'::text)))));

drop policy if exists "Wall cards v2 are insertable by owners and editors" on public.wall_cards_v2;
create policy "Wall cards v2 are insertable by owners and editors" on public.wall_cards_v2 as permissive for insert to public
  with check ((EXISTS ( SELECT 1
   FROM wall_sections_v2 ws
  WHERE ((ws.id = wall_cards_v2.section_id) AND (board_role(ws.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Wall cards v2 are updatable by owners and editors" on public.wall_cards_v2;
create policy "Wall cards v2 are updatable by owners and editors" on public.wall_cards_v2 as permissive for update to public
  using ((EXISTS ( SELECT 1
   FROM wall_sections_v2 ws
  WHERE ((ws.id = wall_cards_v2.section_id) AND (board_role(ws.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM wall_sections_v2 ws
  WHERE ((ws.id = wall_cards_v2.section_id) AND (board_role(ws.board_id) = ANY (ARRAY['owner'::text, 'editor'::text]))))));

drop policy if exists "Wall cards v2 are viewable by members" on public.wall_cards_v2;
create policy "Wall cards v2 are viewable by members" on public.wall_cards_v2 as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM wall_sections_v2 ws
  WHERE ((ws.id = wall_cards_v2.section_id) AND (board_role(ws.board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text]))))));

drop policy if exists "Wall sections v2 are deletable by owners" on public.wall_sections_v2;
create policy "Wall sections v2 are deletable by owners" on public.wall_sections_v2 as permissive for delete to public
  using ((board_role(board_id) = 'owner'::text));

drop policy if exists "Wall sections v2 are insertable by owners and editors" on public.wall_sections_v2;
create policy "Wall sections v2 are insertable by owners and editors" on public.wall_sections_v2 as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Wall sections v2 are updatable by owners and editors" on public.wall_sections_v2;
create policy "Wall sections v2 are updatable by owners and editors" on public.wall_sections_v2 as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Wall sections v2 are viewable by members" on public.wall_sections_v2;
create policy "Wall sections v2 are viewable by members" on public.wall_sections_v2 as permissive for select to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text, 'viewer'::text])));

drop policy if exists "Walls are deletable by owner" on public.walls;
create policy "Walls are deletable by owner" on public.walls as permissive for delete to public
  using ((owner_id = auth.uid()));

drop policy if exists "Walls are insertable by owner" on public.walls;
create policy "Walls are insertable by owner" on public.walls as permissive for insert to public
  with check ((owner_id = auth.uid()));

drop policy if exists "Walls are updatable by owner" on public.walls;
create policy "Walls are updatable by owner" on public.walls as permissive for update to public
  using ((owner_id = auth.uid()))
  with check ((owner_id = auth.uid()));

drop policy if exists "Walls are viewable by owner" on public.walls;
create policy "Walls are viewable by owner" on public.walls as permissive for select to public
  using ((owner_id = auth.uid()));

drop policy if exists "Walls deletable by owner" on public.walls;
create policy "Walls deletable by owner" on public.walls as permissive for delete to public
  using ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = walls.board_id) AND (b.owner_id = auth.uid())))));

drop policy if exists "Walls updatable by editors" on public.walls;
create policy "Walls updatable by editors" on public.walls as permissive for update to public
  using ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])))
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "Walls viewable by members" on public.walls;
create policy "Walls viewable by members" on public.walls as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM boards b
  WHERE ((b.id = walls.board_id) AND ((b.owner_id = auth.uid()) OR is_board_member(walls.board_id))))));

drop policy if exists "Walls writable by editors" on public.walls;
create policy "Walls writable by editors" on public.walls as permissive for insert to public
  with check ((board_role(board_id) = ANY (ARRAY['owner'::text, 'editor'::text])));

drop policy if exists "ws published owner read" on public.website_studio_published_snapshots;
create policy "ws published owner read" on public.website_studio_published_snapshots as permissive for select to public
  using ((auth.uid() = owner_user_id));

drop policy if exists "ws published owner write" on public.website_studio_published_snapshots;
create policy "ws published owner write" on public.website_studio_published_snapshots as permissive for all to public
  using ((auth.uid() = owner_user_id))
  with check ((auth.uid() = owner_user_id));

-- -----------------------------------------------------------------------------
-- Explicit object ACLs and realtime publication membership
-- -----------------------------------------------------------------------------
revoke all privileges on table public.api_rate_limits from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.api_rate_limits to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.api_rate_limits to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.api_rate_limits to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.api_rate_limits to service_role;

revoke all privileges on table public.audit_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_events to service_role;

revoke all privileges on table public.audit_logs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs to service_role;

revoke all privileges on table public.audit_logs_daily_summary from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs_daily_summary to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs_daily_summary to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs_daily_summary to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_logs_daily_summary to service_role;

revoke all privileges on table public.billing_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.billing_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.billing_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.billing_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.billing_events to service_role;

revoke all privileges on table public.board_controls from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_controls to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_controls to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_controls to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_controls to service_role;

revoke all privileges on table public.board_files from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_files to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_files to service_role;

revoke all privileges on table public.board_invites from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_invites to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_invites to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_invites to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_invites to service_role;

revoke all privileges on table public.board_live_session from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_live_session to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_live_session to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_live_session to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_live_session to service_role;

revoke all privileges on table public.board_members from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_members to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_members to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_members to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_members to service_role;

revoke all privileges on table public.board_policies from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_policies to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_policies to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_policies to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_policies to service_role;

revoke all privileges on table public.board_polls from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_polls to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_polls to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_polls to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_polls to service_role;

revoke all privileges on table public.board_question_throttles from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_question_throttles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_question_throttles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_question_throttles to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_question_throttles to service_role;

revoke all privileges on table public.board_questions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_questions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_questions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_questions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_questions to service_role;

revoke all privileges on table public.board_share_settings from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_share_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_share_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_share_settings to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_share_settings to service_role;

revoke all privileges on table public.board_view_presets from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_view_presets to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_view_presets to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_view_presets to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.board_view_presets to service_role;

revoke all privileges on table public.boards from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.boards to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.boards to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.boards to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.boards to service_role;

revoke all privileges on table public.card_files from public, anon, authenticated, service_role;
grant DELETE, INSERT, SELECT on table public.card_files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_files to service_role;

revoke all privileges on table public.card_move_mutations from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_move_mutations to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_move_mutations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_move_mutations to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_move_mutations to service_role;

revoke all privileges on table public.card_tags from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_tags to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_tags to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_tags to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.card_tags to service_role;

revoke all privileges on table public.cards from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.cards to service_role;

revoke all privileges on table public.class_sections from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sections to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sections to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sections to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sections to service_role;

revoke all privileges on table public.class_session_bookmarks from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_bookmarks to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_bookmarks to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_bookmarks to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_bookmarks to service_role;

revoke all privileges on table public.class_session_clip_shares from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_clip_shares to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_clip_shares to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_clip_shares to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_clip_shares to service_role;

revoke all privileges on table public.class_session_controls from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_controls to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_controls to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_controls to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_controls to service_role;

revoke all privileges on table public.class_session_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_events to service_role;

revoke all privileges on table public.class_session_questions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_questions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_questions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_questions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_session_questions to service_role;

revoke all privileges on table public.class_sessions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sessions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sessions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sessions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_sessions to service_role;

revoke all privileges on table public.class_showcase_items from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcase_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcase_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcase_items to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcase_items to service_role;

revoke all privileges on table public.class_showcases from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcases to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcases to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcases to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_showcases to service_role;

revoke all privileges on table public.classes from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classes to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classes to service_role;

revoke all privileges on table public.community_blocked_users from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_blocked_users to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_blocked_users to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_blocked_users to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_blocked_users to service_role;

revoke all privileges on table public.community_comment_moderation from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_moderation to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_moderation to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_moderation to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_moderation to service_role;

revoke all privileges on table public.community_comment_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comment_reports to service_role;

revoke all privileges on table public.community_comments from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comments to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_comments to service_role;

revoke all privileges on table public.community_moderators from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_moderators to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_moderators to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_moderators to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_moderators to service_role;

revoke all privileges on table public.community_posts from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_posts to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_posts to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_posts to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_posts to service_role;

revoke all privileges on table public.community_reactions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reactions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reactions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reactions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reactions to service_role;

revoke all privileges on table public.community_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports to service_role;

revoke all privileges on table public.community_reports_archive from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports_archive to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports_archive to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports_archive to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.community_reports_archive to service_role;

revoke all privileges on table public.coupon_codes from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_codes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_codes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_codes to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_codes to service_role;

revoke all privileges on table public.coupon_redemptions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coupon_redemptions to service_role;

revoke all privileges on table public.courseware_published_snapshots from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.courseware_published_snapshots to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.courseware_published_snapshots to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.courseware_published_snapshots to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.courseware_published_snapshots to service_role;

revoke all privileges on table public.decorate_plan_cache from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.decorate_plan_cache to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.decorate_plan_cache to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.decorate_plan_cache to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.decorate_plan_cache to service_role;

revoke all privileges on table public.edu_assignments from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_assignments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_assignments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_assignments to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_assignments to service_role;

revoke all privileges on table public.edu_broadcasts from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_broadcasts to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_broadcasts to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_broadcasts to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_broadcasts to service_role;

revoke all privileges on table public.edu_classes from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_classes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_classes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_classes to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_classes to service_role;

revoke all privileges on table public.edu_feature_flags from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_feature_flags to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_feature_flags to service_role;

revoke all privileges on table public.edu_featured_projects from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_featured_projects to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_featured_projects to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_featured_projects to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_featured_projects to service_role;

revoke all privileges on table public.edu_gallery from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_gallery to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_gallery to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_gallery to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_gallery to service_role;

revoke all privileges on table public.edu_join_codes from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_codes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_codes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_codes to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_codes to service_role;

revoke all privileges on table public.edu_join_sessions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_sessions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_sessions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_sessions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_join_sessions to service_role;

revoke all privileges on table public.edu_lesson_attendance_daily from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_attendance_daily to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_attendance_daily to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_attendance_daily to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_attendance_daily to service_role;

revoke all privileges on table public.edu_lesson_completions_daily from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_completions_daily to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_completions_daily to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_completions_daily to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_lesson_completions_daily to service_role;

revoke all privileges on table public.edu_participants from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_participants to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_participants to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_participants to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_participants to service_role;

revoke all privileges on table public.edu_presentation_links from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_links to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_links to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_links to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_links to service_role;

revoke all privileges on table public.edu_presentation_settings from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_settings to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_settings to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_settings to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_presentation_settings to service_role;

revoke all privileges on table public.edu_project_feedback from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_feedback to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_feedback to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_feedback to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_feedback to service_role;

revoke all privileges on table public.edu_project_files from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_files to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_files to service_role;

revoke all privileges on table public.edu_project_stats from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_stats to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_stats to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_stats to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_stats to service_role;

revoke all privileges on table public.edu_project_visibility from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_visibility to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_visibility to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_visibility to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_project_visibility to service_role;

revoke all privileges on table public.edu_projects from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_projects to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_projects to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_projects to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_projects to service_role;

revoke all privileges on table public.edu_publish_attempts from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_publish_attempts to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_publish_attempts to service_role;

revoke all privileges on table public.edu_publish_slug_reservations from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_publish_slug_reservations to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_publish_slug_reservations to service_role;

revoke all privileges on table public.edu_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_reports to service_role;

revoke all privileges on table public.edu_submissions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_submissions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_submissions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_submissions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.edu_submissions to service_role;

revoke all privileges on table public.exhibit_versions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibit_versions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibit_versions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibit_versions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibit_versions to service_role;

revoke all privileges on table public.exhibits from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibits to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibits to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibits to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.exhibits to service_role;

revoke all privileges on table public.file_savings_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.file_savings_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.file_savings_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.file_savings_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.file_savings_events to service_role;

revoke all privileges on table public.files from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.files to service_role;

revoke all privileges on table public.google_drive_preferences from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.google_drive_preferences to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.google_drive_preferences to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.google_drive_preferences to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.google_drive_preferences to service_role;

revoke all privileges on table public.institution_requests from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.institution_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.institution_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.institution_requests to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.institution_requests to service_role;

revoke all privileges on table public.lesson_activity_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lesson_activity_runs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lesson_activity_runs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lesson_activity_runs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lesson_activity_runs to service_role;

revoke all privileges on table public.license_keys from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.license_keys to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.license_keys to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.license_keys to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.license_keys to service_role;

revoke all privileges on table public.live_participants from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.live_participants to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.live_participants to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.live_participants to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.live_participants to service_role;

revoke all privileges on table public.metaverse_progress_snapshots from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.metaverse_progress_snapshots to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.metaverse_progress_snapshots to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.metaverse_progress_snapshots to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.metaverse_progress_snapshots to service_role;

revoke all privileges on table public.moderation_hides from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.moderation_hides to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.moderation_hides to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.moderation_hides to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.moderation_hides to service_role;

revoke all privileges on table public.ops_banners from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_banners to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_banners to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_banners to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_banners to service_role;

revoke all privileges on table public.ops_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_events to service_role;

revoke all privileges on table public.ops_reports_backlog_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_reports_backlog_runs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_reports_backlog_runs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_reports_backlog_runs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_reports_backlog_runs to service_role;

revoke all privileges on table public.ops_retention_config from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_config to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_config to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_config to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_config to service_role;

revoke all privileges on table public.ops_retention_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_runs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_runs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_runs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_retention_runs to service_role;

revoke all privileges on table public.ops_user_assistant_runs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_user_assistant_runs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_user_assistant_runs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_user_assistant_runs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ops_user_assistant_runs to service_role;

revoke all privileges on table public.ownership_requests from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ownership_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ownership_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ownership_requests to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.ownership_requests to service_role;

revoke all privileges on table public.poll_responses from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_responses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_responses to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_responses to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.poll_responses to service_role;

revoke all privileges on table public.pro_waitlist from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pro_waitlist to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pro_waitlist to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pro_waitlist to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pro_waitlist to service_role;

revoke all privileges on table public.public_showcase_snapshots from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_snapshots to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_snapshots to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_snapshots to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_snapshots to service_role;

revoke all privileges on table public.public_showcase_tokens from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_tokens to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_tokens to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_tokens to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.public_showcase_tokens to service_role;

revoke all privileges on table public.publish_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.publish_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.publish_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.publish_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.publish_events to service_role;

revoke all privileges on table public.pulse_events from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pulse_events to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pulse_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pulse_events to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.pulse_events to service_role;

revoke all privileges on table public.rate_limit_counters from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limit_counters to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limit_counters to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limit_counters to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limit_counters to service_role;

revoke all privileges on table public.rate_limits from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limits to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limits to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limits to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rate_limits to service_role;

revoke all privileges on table public.reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reports to service_role;

revoke all privileges on table public.session_report_shares from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.session_report_shares to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.session_report_shares to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.session_report_shares to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.session_report_shares to service_role;

revoke all privileges on table public.showcase_tokens from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcase_tokens to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcase_tokens to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcase_tokens to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcase_tokens to service_role;

revoke all privileges on table public.showcases from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcases to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcases to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcases to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.showcases to service_role;

revoke all privileges on table public.site_content from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content to service_role;

revoke all privileges on table public.site_content_revisions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content_revisions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content_revisions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content_revisions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.site_content_revisions to service_role;

revoke all privileges on table public.storage_objects from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_objects to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_objects to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_objects to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_objects to service_role;

revoke all privileges on table public.storage_quota from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_quota to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_quota to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_quota to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_quota to service_role;

revoke all privileges on table public.storage_usage from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage to service_role;

revoke all privileges on table public.storage_usage_daily from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage_daily to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage_daily to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage_daily to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.storage_usage_daily to service_role;

revoke all privileges on table public.student_activity_states from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_activity_states to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_activity_states to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_activity_states to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_activity_states to service_role;

revoke all privileges on table public.student_app_class_sessions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_class_sessions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_class_sessions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_class_sessions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_class_sessions to service_role;

revoke all privileges on table public.student_app_deployment_files from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployment_files to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployment_files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployment_files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployment_files to service_role;

revoke all privileges on table public.student_app_deployments from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployments to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployments to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_deployments to service_role;

revoke all privileges on table public.student_app_submission_files from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submission_files to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submission_files to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submission_files to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submission_files to service_role;

revoke all privileges on table public.student_app_submissions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submissions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submissions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submissions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_app_submissions to service_role;

revoke all privileges on table public.student_requests from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_requests to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.student_requests to service_role;

revoke all privileges on table public.tag_rules from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tag_rules to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tag_rules to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tag_rules to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tag_rules to service_role;

revoke all privileges on table public.tags from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tags to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tags to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tags to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.tags to service_role;

revoke all privileges on table public.template_collection_items from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collection_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collection_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collection_items to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collection_items to service_role;

revoke all privileges on table public.template_collections from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collections to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collections to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collections to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_collections to service_role;

revoke all privileges on table public.template_library_installs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_installs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_installs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_installs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_installs to service_role;

revoke all privileges on table public.template_library_items from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_items to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_items to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_items to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_items to service_role;

revoke all privileges on table public.template_library_likes from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_likes to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_likes to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_likes to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_likes to service_role;

revoke all privileges on table public.template_library_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reports to service_role;

revoke all privileges on table public.template_library_reviews from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reviews to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reviews to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reviews to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_library_reviews to service_role;

revoke all privileges on table public.template_reports from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_reports to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_reports to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_reports to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_reports to service_role;

revoke all privileges on table public.template_versions from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_versions to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_versions to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_versions to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.template_versions to service_role;

revoke all privileges on table public.templates from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.templates to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.templates to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.templates to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.templates to service_role;

revoke all privileges on table public.upgrade_requests from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.upgrade_requests to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.upgrade_requests to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.upgrade_requests to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.upgrade_requests to service_role;

revoke all privileges on table public.user_entitlements from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_entitlements to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_entitlements to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_entitlements to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_entitlements to service_role;

revoke all privileges on table public.user_onboarding from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_onboarding to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_onboarding to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_onboarding to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_onboarding to service_role;

revoke all privileges on table public.user_plans from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_plans to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_plans to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_plans to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_plans to service_role;

revoke all privileges on table public.user_ui_prefs from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_ui_prefs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_ui_prefs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_ui_prefs to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.user_ui_prefs to service_role;

revoke all privileges on table public.wall_cards_v2 from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_cards_v2 to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_cards_v2 to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_cards_v2 to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_cards_v2 to service_role;

revoke all privileges on table public.wall_sections_v2 from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_sections_v2 to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_sections_v2 to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_sections_v2 to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.wall_sections_v2 to service_role;

revoke all privileges on table public.walls from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.walls to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.walls to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.walls to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.walls to service_role;

revoke all privileges on table public.website_studio_published_snapshots from public, anon, authenticated, service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.website_studio_published_snapshots to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.website_studio_published_snapshots to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.website_studio_published_snapshots to postgres;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.website_studio_published_snapshots to service_role;

revoke all privileges on sequence public.card_move_mutations_id_seq from public, anon, authenticated, service_role;
grant SELECT, UPDATE, USAGE on sequence public.card_move_mutations_id_seq to anon;
grant SELECT, UPDATE, USAGE on sequence public.card_move_mutations_id_seq to authenticated;
grant SELECT, UPDATE, USAGE on sequence public.card_move_mutations_id_seq to postgres;
grant SELECT, UPDATE, USAGE on sequence public.card_move_mutations_id_seq to service_role;

revoke all privileges on sequence public.ops_retention_runs_id_seq from public, anon, authenticated, service_role;
grant SELECT, UPDATE, USAGE on sequence public.ops_retention_runs_id_seq to anon;
grant SELECT, UPDATE, USAGE on sequence public.ops_retention_runs_id_seq to authenticated;
grant SELECT, UPDATE, USAGE on sequence public.ops_retention_runs_id_seq to postgres;
grant SELECT, UPDATE, USAGE on sequence public.ops_retention_runs_id_seq to service_role;

revoke all privileges on function public.begin_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.begin_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid) to postgres;
grant EXECUTE on function public.begin_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid) to service_role;

revoke all privileges on function public.board_role(bid uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.board_role(bid uuid) to anon;
grant EXECUTE on function public.board_role(bid uuid) to authenticated;
grant EXECUTE on function public.board_role(bid uuid) to postgres;
grant EXECUTE on function public.board_role(bid uuid) to service_role;

revoke all privileges on function public.community_guard_moderation_fields() from public, anon, authenticated, service_role;
grant EXECUTE on function public.community_guard_moderation_fields() to PUBLIC;
grant EXECUTE on function public.community_guard_moderation_fields() to anon;
grant EXECUTE on function public.community_guard_moderation_fields() to authenticated;
grant EXECUTE on function public.community_guard_moderation_fields() to postgres;
grant EXECUTE on function public.community_guard_moderation_fields() to service_role;

revoke all privileges on function public.community_is_blocked(p_user_id uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.community_is_blocked(p_user_id uuid) to PUBLIC;
grant EXECUTE on function public.community_is_blocked(p_user_id uuid) to anon;
grant EXECUTE on function public.community_is_blocked(p_user_id uuid) to authenticated;
grant EXECUTE on function public.community_is_blocked(p_user_id uuid) to postgres;
grant EXECUTE on function public.community_is_blocked(p_user_id uuid) to service_role;

revoke all privileges on function public.community_is_moderator(p_user_id uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.community_is_moderator(p_user_id uuid) to PUBLIC;
grant EXECUTE on function public.community_is_moderator(p_user_id uuid) to anon;
grant EXECUTE on function public.community_is_moderator(p_user_id uuid) to authenticated;
grant EXECUTE on function public.community_is_moderator(p_user_id uuid) to postgres;
grant EXECUTE on function public.community_is_moderator(p_user_id uuid) to service_role;

revoke all privileges on function public.community_set_updated_at() from public, anon, authenticated, service_role;
grant EXECUTE on function public.community_set_updated_at() to PUBLIC;
grant EXECUTE on function public.community_set_updated_at() to anon;
grant EXECUTE on function public.community_set_updated_at() to authenticated;
grant EXECUTE on function public.community_set_updated_at() to postgres;
grant EXECUTE on function public.community_set_updated_at() to service_role;

revoke all privileges on function public.complete_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_verified_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_project_id uuid, p_share_code text, p_lesson_id smallint, p_author_name text, p_title text, p_anon_id text, p_board_id uuid, p_expires_at timestamp with time zone, p_files jsonb, p_preview_url text, p_gallery_preview_url text, p_public_url text, p_classroom_url text, p_request_id text, p_publish_quota_key text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.complete_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_verified_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_project_id uuid, p_share_code text, p_lesson_id smallint, p_author_name text, p_title text, p_anon_id text, p_board_id uuid, p_expires_at timestamp with time zone, p_files jsonb, p_preview_url text, p_gallery_preview_url text, p_public_url text, p_classroom_url text, p_request_id text, p_publish_quota_key text) to postgres;
grant EXECUTE on function public.complete_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_verified_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_project_id uuid, p_share_code text, p_lesson_id smallint, p_author_name text, p_title text, p_anon_id text, p_board_id uuid, p_expires_at timestamp with time zone, p_files jsonb, p_preview_url text, p_gallery_preview_url text, p_public_url text, p_classroom_url text, p_request_id text, p_publish_quota_key text) to service_role;

revoke all privileges on function public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to anon;
grant EXECUTE on function public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to authenticated;
grant EXECUTE on function public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to postgres;
grant EXECUTE on function public.edu_atomic_publish(share_code text, lesson_id integer, author_name text, title text, slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to service_role;

revoke all privileges on function public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to anon;
grant EXECUTE on function public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to authenticated;
grant EXECUTE on function public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to postgres;
grant EXECUTE on function public.edu_atomic_publish_v2(share_code text, lesson_id integer, author_name text, title text, in_slug text, anon_id text, board_id uuid, expires_at timestamp with time zone, files jsonb, preview_url text, gallery_preview_url text, public_url text, classroom_url text, request_id text) to service_role;

revoke all privileges on function public.edu_check_publish_ready() from public, anon, authenticated, service_role;
grant EXECUTE on function public.edu_check_publish_ready() to anon;
grant EXECUTE on function public.edu_check_publish_ready() to authenticated;
grant EXECUTE on function public.edu_check_publish_ready() to postgres;
grant EXECUTE on function public.edu_check_publish_ready() to service_role;

revoke all privileges on function public.fail_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_failure_code text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.fail_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_failure_code text) to postgres;
grant EXECUTE on function public.fail_edu_publish_commit_v1(p_attempt_id uuid, p_slug text, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_lease_owner uuid, p_expected_attempt_version bigint, p_failure_code text) to service_role;

revoke all privileges on function public.find_file_by_hash_v1(p_sha256 text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.find_file_by_hash_v1(p_sha256 text) to authenticated;
grant EXECUTE on function public.find_file_by_hash_v1(p_sha256 text) to postgres;
grant EXECUTE on function public.find_file_by_hash_v1(p_sha256 text) to service_role;

revoke all privileges on function public.get_ops_retention_status() from public, anon, authenticated, service_role;
grant EXECUTE on function public.get_ops_retention_status() to postgres;
grant EXECUTE on function public.get_ops_retention_status() to service_role;

revoke all privileges on function public.handle_template_report_autohide() from public, anon, authenticated, service_role;
grant EXECUTE on function public.handle_template_report_autohide() to PUBLIC;
grant EXECUTE on function public.handle_template_report_autohide() to anon;
grant EXECUTE on function public.handle_template_report_autohide() to authenticated;
grant EXECUTE on function public.handle_template_report_autohide() to postgres;
grant EXECUTE on function public.handle_template_report_autohide() to service_role;

revoke all privileges on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) from public, anon, authenticated, service_role;
grant EXECUTE on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) to PUBLIC;
grant EXECUTE on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) to anon;
grant EXECUTE on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) to authenticated;
grant EXECUTE on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) to postgres;
grant EXECUTE on function public.increment_api_rate_limit(p_key text, p_window_start timestamp with time zone) to service_role;

revoke all privileges on function public.increment_edu_project_view(slug_input text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.increment_edu_project_view(slug_input text) to PUBLIC;
grant EXECUTE on function public.increment_edu_project_view(slug_input text) to anon;
grant EXECUTE on function public.increment_edu_project_view(slug_input text) to authenticated;
grant EXECUTE on function public.increment_edu_project_view(slug_input text) to postgres;
grant EXECUTE on function public.increment_edu_project_view(slug_input text) to service_role;

revoke all privileges on function public.is_board_member(bid uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.is_board_member(bid uuid) to anon;
grant EXECUTE on function public.is_board_member(bid uuid) to authenticated;
grant EXECUTE on function public.is_board_member(bid uuid) to postgres;
grant EXECUTE on function public.is_board_member(bid uuid) to service_role;

revoke all privileges on function public.is_board_owner(bid uuid) from public, anon, authenticated, service_role;
grant EXECUTE on function public.is_board_owner(bid uuid) to PUBLIC;
grant EXECUTE on function public.is_board_owner(bid uuid) to anon;
grant EXECUTE on function public.is_board_owner(bid uuid) to authenticated;
grant EXECUTE on function public.is_board_owner(bid uuid) to postgres;
grant EXECUTE on function public.is_board_owner(bid uuid) to service_role;

revoke all privileges on function public.prepare_edu_publish_attempt_v1(p_attempt_id uuid, p_slug text, p_lesson_id smallint, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_declared_manifest jsonb, p_capability_issued_at timestamp with time zone, p_capability_expires_at timestamp with time zone, p_capability_kid text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.prepare_edu_publish_attempt_v1(p_attempt_id uuid, p_slug text, p_lesson_id smallint, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_declared_manifest jsonb, p_capability_issued_at timestamp with time zone, p_capability_expires_at timestamp with time zone, p_capability_kid text) to postgres;
grant EXECUTE on function public.prepare_edu_publish_attempt_v1(p_attempt_id uuid, p_slug text, p_lesson_id smallint, p_manifest_schema_version smallint, p_declared_manifest_digest text, p_declared_manifest jsonb, p_capability_issued_at timestamp with time zone, p_capability_expires_at timestamp with time zone, p_capability_kid text) to service_role;

revoke all privileges on function public.prevent_hidden_republish() from public, anon, authenticated, service_role;
grant EXECUTE on function public.prevent_hidden_republish() to PUBLIC;
grant EXECUTE on function public.prevent_hidden_republish() to anon;
grant EXECUTE on function public.prevent_hidden_republish() to authenticated;
grant EXECUTE on function public.prevent_hidden_republish() to postgres;
grant EXECUTE on function public.prevent_hidden_republish() to service_role;

revoke all privileges on function public.redeem_coupon(p_user_id uuid, p_code_sha256 text) from public, anon, authenticated, service_role;
grant EXECUTE on function public.redeem_coupon(p_user_id uuid, p_code_sha256 text) to anon;
grant EXECUTE on function public.redeem_coupon(p_user_id uuid, p_code_sha256 text) to authenticated;
grant EXECUTE on function public.redeem_coupon(p_user_id uuid, p_code_sha256 text) to postgres;
grant EXECUTE on function public.redeem_coupon(p_user_id uuid, p_code_sha256 text) to service_role;

revoke all privileges on function public.run_ops_data_retention(p_trigger_source text, p_dry_run boolean) from public, anon, authenticated, service_role;
grant EXECUTE on function public.run_ops_data_retention(p_trigger_source text, p_dry_run boolean) to postgres;
grant EXECUTE on function public.run_ops_data_retention(p_trigger_source text, p_dry_run boolean) to service_role;

revoke all privileges on function public.set_community_comment_moderation_updated_at() from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_community_comment_moderation_updated_at() to PUBLIC;
grant EXECUTE on function public.set_community_comment_moderation_updated_at() to anon;
grant EXECUTE on function public.set_community_comment_moderation_updated_at() to authenticated;
grant EXECUTE on function public.set_community_comment_moderation_updated_at() to postgres;
grant EXECUTE on function public.set_community_comment_moderation_updated_at() to service_role;

revoke all privileges on function public.set_edu_feature_flags_updated_at() from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_edu_feature_flags_updated_at() to PUBLIC;
grant EXECUTE on function public.set_edu_feature_flags_updated_at() to anon;
grant EXECUTE on function public.set_edu_feature_flags_updated_at() to authenticated;
grant EXECUTE on function public.set_edu_feature_flags_updated_at() to postgres;
grant EXECUTE on function public.set_edu_feature_flags_updated_at() to service_role;

revoke all privileges on function public.set_updated_at() from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_updated_at() to PUBLIC;
grant EXECUTE on function public.set_updated_at() to anon;
grant EXECUTE on function public.set_updated_at() to authenticated;
grant EXECUTE on function public.set_updated_at() to postgres;
grant EXECUTE on function public.set_updated_at() to service_role;

revoke all privileges on function public.set_updated_at_ws_published() from public, anon, authenticated, service_role;
grant EXECUTE on function public.set_updated_at_ws_published() to PUBLIC;
grant EXECUTE on function public.set_updated_at_ws_published() to anon;
grant EXECUTE on function public.set_updated_at_ws_published() to authenticated;
grant EXECUTE on function public.set_updated_at_ws_published() to postgres;
grant EXECUTE on function public.set_updated_at_ws_published() to service_role;

revoke all privileges on function public.storage_total_bytes() from public, anon, authenticated, service_role;
grant EXECUTE on function public.storage_total_bytes() to PUBLIC;
grant EXECUTE on function public.storage_total_bytes() to anon;
grant EXECUTE on function public.storage_total_bytes() to authenticated;
grant EXECUTE on function public.storage_total_bytes() to postgres;
grant EXECUTE on function public.storage_total_bytes() to service_role;

revoke all privileges on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) from public, anon, authenticated, service_role;
grant EXECUTE on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) to PUBLIC;
grant EXECUTE on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) to anon;
grant EXECUTE on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) to authenticated;
grant EXECUTE on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) to postgres;
grant EXECUTE on function public.storage_usage_increment(input_user_id uuid, input_used_bytes bigint, input_saved_bytes bigint) to service_role;

revoke all privileges on function public.storage_usage_v1() from public, anon, authenticated, service_role;
grant EXECUTE on function public.storage_usage_v1() to authenticated;
grant EXECUTE on function public.storage_usage_v1() to postgres;
grant EXECUTE on function public.storage_usage_v1() to service_role;

revoke all privileges on function public.storage_usage_v2() from public, anon, authenticated, service_role;
grant EXECUTE on function public.storage_usage_v2() to authenticated;
grant EXECUTE on function public.storage_usage_v2() to postgres;
grant EXECUTE on function public.storage_usage_v2() to service_role;

revoke all privileges on function public.template_library_decrement_likes() from public, anon, authenticated, service_role;
grant EXECUTE on function public.template_library_decrement_likes() to PUBLIC;
grant EXECUTE on function public.template_library_decrement_likes() to anon;
grant EXECUTE on function public.template_library_decrement_likes() to authenticated;
grant EXECUTE on function public.template_library_decrement_likes() to postgres;
grant EXECUTE on function public.template_library_decrement_likes() to service_role;

revoke all privileges on function public.template_library_handle_report() from public, anon, authenticated, service_role;
grant EXECUTE on function public.template_library_handle_report() to PUBLIC;
grant EXECUTE on function public.template_library_handle_report() to anon;
grant EXECUTE on function public.template_library_handle_report() to authenticated;
grant EXECUTE on function public.template_library_handle_report() to postgres;
grant EXECUTE on function public.template_library_handle_report() to service_role;

revoke all privileges on function public.template_library_increment_installs() from public, anon, authenticated, service_role;
grant EXECUTE on function public.template_library_increment_installs() to PUBLIC;
grant EXECUTE on function public.template_library_increment_installs() to anon;
grant EXECUTE on function public.template_library_increment_installs() to authenticated;
grant EXECUTE on function public.template_library_increment_installs() to postgres;
grant EXECUTE on function public.template_library_increment_installs() to service_role;

revoke all privileges on function public.template_library_increment_likes() from public, anon, authenticated, service_role;
grant EXECUTE on function public.template_library_increment_likes() to PUBLIC;
grant EXECUTE on function public.template_library_increment_likes() to anon;
grant EXECUTE on function public.template_library_increment_likes() to authenticated;
grant EXECUTE on function public.template_library_increment_likes() to postgres;
grant EXECUTE on function public.template_library_increment_likes() to service_role;

revoke all privileges on function public.template_library_refresh_reviews() from public, anon, authenticated, service_role;
grant EXECUTE on function public.template_library_refresh_reviews() to PUBLIC;
grant EXECUTE on function public.template_library_refresh_reviews() to anon;
grant EXECUTE on function public.template_library_refresh_reviews() to authenticated;
grant EXECUTE on function public.template_library_refresh_reviews() to postgres;
grant EXECUTE on function public.template_library_refresh_reviews() to service_role;

alter publication supabase_realtime add table public.cards;
