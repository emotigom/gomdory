import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  EduPublishAttemptRestartRequiredFailureCode,
  EduPublishAttemptRetryableFailureCode,
  EduPublishAttemptState,
} from "@/lib/edu/publish/attemptState";
import type {
  EduPublishPrepareAttemptOutcome,
  EduPublishSlugReservationState,
} from "@/lib/edu/publish/prepareAttemptContract";
import type {
  EduPublishBeginCommitOutcome,
} from "@/lib/edu/publish/beginCommitContract";
import type {
  EduPublishFailCommitFailureCode,
  EduPublishFailCommitOutcome,
} from "@/lib/edu/publish/failCommitContract";
import type {
  EduPublishCompleteCommitOutcome,
} from "@/lib/edu/publish/completeCommitContract";
import { validateSupabaseEnv } from "@/lib/server/env";
import { createSupabaseAdminFetch } from "@/lib/supabase/adminFetch";

type EduPublishStoredFailureCode =
  | EduPublishAttemptRetryableFailureCode
  | EduPublishAttemptRestartRequiredFailureCode;

type EduPublishPrepareAttemptRpcSuccessRow = {
  outcome: Extract<EduPublishPrepareAttemptOutcome, "CREATED" | "ALREADY_PREPARED">;
  attempt_id: string;
  slug: string;
  state: "PREPARED";
  attempt_version: number;
  expires_at: string;
};

type EduPublishPrepareAttemptRpcConflictRow = {
  outcome: Extract<
    EduPublishPrepareAttemptOutcome,
    "SLUG_CONFLICT" | "ATTEMPT_ID_CONFLICT" | "STATE_CONFLICT" | "INVALID_INPUT"
  >;
  attempt_id: null;
  slug: null;
  state: null;
  attempt_version: null;
  expires_at: null;
};

type EduPublishPrepareAttemptRpcRow =
  | EduPublishPrepareAttemptRpcSuccessRow
  | EduPublishPrepareAttemptRpcConflictRow;

type EduPublishBeginCommitClaimOutcome = Extract<
  EduPublishBeginCommitOutcome,
  | "CLAIMED"
  | "RECLAIMED_RETRYABLE"
  | "TAKEN_OVER_STALE_LEASE"
>;

type EduPublishBeginCommitClaimRow = {
  outcome: EduPublishBeginCommitClaimOutcome;
  attempt_id: string;
  slug: string;
  state: "VALIDATING";
  attempt_version: number;
  retry_count: number;
  commit_count: number;
  lease_expires_at: string;
  expires_at: string;
  project_id: null;
};

type EduPublishBeginCommitPublishedRow = {
  outcome: Extract<EduPublishBeginCommitOutcome, "ALREADY_PUBLISHED">;
  attempt_id: string;
  slug: string;
  state: "PUBLISHED";
  attempt_version: number;
  retry_count: number;
  commit_count: number;
  lease_expires_at: null;
  expires_at: string;
  project_id: string;
};

type EduPublishBeginCommitNegativeOutcome = Extract<
  EduPublishBeginCommitOutcome,
  | "LEASE_ACTIVE"
  | "ATTEMPT_EXPIRED"
  | "BINDING_MISMATCH"
  | "STATE_CONFLICT"
  | "RETRY_EXHAUSTED"
  | "INVALID_INPUT"
>;

type EduPublishBeginCommitNegativeRow = {
  outcome: EduPublishBeginCommitNegativeOutcome;
  attempt_id: null;
  slug: null;
  state: null;
  attempt_version: null;
  retry_count: null;
  commit_count: null;
  lease_expires_at: null;
  expires_at: null;
  project_id: null;
};

type EduPublishBeginCommitRpcRow =
  | EduPublishBeginCommitClaimRow
  | EduPublishBeginCommitPublishedRow
  | EduPublishBeginCommitNegativeRow;

type EduPublishFailCommitRetryableFailureCode = Extract<
  EduPublishFailCommitFailureCode,
  | "R2_TEMPORARY_FAILURE"
  | "DB_TEMPORARY_FAILURE"
  | "RPC_TEMPORARY_FAILURE"
  | "INTERNAL_EVALUATION_FAILED"
>;

type EduPublishFailCommitRetryableRow = {
  outcome: Extract<EduPublishFailCommitOutcome, "FAILED_RETRYABLE">;
  attempt_id: string;
  slug: string;
  state: "FAILED_RETRYABLE";
  attempt_version: number;
  retry_count: number;
  commit_count: number;
  failure_code: EduPublishFailCommitRetryableFailureCode;
  failed_at: string;
  expires_at: string;
};

type EduPublishFailCommitRestartRequiredFailureCode = Extract<
  EduPublishFailCommitFailureCode,
  | "R2_OBJECT_MISSING"
  | "R2_SIZE_MISMATCH"
  | "R2_DIGEST_MISMATCH"
  | "SLUG_CONFLICT"
>;

type EduPublishFailCommitRestartRequiredRow = {
  outcome: Extract<EduPublishFailCommitOutcome, "FAILED_RESTART_REQUIRED">;
  attempt_id: string;
  slug: string;
  state: "FAILED_RESTART_REQUIRED";
  attempt_version: number;
  retry_count: number;
  commit_count: number;
  failure_code: EduPublishFailCommitRestartRequiredFailureCode;
  failed_at: string;
  expires_at: string;
};

type EduPublishFailCommitNegativeOutcome = Extract<
  EduPublishFailCommitOutcome,
  | "LEASE_EXPIRED"
  | "LEASE_MISMATCH"
  | "VERSION_MISMATCH"
  | "BINDING_MISMATCH"
  | "STATE_CONFLICT"
  | "INVALID_INPUT"
>;

type EduPublishFailCommitNegativeRow = {
  outcome: EduPublishFailCommitNegativeOutcome;
  attempt_id: null;
  slug: null;
  state: null;
  attempt_version: null;
  retry_count: null;
  commit_count: null;
  failure_code: null;
  failed_at: null;
  expires_at: null;
};

type EduPublishFailCommitRpcRow =
  | EduPublishFailCommitRetryableRow
  | EduPublishFailCommitRestartRequiredRow
  | EduPublishFailCommitNegativeRow;

type EduPublishCompleteCommitRpcFile = {
  path: string;
  content_type: string;
  size_bytes: number;
};

type EduPublishCompleteCommitSuccessOutcome = Extract<
  EduPublishCompleteCommitOutcome,
  "PUBLISHED" | "ALREADY_PUBLISHED"
>;

type EduPublishCompleteCommitSuccessRow = {
  outcome: EduPublishCompleteCommitSuccessOutcome;
  attempt_id: string;
  slug: string;
  state: "PUBLISHED";
  attempt_version: number;
  retry_count: number;
  commit_count: number;
  project_id: string;
  verified_manifest_digest: string;
  reservation_state: "PROJECT_PUBLISHED";
  published_at: string;
  preview_url: string;
  public_url: string;
  classroom_url: string;
};

type EduPublishCompleteCommitNegativeOutcome = Extract<
  EduPublishCompleteCommitOutcome,
  | "LEASE_EXPIRED"
  | "LEASE_MISMATCH"
  | "VERSION_MISMATCH"
  | "BINDING_MISMATCH"
  | "RESERVATION_MISMATCH"
  | "STATE_CONFLICT"
  | "INVALID_INPUT"
>;

type EduPublishCompleteCommitNegativeRow = {
  outcome: EduPublishCompleteCommitNegativeOutcome;
  attempt_id: null;
  slug: null;
  state: null;
  attempt_version: null;
  retry_count: null;
  commit_count: null;
  project_id: null;
  verified_manifest_digest: null;
  reservation_state: null;
  published_at: null;
  preview_url: null;
  public_url: null;
  classroom_url: null;
};

type EduPublishCompleteCommitRpcRow =
  | EduPublishCompleteCommitSuccessRow
  | EduPublishCompleteCommitNegativeRow;

export type Database = {
  public: {
    Tables: {
      boards: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string | null;
          created_at: string;
          class_id: string | null;
          board_view_type: string;
          wall_v2_enabled: boolean;
          share_code: string | null;
          share_enabled: boolean;
          share_updated_at: string;
          share_write_enabled: boolean;
          share_write_updated_at: string;
          class_state: string;
          class_notice: string | null;
          class_updated_at: string;
          rules_text: string | null;
          rules_updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["boards"]["Row"]> & {
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["boards"]["Row"]>;
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          short_code: string;
          active_board_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["classes"]["Row"]> & {
          title: string;
          short_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Row"]>;
        Relationships: [];
      };
      board_members: {
        Row: {
          board_id: string;
          user_id: string;
          role: "viewer" | "editor";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["board_members"]["Row"]> & {
          board_id: string;
          user_id: string;
          role: "viewer" | "editor";
        };
        Update: Partial<Database["public"]["Tables"]["board_members"]["Row"]>;
        Relationships: [];
      };
      board_controls: {
        Row: {
          board_id: string;
          updated_at: string;
          updated_by_user_id: string | null;
          announcement: string | null;
          inputs_locked: boolean;
          locks: Record<string, unknown> | null;
          hud: Record<string, unknown> | null;
          reply_templates: Record<string, unknown>[] | null;
          pinned_question_ids: string[];
          hidden_action_ids: string[];
          resolved_help_ids: string[];
          version: number;
        };
        Insert: Partial<Database["public"]["Tables"]["board_controls"]["Row"]> & {
          board_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_controls"]["Row"]>;
        Relationships: [];
      };
      board_invites: {
        Row: {
          token: string;
          board_id: string;
          invited_email: string;
          role: "viewer" | "editor";
          invited_by: string;
          created_at: string;
          expires_at: string;
          accepted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["board_invites"]["Row"]> & {
          board_id: string;
          invited_email: string;
          role: "viewer" | "editor";
          invited_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_invites"]["Row"]>;
        Relationships: [];
      };
      board_questions: {
        Row: {
          id: string;
          board_id: string;
          share_code: string;
          author: string | null;
          body: string;
          status: string;
          pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["board_questions"]["Row"]> & {
          board_id: string;
          share_code: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_questions"]["Row"]>;
        Relationships: [];
      };
      board_question_throttles: {
        Row: {
          share_code: string;
          fingerprint: string;
          last_submit_at: string;
          submit_count: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["board_question_throttles"]["Row"]> & {
          share_code: string;
          fingerprint: string;
          last_submit_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_question_throttles"]["Row"]>;
        Relationships: [];
      };
      student_requests: {
        Row: {
          id: string;
          created_at: string;
          board_id: string | null;
          code: string;
          anon_id: string;
          type: string;
          text: string | null;
          meta: unknown;
          status: string;
          decided_at: string | null;
          decided_by_user_id: string | null;
          decision_reason: string | null;
          pinned: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["student_requests"]["Row"]> & {
          code: string;
          anon_id: string;
          type: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_requests"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          created_at: string;
          board_id: string | null;
          actor_user_id: string | null;
          actor_role: "owner" | "editor" | "viewer" | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          meta: unknown;
          request_id: string | null;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          created_at: string;
          actor_user_id: string | null;
          actor_anon_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          meta: unknown;
          request_id: string | null;
          host: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_events"]["Row"]> & {
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Row"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          target_type: string;
          target_id: string;
          board_id: string | null;
          code: string | null;
          reporter_anon_id: string | null;
          reporter_user_id: string | null;
          reason: string;
          detail: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reports"]["Row"]> & {
          target_type: string;
          target_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [];
      };
      template_reports: {
        Row: {
          report_id: string;
          created_at: string;
          template_id: string;
          reporter_user_id: string | null;
          reporter_anon_id: string | null;
          reporter_hash: string;
          reason: string;
          note: string;
          request_id: string | null;
          host: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["template_reports"]["Row"]> & {
          template_id: string;
          reason: string;
          note: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_reports"]["Row"]>;
        Relationships: [];
      };
      template_collections: {
        Row: {
          id: string;
          created_at: string;
          slug: string;
          title: string;
          description: string | null;
          visibility: "public" | "hidden";
          kind: "picks" | "pro_pack";
          cover_image_url: string | null;
          is_locked: boolean;
          badge: string | null;
          tier: "free" | "pro";
          sort_order: number;
          cover: Record<string, unknown> | null;
        };
        Insert: Partial<Database["public"]["Tables"]["template_collections"]["Row"]> & {
          slug: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_collections"]["Row"]>;
        Relationships: [];
      };
      template_collection_items: {
        Row: {
          id: string;
          collection_id: string;
          template_id: string;
          rank: number;
          note: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["template_collection_items"]["Row"]> & {
          collection_id: string;
          template_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_collection_items"]["Row"]>;
        Relationships: [];
      };
      template_versions: {
        Row: {
          id: string;
          template_id: string;
          schema_version: number;
          payload: Record<string, unknown>;
          preview: Record<string, unknown>;
          payload_preview: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["template_versions"]["Row"]> & {
          template_id: string;
          payload: Record<string, unknown>;
          preview: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["template_versions"]["Row"]>;
        Relationships: [];
      };
      moderation_hides: {
        Row: {
          target_type: string;
          target_id: string;
          hidden: boolean;
          hidden_reason: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["moderation_hides"]["Row"]> & {
          target_type: string;
          target_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["moderation_hides"]["Row"]>;
        Relationships: [];
      };
      ops_banners: {
        Row: {
          id: string;
          message: string;
          level: string;
          href: string | null;
          label: string | null;
          enabled: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ops_banners"]["Row"]> & {
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_banners"]["Row"]>;
        Relationships: [];
      };
      rate_limit_counters: {
        Row: {
          key: string;
          count: number | null;
          reset_at: string;
          window_ms: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rate_limit_counters"]["Row"]> & {
          key: string;
          reset_at: string;
          window_ms: number;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limit_counters"]["Row"]>;
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          count: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rate_limits"]["Row"]> & {
          key: string;
          window_start: string;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Row"]>;
        Relationships: [];
      };
      board_files: {
        Row: {
          id: string;
          owner_id: string;
          board_id: string;
          r2_key: string;
          filename: string;
          bytes: number;
          mime: string | null;
          width: number | null;
          height: number | null;
          created_at: string;
          tags: string[];
          deleted_at: string | null;
          is_favorite: boolean;
          last_used_at: string | null;
          hash_sha256: string | null;
          variant: string;
          original_bytes: number | null;
          optimized_bytes: number | null;
          bytes_saved: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["board_files"]["Row"]> & {
          board_id: string;
          r2_key: string;
          filename: string;
          bytes: number;
        };
        Update: Partial<Database["public"]["Tables"]["board_files"]["Row"]>;
        Relationships: [];
      };
      card_files: {
        Row: {
          id: string;
          card_id: string;
          board_file_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["card_files"]["Row"]> & {
          card_id: string;
          board_file_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["card_files"]["Row"]>;
        Relationships: [];
      };
      walls: {
        Row: {
          id: string;
          board_id: string;
          owner_id: string;
          title: string;
          description: string | null;
          created_at: string;
          position: number;
          ui_width_px: number;
          ui_color_token: string | null;
          student_write_enabled: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["walls"]["Row"]> & {
          board_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["walls"]["Row"]>;
        Relationships: [];
      };
      cards: {
        Row: {
          id: string;
          wall_id: string;
          owner_id: string;
          text: string;
          created_at: string;
          position: number | null;
          updated_at?: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          delete_reason: string | null;
          author_type: string;
          author_name: string | null;
          author_client_id: string | null;
          is_hidden: boolean;
          hidden_at: string | null;
          is_pinned: boolean;
          pinned_at: string | null;
          is_featured: boolean;
          featured_at: string | null;
          card_color_token?: string | null;
          external_attachments: unknown | null;
        };
        Insert: {
          wall_id: string;
          owner_id: string;
          text: string;
          created_at?: string;
          position?: number | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          delete_reason?: string | null;
          author_type?: string;
          author_name?: string | null;
          author_client_id?: string | null;
          is_hidden?: boolean;
          hidden_at?: string | null;
          is_pinned?: boolean;
          pinned_at?: string | null;
          is_featured?: boolean;
          featured_at?: string | null;
          card_color_token?: string | null;
          external_attachments?: unknown | null;
        };
        Update: Partial<Database["public"]["Tables"]["cards"]["Row"]>;
        Relationships: [];
      };
      wall_sections_v2: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["wall_sections_v2"]["Row"]> & {
          board_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["wall_sections_v2"]["Row"]>;
        Relationships: [];
      };
      wall_cards_v2: {
        Row: {
          id: string;
          section_id: string;
          author_id: string | null;
          position: number;
          content: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["wall_cards_v2"]["Row"]> & {
          section_id: string;
          position: number;
          content: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["wall_cards_v2"]["Row"]>;
        Relationships: [];
      };
      board_live_session: {
        Row: {
          board_id: string;
          snapshot: unknown;
          version: number;
          updated_at: string;
        };
        Insert: {
          board_id: string;
          snapshot: unknown;
          version?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_live_session"]["Row"]>;
        Relationships: [];
      };
      class_sessions: {
        Row: {
          id: string;
          board_id: string;
          owner_id: string;
          started_at: string;
          ended_at: string | null;
          notice: string | null;
          rules_text: string | null;
          stats: unknown | null;
          report: unknown | null;
          status: string | null;
          title: string | null;
          created_by: string | null;
          share_code: string | null;
          recap_share_enabled: boolean;
          recap_shared_at: string | null;
          summary: string | null;
          teacher_notes: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          board_id: string;
          owner_id: string;
          started_at?: string;
          ended_at?: string | null;
          notice?: string | null;
          rules_text?: string | null;
          stats?: unknown | null;
          report?: unknown | null;
          status?: string | null;
          title?: string | null;
          created_by?: string | null;
          share_code?: string | null;
          recap_share_enabled?: boolean;
          recap_shared_at?: string | null;
          summary?: string | null;
          teacher_notes?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_sessions"]["Row"]>;
        Relationships: [];
      };
      lesson_activity_runs: {
        Row: {
          id: string;
          board_id: string;
          class_session_id: string;
          lesson_template_id: string;
          activity_type: string;
          status: "active" | "ended";
          config: unknown;
          created_by: string | null;
          created_at: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["lesson_activity_runs"]["Row"]> & {
          board_id: string;
          class_session_id: string;
          lesson_template_id: string;
          activity_type: string;
          config: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["lesson_activity_runs"]["Row"]>;
        Relationships: [];
      };
      student_activity_states: {
        Row: {
          id: string;
          activity_run_id: string;
          board_id: string;
          participant_key_hash: string;
          user_id: string | null;
          display_name: string | null;
          state: unknown;
          status: "in_progress" | "completed";
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["student_activity_states"]["Row"]> & {
          activity_run_id: string;
          board_id: string;
          participant_key_hash: string;
          state: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["student_activity_states"]["Row"]>;
        Relationships: [];
      };
      class_session_events: {
        Row: {
          id: string;
          session_id: string;
          board_id: string;
          share_code: string;
          ts: string;
          type: string;
          payload: unknown;
          created_at: string;
        };
        Insert: {
          session_id: string;
          board_id: string;
          share_code: string;
          ts?: string;
          type: string;
          payload?: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_session_events"]["Row"]>;
        Relationships: [];
      };
      class_session_bookmarks: {
        Row: {
          id: string;
          board_id: string;
          session_id: string;
          ts: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          board_id: string;
          session_id: string;
          ts?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_session_bookmarks"]["Row"]>;
        Relationships: [];
      };
      class_session_clip_shares: {
        Row: {
          token: string;
          board_id: string;
          session_id: string;
          clip_start_ts: string;
          clip_end_ts: string;
          mode: string;
          title: string | null;
          created_at: string;
          revoked_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          token: string;
          board_id: string;
          session_id: string;
          clip_start_ts: string;
          clip_end_ts: string;
          mode: string;
          title?: string | null;
          created_at?: string;
          revoked_at?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["class_session_clip_shares"]["Row"]>;
        Relationships: [];
      };
      showcases: {
        Row: {
          id: string;
          board_id: string;
          owner_id: string;
          mode: string;
          title: string;
          source: string;
          snapshot: unknown;
          is_revoked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          owner_id: string;
          mode?: string;
          title?: string;
          source?: string;
          snapshot?: unknown;
          is_revoked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["showcases"]["Row"]>;
        Relationships: [];
      };
      showcase_tokens: {
        Row: {
          token: string;
          showcase_id: string;
          created_at: string;
          revoked_at: string | null;
          last_accessed_at: string | null;
        };
        Insert: {
          token: string;
          showcase_id: string;
          created_at?: string;
          revoked_at?: string | null;
          last_accessed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["showcase_tokens"]["Row"]>;
        Relationships: [];
      };
      exhibits: {
        Row: {
          id: string;
          board_id: string;
          owner_id: string;
          title: string;
          description: string | null;
          status: string;
          mode: string;
          token: string;
          created_at: string;
          updated_at: string;
          last_generated_at: string | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          owner_id: string;
          title: string;
          description?: string | null;
          status?: string;
          mode?: string;
          token: string;
          created_at?: string;
          updated_at?: string;
          last_generated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["exhibits"]["Row"]>;
        Relationships: [];
      };
      exhibit_versions: {
        Row: {
          id: string;
          exhibit_id: string;
          schema_version: number;
          payload: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          exhibit_id: string;
          schema_version?: number;
          payload: unknown;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exhibit_versions"]["Row"]>;
        Relationships: [];
      };
      edu_projects: {
        Row: {
          id: string;
          share_code: string;
          author_name: string;
          title: string;
          slug: string;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
          anon_id: string | null;
          board_id: string | null;
          lesson_id: number | null;
          publish_state: string;
          publish_state_reason: string | null;
          last_validated_at: string | null;
          last_published_at: string | null;
          preview_url: string | null;
          public_url: string | null;
          classroom_url: string | null;
          last_request_id: string | null;
          publish_quota_key: string | null;
        };
        Insert: {
          id?: string;
          share_code: string;
          author_name: string;
          title: string;
          slug: string;
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
          anon_id?: string | null;
          board_id?: string | null;
          lesson_id?: number | null;
          publish_state?: string;
          publish_state_reason?: string | null;
          last_validated_at?: string | null;
          last_published_at?: string | null;
          preview_url?: string | null;
          public_url?: string | null;
          classroom_url?: string | null;
          last_request_id?: string | null;
          publish_quota_key?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_projects"]["Row"]>;
        Relationships: [];
      };
      edu_publish_slug_reservations: {
        Row: {
          slug: string;
          attempt_id: string | null;
          project_id: string | null;
          reservation_state: EduPublishSlugReservationState;
          reserved_at: string;
          converted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          attempt_id?: string | null;
          project_id?: string | null;
          reservation_state: EduPublishSlugReservationState;
          reserved_at?: string;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["edu_publish_slug_reservations"]["Row"]
        >;
        Relationships: [];
      };
      edu_publish_attempts: {
        Row: {
          attempt_id: string;
          parent_attempt_id: string | null;
          root_attempt_id: string;
          project_id: string | null;
          slug: string;

          lesson_id: 1 | 2 | 3 | 4;

          manifest_schema_version: 1;
          declared_manifest_digest: string;
          declared_manifest: unknown;
          verified_manifest_digest: string | null;

          state: EduPublishAttemptState;
          failure_code: EduPublishStoredFailureCode | null;

          retry_count: number;
          commit_count: number;
          attempt_version: number;

          lease_owner: string | null;
          lease_expires_at: string | null;

          prepared_at: string;
          validation_started_at: string | null;
          published_at: string | null;
          failed_at: string | null;
          expires_at: string;

          capability_issued_at: string | null;
          capability_expires_at: string | null;
          capability_kid: string | null;

          created_at: string;
          updated_at: string;
        };
        Insert: {
          attempt_id: string;
          parent_attempt_id?: string | null;
          root_attempt_id: string;
          project_id?: string | null;
          slug: string;

          lesson_id: 1 | 2 | 3 | 4;

          manifest_schema_version?: 1;
          declared_manifest_digest: string;
          declared_manifest: unknown;
          verified_manifest_digest?: string | null;

          state?: EduPublishAttemptState;
          failure_code?: EduPublishStoredFailureCode | null;

          retry_count?: number;
          commit_count?: number;
          attempt_version?: number;

          lease_owner?: string | null;
          lease_expires_at?: string | null;

          prepared_at?: string;
          validation_started_at?: string | null;
          published_at?: string | null;
          failed_at?: string | null;
          expires_at: string;

          capability_issued_at?: string | null;
          capability_expires_at?: string | null;
          capability_kid?: string | null;

          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_publish_attempts"]["Row"]>;
        Relationships: [];
      };
      edu_gallery: {
        Row: {
          id: string;
          class_code: string;
          view_id: string;
          lesson_key: string | null;
          title: string;
          author_name: string;
          preview_url: string | null;
          view_count: number;
          hidden: boolean;
          hidden_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_code: string;
          view_id: string;
          lesson_key?: string | null;
          title: string;
          author_name: string;
          preview_url?: string | null;
          view_count?: number;
          hidden?: boolean;
          hidden_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_gallery"]["Row"]>;
        Relationships: [];
      };
      edu_project_feedback: {
        Row: {
          slug: string;
          board_id: string;
          teacher_user_id: string;
          stamp: string | null;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          board_id: string;
          teacher_user_id: string;
          stamp?: string | null;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_project_feedback"]["Row"]>;
        Relationships: [];
      };
      edu_project_stats: {
        Row: {
          slug: string;
          view_count: number;
          last_viewed_at: string | null;
        };
        Insert: {
          slug: string;
          view_count?: number;
          last_viewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_project_stats"]["Row"]>;
        Relationships: [];
      };
      edu_featured_projects: {
        Row: {
          id: string;
          board_id: string;
          slug: string;
          created_at: string;
          sort_order: number | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          slug: string;
          created_at?: string;
          sort_order?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_featured_projects"]["Row"]>;
        Relationships: [];
      };
      edu_reports: {
        Row: {
          id: string;
          slug: string;
          board_id: string | null;
          reporter_anon_id: string | null;
          reporter_name: string | null;
          reason: string;
          note: string | null;
          created_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          slug: string;
          board_id?: string | null;
          reporter_anon_id?: string | null;
          reporter_name?: string | null;
          reason: string;
          note?: string | null;
          created_at?: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_reports"]["Row"]>;
        Relationships: [];
      };
      edu_project_visibility: {
        Row: {
          slug: string;
          board_id: string | null;
          hidden: boolean;
          hidden_reason: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
        };
        Insert: {
          slug: string;
          board_id?: string | null;
          hidden?: boolean;
          hidden_reason?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_project_visibility"]["Row"]>;
        Relationships: [];
      };
      edu_broadcasts: {
        Row: {
          board_id: string;
          message: string | null;
          cta_type: string | null;
          cta_label: string | null;
          version: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          board_id: string;
          message?: string | null;
          cta_type?: string | null;
          cta_label?: string | null;
          version?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_broadcasts"]["Row"]>;
        Relationships: [];
      };
      edu_participants: {
        Row: {
          id: string;
          share_code: string;
          anon_id: string;
          name: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
          progress: unknown;
          published_slugs: string[];
          board_id: string | null;
        };
        Insert: {
          id?: string;
          share_code: string;
          anon_id: string;
          name?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          progress?: unknown;
          published_slugs?: string[];
          board_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_participants"]["Row"]>;
        Relationships: [];
      };
      edu_classes: {
        Row: {
          board_id: string;
          share_code: string;
          created_at: string;
          updated_at: string;
          locked_at: string | null;
          lock_reason: string | null;
        };
        Insert: {
          board_id: string;
          share_code: string;
          created_at?: string;
          updated_at?: string;
          locked_at?: string | null;
          lock_reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_classes"]["Row"]>;
        Relationships: [];
      };
      edu_presentation_settings: {
        Row: {
          board_id: string;
          autoplay_default: boolean;
          interval_sec_default: number;
          start_mode: string;
          start_slug: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          board_id: string;
          autoplay_default?: boolean;
          interval_sec_default?: number;
          start_mode?: string;
          start_slug?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_presentation_settings"]["Row"]>;
        Relationships: [];
      };
      edu_presentation_links: {
        Row: {
          board_id: string;
          code: string;
          created_at: string;
          updated_at: string;
          revoked_at: string | null;
          is_active: boolean;
        };
        Insert: {
          board_id: string;
          code: string;
          created_at?: string;
          updated_at?: string;
          revoked_at?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["edu_presentation_links"]["Row"]>;
        Relationships: [];
      };
      edu_join_codes: {
        Row: {
          code: string;
          board_id: string;
          created_at: string;
          revoked_at: string | null;
          is_active: boolean;
        };
        Insert: {
          code: string;
          board_id: string;
          created_at?: string;
          revoked_at?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["edu_join_codes"]["Row"]>;
        Relationships: [];
      };
      edu_join_sessions: {
        Row: {
          token: string;
          share_code: string;
          nickname: string | null;
          board_id: string | null;
          created_at: string;
          expires_at: string;
          last_used_at: string | null;
          participant_subject_hash: string | null;
        };
        Insert: {
          token: string;
          share_code: string;
          nickname?: string | null;
          board_id?: string | null;
          created_at?: string;
          expires_at?: string;
          last_used_at?: string | null;
          participant_subject_hash?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["edu_join_sessions"]["Row"]>;
        Relationships: [];
      };
      edu_lesson_completions_daily: {
        Row: {
          code_hash: string;
          lesson_key: string;
          day_bucket: string;
          unique_anon_count: number;
          anon_hashes: unknown;
          updated_at: string;
        };
        Insert: {
          code_hash: string;
          lesson_key: string;
          day_bucket: string;
          unique_anon_count?: number;
          anon_hashes?: unknown;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_lesson_completions_daily"]["Row"]>;
        Relationships: [];
      };
      edu_lesson_attendance_daily: {
        Row: {
          code_hash: string;
          lesson_key: string;
          day_bucket: string;
          unique_anon_count: number;
          anon_hashes: unknown;
          updated_at: string;
        };
        Insert: {
          code_hash: string;
          lesson_key: string;
          day_bucket: string;
          unique_anon_count?: number;
          anon_hashes?: unknown;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_lesson_attendance_daily"]["Row"]>;
        Relationships: [];
      };
      edu_assignments: {
        Row: {
          id: string;
          board_id: string;
          share_code: string;
          title: string;
          lesson_id: number;
          template_key: string;
          allow_network: boolean;
          due_at: string | null;
          created_at: string;
          updated_at: string;
          is_closed: boolean;
        };
        Insert: {
          id?: string;
          board_id: string;
          share_code: string;
          title: string;
          lesson_id: number;
          template_key: string;
          allow_network?: boolean;
          due_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_closed?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["edu_assignments"]["Row"]>;
        Relationships: [];
      };
      edu_submissions: {
        Row: {
          id: string;
          assignment_id: string;
          anon_id: string | null;
          student_name: string | null;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          anon_id?: string | null;
          student_name?: string | null;
          slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["edu_submissions"]["Row"]>;
        Relationships: [];
      };
      edu_project_files: {
        Row: {
          project_id: string;
          path: string;
          content_type: string;
          size_bytes: number;
        };
        Insert: {
          project_id: string;
          path: string;
          content_type: string;
          size_bytes: number;
        };
        Update: Partial<Database["public"]["Tables"]["edu_project_files"]["Row"]>;
        Relationships: [];
      };
      publish_events: {
        Row: {
          id: string;
          project_id: string;
          state: string;
          reason_code: string | null;
          meta: Record<string, unknown>;
          request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          state: string;
          reason_code?: string | null;
          meta?: Record<string, unknown>;
          request_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["publish_events"]["Row"]>;
        Relationships: [];
      };
      files: {
        Row: {
          id: string;
          card_id: string;
          owner_id: string;
          r2_key: string;
          filename: string;
          content_type: string;
          content_hash: string | null;
          object_key: string | null;
          size_bytes: number;
          bytes_original: number | null;
          bytes_stored: number | null;
          sha256_hex: string | null;
          content_sha256: string | null;
          original_bytes: number | null;
          stored_bytes: number | null;
          original_size_bytes: number;
          optimized_size_bytes: number;
          width: number | null;
          height: number | null;
          optimized: boolean;
          is_optimized: boolean;
          optimization_format: string | null;
          deduped: boolean;
          dedup_reused: boolean;
          mime: string | null;
          optimized_at: string | null;
          status: string;
          tags: string[];
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          card_id: string;
          owner_id: string;
          r2_key: string;
          filename: string;
          content_type: string;
          content_hash?: string | null;
          object_key?: string | null;
          size_bytes: number;
          bytes_original?: number | null;
          bytes_stored?: number | null;
          sha256_hex?: string | null;
          content_sha256?: string | null;
          original_bytes?: number | null;
          stored_bytes?: number | null;
          original_size_bytes?: number;
          optimized_size_bytes?: number;
          width?: number | null;
          height?: number | null;
          optimized?: boolean;
          is_optimized?: boolean;
          optimization_format?: string | null;
          deduped?: boolean;
          dedup_reused?: boolean;
          mime?: string | null;
          optimized_at?: string | null;
          status?: string;
          tags?: string[];
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["files"]["Row"]>;
        Relationships: [];
      };
      file_savings_events: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          kind: string;
          original_bytes: number;
          optimized_bytes: number;
          reused_file_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          created_at?: string;
          kind: string;
          original_bytes?: number;
          optimized_bytes?: number;
          reused_file_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["file_savings_events"]["Row"]>;
        Relationships: [];
      };
      storage_usage: {
        Row: {
          user_id: string;
          bytes_used: number;
          bytes_saved_estimate: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          bytes_used?: number;
          bytes_saved_estimate?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["storage_usage"]["Row"]>;
        Relationships: [];
      };
      storage_usage_daily: {
        Row: {
          id: string;
          owner_id: string;
          day: string;
          r2_bytes: number;
          db_bytes: number;
          files_count: number;
          optimized_bytes_saved: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          day: string;
          r2_bytes?: number;
          db_bytes?: number;
          files_count?: number;
          optimized_bytes_saved?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["storage_usage_daily"]["Row"]>;
        Relationships: [];
      };
      storage_quota: {
        Row: {
          owner_id: string;
          quota_bytes: number;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          quota_bytes?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["storage_quota"]["Row"]>;
        Relationships: [];
      };
      storage_objects: {
        Row: {
          id: string;
          owner_id: string;
          board_id: string | null;
          class_id: string | null;
          r2_key: string;
          bytes: number;
          mime: string | null;
          created_at: string;
          last_accessed_at: string | null;
          hash_sha256: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          board_id?: string | null;
          class_id?: string | null;
          r2_key: string;
          bytes: number;
          mime?: string | null;
          created_at?: string;
          last_accessed_at?: string | null;
          hash_sha256?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["storage_objects"]["Row"]>;
        Relationships: [];
      };
      board_polls: {
        Row: {
          id: string;
          board_id: string;
          share_code: string;
          question: string;
          options: { id: string; label: string }[];
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          board_id: string;
          share_code: string;
          question: string;
          options: { id: string; label: string }[];
          created_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["board_polls"]["Row"]>;
        Relationships: [];
      };
      poll_responses: {
        Row: {
          poll_id: string;
          share_code: string;
          fingerprint: string;
          option_id: string;
          created_at: string;
        };
        Insert: {
          poll_id: string;
          share_code: string;
          fingerprint: string;
          option_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["poll_responses"]["Row"]>;
        Relationships: [];
      };
      live_participants: {
        Row: {
          id: string;
          board_id: string;
          share_code: string;
          fingerprint: string;
          display_name: string | null;
          joined_at: string;
          last_seen_at: string;
          user_agent: string | null;
        };
        Insert: {
          board_id: string;
          share_code: string;
          fingerprint: string;
          display_name?: string | null;
          joined_at?: string;
          last_seen_at?: string;
          user_agent?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["live_participants"]["Row"]>;
        Relationships: [];
      };
      pulse_events: {
        Row: {
          share_code: string;
          fingerprint: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          share_code: string;
          fingerprint: string;
          kind: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pulse_events"]["Row"]>;
        Relationships: [];
      };
      templates: {
        Row: {
          template_id: string;
          created_at: string;
          updated_at: string;
          owner_user_id: string;
          title: string;
          description: string;
          grade_band: "elem" | "middle" | "mixed" | null;
          subject: string | null;
          tags: string[];
          cover_file_id: string | null;
          payload: Record<string, unknown>;
          visibility: "public" | "unlisted" | "hidden";
          status: "active" | "hidden" | "removed";
          pro_only: boolean;
          tier: "free" | "pro";
          source: "community" | "official";
          collection_id: string | null;
          picks_rank: number | null;
          stats: Record<string, unknown>;
          moderation: Record<string, unknown>;
          report_count: number;
          copy_count: number;
          last_reported_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["templates"]["Row"]> & {
          owner_user_id: string;
          title: string;
          payload: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Row"]>;
        Relationships: [];
      };
      pro_waitlist: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pro_waitlist"]["Row"]> & {
          user_id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["pro_waitlist"]["Row"]>;
        Relationships: [];
      };
      ops_events: {
        Row: {
          id: string;
          request_id: string | null;
          route: string | null;
          ts: string;
          level: string;
          kind: string;
          status: number | null;
          duration_ms: number | null;
          meta: Record<string, unknown> | null;
          sample_rate: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ops_events"]["Row"]> & {
          level: string;
          kind: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_events"]["Row"]>;
        Relationships: [];
      };
      ownership_requests: {
        Row: {
          id: string;
          board_id: string;
          share_code: string;
          student_name: string;
          new_client_id: string;
          status: string;
          created_at: string;
          approved_at: string | null;
          approved_by_user_id: string | null;
          approved_card_count: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ownership_requests"]["Row"]> & {
          board_id: string;
          share_code: string;
          student_name: string;
          new_client_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["ownership_requests"]["Row"]>;
        Relationships: [];
      };
      user_entitlements: {
        Row: {
          user_id: string;
          plan: "free" | "pro";
          trial_started_at: string | null;
          trial_ends_at: string | null;
          source: string;
          provider: "none" | "stripe";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          pro_ends_at: string | null;
          billing_status: "free" | "trial" | "active" | "past_due" | "canceled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: "free" | "pro";
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          source?: string;
          provider?: "none" | "stripe";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          pro_ends_at?: string | null;
          billing_status?: "free" | "trial" | "active" | "past_due" | "canceled";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_entitlements"]["Row"]>;
        Relationships: [];
      };
      billing_events: {
        Row: {
          id: string;
          provider: string;
          type: string;
          received_at: string;
          processed_at: string | null;
          status: "received" | "processed" | "ignored" | "failed";
          meta: Record<string, unknown>;
        };
        Insert: {
          id: string;
          provider: string;
          type: string;
          received_at?: string;
          processed_at?: string | null;
          status?: "received" | "processed" | "ignored" | "failed";
          meta?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["billing_events"]["Row"]>;
        Relationships: [];
      };
      coupon_codes: {
        Row: {
          id: string;
          code_sha256: string;
          code_display: string;
          expires_at: string | null;
          max_uses: number;
          uses: number;
          effect_type: string;
          effect_value: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code_sha256: string;
          code_display: string;
          expires_at?: string | null;
          max_uses: number;
          uses?: number;
          effect_type: string;
          effect_value: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coupon_codes"]["Row"]>;
        Relationships: [];
      };
      coupon_redemptions: {
        Row: {
          id: string;
          coupon_id: string;
          user_id: string;
          redeemed_at: string;
          meta: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          user_id: string;
          redeemed_at?: string;
          meta?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["coupon_redemptions"]["Row"]>;
        Relationships: [];
      };
      license_keys: {
        Row: {
          id: string;
          code_sha256: string;
          display_hint: string;
          plan: "free" | "pro";
          seats: number;
          expires_at: string | null;
          max_uses: number;
          uses: number;
          created_by_user_id: string | null;
          issued_to: string | null;
          created_at: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          code_sha256: string;
          display_hint?: string;
          plan?: "free" | "pro";
          seats?: number;
          expires_at?: string | null;
          max_uses?: number;
          uses?: number;
          created_by_user_id?: string | null;
          issued_to?: string | null;
          created_at?: string;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["license_keys"]["Row"]>;
        Relationships: [];
      };
      user_plans: {
        Row: {
          user_id: string;
          plan: "free" | "pro";
          started_at: string;
          expires_at: string | null;
          source: "manual" | "promo" | "purchase";
          note: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: "free" | "pro";
          started_at?: string;
          expires_at?: string | null;
          source?: "manual" | "promo" | "purchase";
          note?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_plans"]["Row"]>;
        Relationships: [];
      };
      upgrade_requests: {
        Row: {
          request_id: string;
          created_at: string;
          user_id: string;
          org_name: string;
          contact_email: string;
          seats: number | null;
          message: string;
          status: "new" | "contacted" | "approved" | "rejected";
          meta: Record<string, unknown>;
        };
        Insert: {
          request_id?: string;
          created_at?: string;
          user_id: string;
          org_name?: string;
          contact_email?: string;
          seats?: number | null;
          message?: string;
          status?: "new" | "contacted" | "approved" | "rejected";
          meta?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["upgrade_requests"]["Row"]>;
        Relationships: [];
      };
      institution_requests: {
        Row: {
          id: string;
          created_at: string;
          requester_user_id: string;
          requester_email: string;
          org_name: string;
          contact_name: string | null;
          contact_email: string | null;
          plan: string;
          term: string;
          seats: number;
          message: string | null;
          status: string;
          meta: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          created_at?: string;
          requester_user_id: string;
          requester_email: string;
          org_name: string;
          contact_name?: string | null;
          contact_email?: string | null;
          plan?: string;
          term?: string;
          seats?: number;
          message?: string | null;
          status?: string;
          meta?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["institution_requests"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      board_role: {
        Args: {
          bid: string;
        };
        Returns: string | null;
      };
      get_ops_retention_status: {
        Args: Record<string, never>;
        Returns: {
          enabled: boolean;
          run_every_hours: number;
          community_reports_resolved_ttl_days: number;
          audit_logs_ttl_days: number;
          rate_limits_ttl_days: number;
          rate_limit_counters_grace_days: number;
          next_purge_due_at: string;
          last_run_at: string | null;
          last_success: boolean | null;
          last_dry_run: boolean | null;
          last_note: string | null;
          last_community_reports_purged: number | null;
          last_audit_logs_purged: number | null;
          last_rate_limits_purged: number | null;
          last_would_community_reports_purged: number | null;
          last_would_audit_logs_purged: number | null;
          last_would_rate_limits_purged: number | null;
        }[];
      };
      run_ops_data_retention: {
        Args: {
          p_trigger_source?: string;
          p_dry_run?: boolean;
        };
        Returns: Record<string, unknown>;
      };
      edu_check_publish_ready: {
        Args: Record<string, never>;
        Returns: {
          ok: boolean;
          missing: string[];
          notes: string;
        };
      };
      edu_atomic_publish: {
        Args: {
          share_code: string;
          lesson_id: number | null;
          author_name: string;
          title: string;
          slug: string;
          anon_id: string | null;
          board_id: string | null;
          expires_at: string;
          files: { path: string; content_type: string; size_bytes: number }[];
          preview_url: string;
          gallery_preview_url: string;
          public_url: string;
          classroom_url: string;
          request_id: string;
        };
        Returns: string;
      };
      edu_atomic_publish_v2: {
        Args: {
          share_code: string;
          lesson_id: number | null;
          author_name: string;
          title: string;
          in_slug: string;
          anon_id: string | null;
          board_id: string | null;
          expires_at: string;
          files: { path: string; content_type: string; size_bytes: number }[];
          preview_url: string;
          gallery_preview_url: string;
          public_url: string;
          classroom_url: string;
          request_id: string;
        };
        Returns: string;
      };
      prepare_edu_publish_attempt_v1: {
        Args: {
          p_attempt_id: string;
          p_slug: string;
          p_lesson_id: 1 | 2 | 3 | 4;
          p_manifest_schema_version: 1;
          p_declared_manifest_digest: string;
          p_declared_manifest: unknown;
          p_capability_issued_at: string;
          p_capability_expires_at: string;
          p_capability_kid: string;
        };
        Returns: EduPublishPrepareAttemptRpcRow[];
      };
      begin_edu_publish_commit_v1: {
        Args: {
          p_attempt_id: string;
          p_slug: string;
          p_manifest_schema_version: 1;
          p_declared_manifest_digest: string;
          p_lease_owner: string;
        };
        Returns: EduPublishBeginCommitRpcRow[];
      };
      fail_edu_publish_commit_v1: {
        Args: {
          p_attempt_id: string;
          p_slug: string;
          p_manifest_schema_version: 1;
          p_declared_manifest_digest: string;
          p_lease_owner: string;
          p_expected_attempt_version: number;
          p_failure_code: EduPublishFailCommitFailureCode;
        };
        Returns: EduPublishFailCommitRpcRow[];
      };
      complete_edu_publish_commit_v1: {
        Args: {
          p_attempt_id: string;
          p_slug: string;
          p_manifest_schema_version: 1;
          p_declared_manifest_digest: string;
          p_verified_manifest_digest: string;
          p_lease_owner: string;
          p_expected_attempt_version: number;
          p_project_id: string;
          p_share_code: string;
          p_lesson_id: 1 | 2 | 3 | 4;
          p_author_name: string;
          p_title: string;
          p_anon_id: string | null;
          p_board_id: string | null;
          p_expires_at: string;
          p_files: EduPublishCompleteCommitRpcFile[];
          p_preview_url: string;
          p_gallery_preview_url: string;
          p_public_url: string;
          p_classroom_url: string;
          p_request_id: string;
          p_publish_quota_key: string;
        };
        Returns: EduPublishCompleteCommitRpcRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseAdminClient = SupabaseClient<Database>;

// NOTE: server-only RLS tables (e.g. audit_events, billing_events, coupon_codes,
// coupon_redemptions, edu_feature_flags, edu_publish_attempts,
// edu_publish_slug_reservations, license_keys, moderation_hides,
// ops_banners, reports) must only be accessed through this admin client boundary.
export function createSupabaseAdminClient(): SupabaseAdminClient {
  const validation = validateSupabaseEnv({ requireServiceRoleKey: true });

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const serviceRoleKey = validation.serviceRoleKey!;

  return createClient<Database>(validation.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createSupabaseAdminFetch(serviceRoleKey),
    },
  });
}
