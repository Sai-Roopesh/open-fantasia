export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      ai_connections: {
        Row: {
          base_url: string | null;
          created_at: string;
          enabled: boolean;
          encrypted_api_key: string | null;
          health_message: string;
          health_status:
            | "untested"
            | "healthy"
            | "auth_failed"
            | "bad_config"
            | "bad_base_url"
            | "rate_limited"
            | "error";
          id: string;
          label: string;
          last_checked_at: string | null;
          last_model_refresh_at: string | null;
          last_synced_at: string | null;
          model_cache: Json;
          provider: "google" | "groq" | "mistral" | "openrouter" | "ollama";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          base_url?: string | null;
          created_at?: string;
          enabled?: boolean;
          encrypted_api_key?: string | null;
          health_message?: string;
          health_status?:
            | "untested"
            | "healthy"
            | "auth_failed"
            | "bad_config"
            | "bad_base_url"
            | "rate_limited"
            | "error";
          id?: string;
          label: string;
          last_checked_at?: string | null;
          last_model_refresh_at?: string | null;
          last_synced_at?: string | null;
          model_cache?: Json;
          provider: "google" | "groq" | "mistral" | "openrouter" | "ollama";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          base_url?: string | null;
          created_at?: string;
          enabled?: boolean;
          encrypted_api_key?: string | null;
          health_message?: string;
          health_status?:
            | "untested"
            | "healthy"
            | "auth_failed"
            | "bad_config"
            | "bad_base_url"
            | "rate_limited"
            | "error";
          id?: string;
          label?: string;
          last_checked_at?: string | null;
          last_model_refresh_at?: string | null;
          last_synced_at?: string | null;
          model_cache?: Json;
          provider?: "google" | "groq" | "mistral" | "openrouter" | "ollama";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      background_jobs: {
        Row: {
          attempts: number;
          available_at: string;
          branch_id: string | null;
          checkpoint_id: string | null;
          created_at: string;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          payload: Json;
          status: "pending" | "running" | "succeeded" | "failed";
          thread_id: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          branch_id?: string | null;
          checkpoint_id?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          payload?: Json;
          status?: "pending" | "running" | "succeeded" | "failed";
          thread_id?: string | null;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          branch_id?: string | null;
          checkpoint_id?: string | null;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          payload?: Json;
          status?: "pending" | "running" | "succeeded" | "failed";
          thread_id?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      character_example_conversations: {
        Row: {
          character_id: string;
          character_line: string;
          created_at: string;
          id: string;
          sort_order: number;
          updated_at: string;
          user_line: string;
        };
        Insert: {
          character_id: string;
          character_line?: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          updated_at?: string;
          user_line?: string;
        };
        Update: {
          character_id?: string;
          character_line?: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          updated_at?: string;
          user_line?: string;
        };
        Relationships: [];
      };
      character_starters: {
        Row: {
          character_id: string;
          created_at: string;
          id: string;
          sort_order: number;
          text: string;
          updated_at: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          text: string;
          updated_at?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          id?: string;
          sort_order?: number;
          text?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          appearance: string;
          core_persona: string;
          created_at: string;
          definition: string;
          greeting: string;
          id: string;
          max_output_tokens: number;
          name: string;
          negative_guidance: string;
          portrait_generated_at: string | null;
          portrait_last_error: string;
          portrait_path: string;
          portrait_prompt: string;
          portrait_seed: number | null;
          portrait_source_hash: string;
          portrait_status: "idle" | "pending" | "ready" | "failed";
          story: string;
          style_rules: string;
          temperature: number;
          top_p: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          appearance?: string;
          core_persona?: string;
          created_at?: string;
          definition?: string;
          greeting?: string;
          id?: string;
          max_output_tokens?: number;
          name: string;
          negative_guidance?: string;
          portrait_generated_at?: string | null;
          portrait_last_error?: string;
          portrait_path?: string;
          portrait_prompt?: string;
          portrait_seed?: number | null;
          portrait_source_hash?: string;
          portrait_status?: "idle" | "pending" | "ready" | "failed";
          story?: string;
          style_rules?: string;
          temperature?: number;
          top_p?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          appearance?: string;
          core_persona?: string;
          created_at?: string;
          definition?: string;
          greeting?: string;
          id?: string;
          max_output_tokens?: number;
          name?: string;
          negative_guidance?: string;
          portrait_generated_at?: string | null;
          portrait_last_error?: string;
          portrait_path?: string;
          portrait_prompt?: string;
          portrait_seed?: number | null;
          portrait_source_hash?: string;
          portrait_status?: "idle" | "pending" | "ready" | "failed";
          story?: string;
          style_rules?: string;
          temperature?: number;
          top_p?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_branches: {
        Row: {
          created_at: string;
          created_by: string;
          fork_checkpoint_id: string | null;
          head_checkpoint_id: string | null;
          id: string;
          name: string;
          parent_branch_id: string | null;
          thread_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          fork_checkpoint_id?: string | null;
          head_checkpoint_id?: string | null;
          id?: string;
          name: string;
          parent_branch_id?: string | null;
          thread_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          fork_checkpoint_id?: string | null;
          head_checkpoint_id?: string | null;
          id?: string;
          name?: string;
          parent_branch_id?: string | null;
          thread_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_checkpoints: {
        Row: {
          assistant_message_id: string;
          branch_id: string;
          choice_group_key: string;
          created_at: string;
          created_by: string;
          feedback_rating: number | null;
          id: string;
          parent_checkpoint_id: string | null;
          thread_id: string;
          user_message_id: string;
        };
        Insert: {
          assistant_message_id: string;
          branch_id: string;
          choice_group_key: string;
          created_at?: string;
          created_by: string;
          feedback_rating?: number | null;
          id?: string;
          parent_checkpoint_id?: string | null;
          thread_id: string;
          user_message_id: string;
        };
        Update: {
          assistant_message_id?: string;
          branch_id?: string;
          choice_group_key?: string;
          created_at?: string;
          created_by?: string;
          feedback_rating?: number | null;
          id?: string;
          parent_checkpoint_id?: string | null;
          thread_id?: string;
          user_message_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          content_text: string;
          created_at: string;
          id: string;
          metadata: Json;
          parts: Json;
          role: "user" | "assistant" | "system";
          thread_id: string;
        };
        Insert: {
          content_text?: string;
          created_at?: string;
          id: string;
          metadata?: Json;
          parts?: Json;
          role: "user" | "assistant" | "system";
          thread_id: string;
        };
        Update: {
          content_text?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          parts?: Json;
          role?: "user" | "assistant" | "system";
          thread_id?: string;
        };
        Relationships: [];
      };
      chat_pins: {
        Row: {
          body: string;
          branch_id: string;
          created_at: string;
          id: string;
          source_message_id: string | null;
          status: "active" | "resolved";
          thread_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          branch_id: string;
          created_at?: string;
          id?: string;
          source_message_id?: string | null;
          status?: "active" | "resolved";
          thread_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          branch_id?: string;
          created_at?: string;
          id?: string;
          source_message_id?: string | null;
          status?: "active" | "resolved";
          thread_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_state_snapshots: {
        Row: {
          based_on_snapshot_id: string | null;
          branch_id: string;
          checkpoint_id: string;
          open_loops: Json;
          relationship_state: string;
          resolved_loops: Json;
          narrative_hooks: Json;
          rolling_summary: string;
          scenario_state: string;
          scene_goals: Json;
          thread_id: string;
          updated_at: string;
          user_facts: Json;
          version: number;
        };
        Insert: {
          based_on_snapshot_id?: string | null;
          branch_id: string;
          checkpoint_id: string;
          open_loops?: Json;
          relationship_state?: string;
          resolved_loops?: Json;
          narrative_hooks?: Json;
          rolling_summary?: string;
          scenario_state?: string;
          scene_goals?: Json;
          thread_id: string;
          updated_at?: string;
          user_facts?: Json;
          version?: number;
        };
        Update: {
          based_on_snapshot_id?: string | null;
          branch_id?: string;
          checkpoint_id?: string;
          open_loops?: Json;
          relationship_state?: string;
          resolved_loops?: Json;
          narrative_hooks?: Json;
          rolling_summary?: string;
          scenario_state?: string;
          scene_goals?: Json;
          thread_id?: string;
          updated_at?: string;
          user_facts?: Json;
          version?: number;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          active_branch_id: string | null;
          archived_at: string | null;
          character_id: string;
          connection_id: string;
          created_at: string;
          id: string;
          is_title_autogenerated: boolean;
          max_output_tokens_override: number | null;
          model_id: string;
          persona_id: string | null;
          pinned_at: string | null;
          status: "active" | "archived";
          temperature_override: number | null;
          title: string;
          top_p_override: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_branch_id?: string | null;
          archived_at?: string | null;
          character_id: string;
          connection_id: string;
          created_at?: string;
          id?: string;
          is_title_autogenerated?: boolean;
          max_output_tokens_override?: number | null;
          model_id: string;
          persona_id?: string | null;
          pinned_at?: string | null;
          status?: "active" | "archived";
          temperature_override?: number | null;
          title?: string;
          top_p_override?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_branch_id?: string | null;
          archived_at?: string | null;
          character_id?: string;
          connection_id?: string;
          created_at?: string;
          id?: string;
          is_title_autogenerated?: boolean;
          max_output_tokens_override?: number | null;
          model_id?: string;
          persona_id?: string | null;
          pinned_at?: string | null;
          status?: "active" | "archived";
          temperature_override?: number | null;
          title?: string;
          top_p_override?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_timeline_events: {
        Row: {
          branch_id: string | null;
          checkpoint_id: string | null;
          created_at: string;
          detail: string;
          id: string;
          importance: number;
          source_message_id: string | null;
          thread_id: string;
          title: string;
        };
        Insert: {
          branch_id?: string | null;
          checkpoint_id?: string | null;
          created_at?: string;
          detail: string;
          id?: string;
          importance?: number;
          source_message_id?: string | null;
          thread_id: string;
          title: string;
        };
        Update: {
          branch_id?: string | null;
          checkpoint_id?: string | null;
          created_at?: string;
          detail?: string;
          id?: string;
          importance?: number;
          source_message_id?: string | null;
          thread_id?: string;
          title?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          is_allowed: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
          is_allowed?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          is_allowed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_personas: {
        Row: {
          backstory: string;
          boundaries: string;
          created_at: string;
          goals: string;
          id: string;
          identity: string;
          is_default: boolean;
          name: string;
          private_notes: string;
          updated_at: string;
          user_id: string;
          voice_style: string;
        };
        Insert: {
          backstory?: string;
          boundaries?: string;
          created_at?: string;
          goals?: string;
          id?: string;
          identity?: string;
          is_default?: boolean;
          name: string;
          private_notes?: string;
          updated_at?: string;
          user_id: string;
          voice_style?: string;
        };
        Update: {
          backstory?: string;
          boundaries?: string;
          created_at?: string;
          goals?: string;
          id?: string;
          identity?: string;
          is_default?: boolean;
          name?: string;
          private_notes?: string;
          updated_at?: string;
          user_id?: string;
          voice_style?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_background_jobs: {
        Args: { limit_count?: number };
        Returns: Database["public"]["Tables"]["background_jobs"]["Row"][];
      };
      create_thread_with_main_branch: {
        Args: {
          p_character_id: string;
          p_connection_id: string;
          p_model_id: string;
          p_persona_id: string;
          p_title: string;
          p_user_id: string;
        };
        Returns: Database["public"]["Tables"]["chat_threads"]["Row"];
      };
      finalize_turn_and_enqueue_reconcile: {
        Args: {
          p_assistant_message_content_text: string;
          p_assistant_message_id: string;
          p_assistant_message_metadata: Json;
          p_assistant_message_parts: Json;
          p_autotitle_text?: string | null;
          p_branch_id: string;
          p_choice_group_key: string;
          p_parent_checkpoint_id: string | null;
          p_reconcile_payload: Json;
          p_thread_id: string;
          p_user_id: string;
          p_user_message_content_text: string;
          p_user_message_id: string;
          p_user_message_metadata: Json;
          p_user_message_parts: Json;
        };
        Returns: Database["public"]["Tables"]["chat_checkpoints"]["Row"];
      };
      rewind_thread_to_checkpoint: {
        Args: {
          p_branch_id: string;
          p_checkpoint_id: string;
          p_thread_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      rewrite_latest_turn_in_place: {
        Args: {
          p_assistant_message_content_text: string;
          p_assistant_message_id: string;
          p_assistant_message_metadata: Json;
          p_assistant_message_parts: Json;
          p_autotitle_text?: string | null;
          p_branch_id: string;
          p_checkpoint_id: string;
          p_reconcile_payload: Json;
          p_thread_id: string;
          p_user_id: string;
          p_user_message_content_text?: string | null;
          p_user_message_id?: string | null;
          p_user_message_metadata?: Json | null;
          p_user_message_parts?: Json | null;
        };
        Returns: Database["public"]["Tables"]["chat_checkpoints"]["Row"];
      };
      set_default_persona: {
        Args: { target_persona_id: string; target_user_id: string };
        Returns: Database["public"]["Tables"]["user_personas"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
