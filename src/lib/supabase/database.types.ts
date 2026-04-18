export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          is_allowed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          is_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          label: string;
          base_url: string | null;
          encrypted_api_key: string | null;
          enabled: boolean;
          default_model_id: string | null;
          model_cache: Json;
          health_status: string;
          health_message: string;
          last_checked_at: string | null;
          last_model_refresh_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: string;
          label: string;
          base_url?: string | null;
          encrypted_api_key?: string | null;
          enabled?: boolean;
          default_model_id?: string | null;
          model_cache?: Json;
          health_status?: string;
          health_message?: string;
          last_checked_at?: string | null;
          last_model_refresh_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          label?: string;
          base_url?: string | null;
          encrypted_api_key?: string | null;
          enabled?: boolean;
          default_model_id?: string | null;
          model_cache?: Json;
          health_status?: string;
          health_message?: string;
          last_checked_at?: string | null;
          last_model_refresh_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_personas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          identity: string;
          backstory: string;
          voice_style: string;
          goals: string;
          boundaries: string;
          private_notes: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          identity?: string;
          backstory?: string;
          voice_style?: string;
          goals?: string;
          boundaries?: string;
          private_notes?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          identity?: string;
          backstory?: string;
          voice_style?: string;
          goals?: string;
          boundaries?: string;
          private_notes?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          story: string;
          core_persona: string;
          greeting: string;
          appearance: string;
          style_rules: string;
          definition: string;
          negative_guidance: string;
          starters: Json;
          example_conversations: Json;
          portrait_status: string;
          portrait_path: string;
          portrait_prompt: string;
          portrait_seed: number | null;
          portrait_source_hash: string;
          portrait_last_error: string;
          portrait_generated_at: string | null;
          temperature: number;
          top_p: number;
          max_output_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          story?: string;
          core_persona?: string;
          greeting?: string;
          appearance?: string;
          style_rules?: string;
          definition?: string;
          negative_guidance?: string;
          starters?: Json;
          example_conversations?: Json;
          portrait_status?: string;
          portrait_path?: string;
          portrait_prompt?: string;
          portrait_seed?: number | null;
          portrait_source_hash?: string;
          portrait_last_error?: string;
          portrait_generated_at?: string | null;
          temperature?: number;
          top_p?: number;
          max_output_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          story?: string;
          core_persona?: string;
          greeting?: string;
          appearance?: string;
          style_rules?: string;
          definition?: string;
          negative_guidance?: string;
          starters?: Json;
          example_conversations?: Json;
          portrait_status?: string;
          portrait_path?: string;
          portrait_prompt?: string;
          portrait_seed?: number | null;
          portrait_source_hash?: string;
          portrait_last_error?: string;
          portrait_generated_at?: string | null;
          temperature?: number;
          top_p?: number;
          max_output_tokens?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          character_id: string;
          connection_id: string;
          model_id: string;
          persona_id: string | null;
          title: string;
          is_title_autogenerated: boolean;
          status: string;
          archived_at: string | null;
          pinned_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          character_id: string;
          connection_id: string;
          model_id: string;
          persona_id?: string | null;
          title: string;
          is_title_autogenerated?: boolean;
          status?: string;
          archived_at?: string | null;
          pinned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          character_id?: string;
          connection_id?: string;
          model_id?: string;
          persona_id?: string | null;
          title?: string;
          is_title_autogenerated?: boolean;
          status?: string;
          archived_at?: string | null;
          pinned_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_branches: {
        Row: {
          id: string;
          thread_id: string;
          name: string;
          parent_branch_id: string | null;
          fork_turn_id: string | null;
          head_turn_id: string | null;
          is_active: boolean;
          generation_locked: boolean;
          locked_by_turn_id: string | null;
          locked_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          name: string;
          parent_branch_id?: string | null;
          fork_turn_id?: string | null;
          head_turn_id?: string | null;
          is_active?: boolean;
          generation_locked?: boolean;
          locked_by_turn_id?: string | null;
          locked_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          name?: string;
          parent_branch_id?: string | null;
          fork_turn_id?: string | null;
          head_turn_id?: string | null;
          is_active?: boolean;
          generation_locked?: boolean;
          locked_by_turn_id?: string | null;
          locked_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_turns: {
        Row: {
          id: string;
          thread_id: string;
          branch_origin_id: string;
          parent_turn_id: string | null;
          user_input_text: string;
          user_input_payload: Json;
          user_input_hidden: boolean;
          starter_seed: boolean;
          assistant_output_text: string | null;
          assistant_output_payload: Json | null;
          generation_status: string;
          reserved_by_user_id: string;
          assistant_provider: string | null;
          assistant_model: string | null;
          assistant_connection_label: string | null;
          finish_reason: string | null;
          total_tokens: number | null;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          feedback_rating: number | null;
          generation_started_at: string;
          generation_finished_at: string | null;
          failure_code: string | null;
          failure_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          branch_origin_id: string;
          parent_turn_id?: string | null;
          user_input_text: string;
          user_input_payload?: Json;
          user_input_hidden?: boolean;
          starter_seed?: boolean;
          assistant_output_text?: string | null;
          assistant_output_payload?: Json | null;
          generation_status?: string;
          reserved_by_user_id: string;
          assistant_provider?: string | null;
          assistant_model?: string | null;
          assistant_connection_label?: string | null;
          finish_reason?: string | null;
          total_tokens?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          feedback_rating?: number | null;
          generation_started_at?: string;
          generation_finished_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          branch_origin_id?: string;
          parent_turn_id?: string | null;
          user_input_text?: string;
          user_input_payload?: Json;
          user_input_hidden?: boolean;
          starter_seed?: boolean;
          assistant_output_text?: string | null;
          assistant_output_payload?: Json | null;
          generation_status?: string;
          reserved_by_user_id?: string;
          assistant_provider?: string | null;
          assistant_model?: string | null;
          assistant_connection_label?: string | null;
          finish_reason?: string | null;
          total_tokens?: number | null;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          feedback_rating?: number | null;
          generation_started_at?: string;
          generation_finished_at?: string | null;
          failure_code?: string | null;
          failure_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_turn_snapshots: {
        Row: {
          turn_id: string;
          thread_id: string;
          branch_id: string;
          based_on_turn_id: string | null;
          scenario_state: string;
          relationship_state: string;
          rolling_summary: string;
          user_facts: Json;
          open_loops: Json;
          resolved_loops: Json;
          narrative_hooks: Json;
          scene_goals: Json;
          version: number;
          updated_at: string;
        };
        Insert: {
          turn_id: string;
          thread_id: string;
          branch_id: string;
          based_on_turn_id?: string | null;
          scenario_state?: string;
          relationship_state?: string;
          rolling_summary?: string;
          user_facts?: Json;
          open_loops?: Json;
          resolved_loops?: Json;
          narrative_hooks?: Json;
          scene_goals?: Json;
          version?: number;
          updated_at?: string;
        };
        Update: {
          turn_id?: string;
          thread_id?: string;
          branch_id?: string;
          based_on_turn_id?: string | null;
          scenario_state?: string;
          relationship_state?: string;
          rolling_summary?: string;
          user_facts?: Json;
          open_loops?: Json;
          resolved_loops?: Json;
          narrative_hooks?: Json;
          scene_goals?: Json;
          version?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_timeline_events: {
        Row: {
          id: string;
          thread_id: string;
          branch_id: string;
          turn_id: string | null;
          title: string;
          detail: string;
          importance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          branch_id: string;
          turn_id?: string | null;
          title: string;
          detail: string;
          importance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          branch_id?: string;
          turn_id?: string | null;
          title?: string;
          detail?: string;
          importance?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_pins: {
        Row: {
          id: string;
          thread_id: string;
          branch_id: string;
          turn_id: string | null;
          body: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          branch_id: string;
          turn_id?: string | null;
          body: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          branch_id?: string;
          turn_id?: string | null;
          body?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      turn_reconcile_tasks: {
        Row: {
          id: string;
          turn_id: string;
          thread_id: string;
          branch_id: string;
          user_id: string;
          connection_id: string;
          model_id: string;
          character_id: string;
          persona_id: string;
          status: string;
          attempts: number;
          max_attempts: number;
          available_at: string;
          locked_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          turn_id: string;
          thread_id: string;
          branch_id: string;
          user_id: string;
          connection_id: string;
          model_id: string;
          character_id: string;
          persona_id: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          turn_id?: string;
          thread_id?: string;
          branch_id?: string;
          user_id?: string;
          connection_id?: string;
          model_id?: string;
          character_id?: string;
          persona_id?: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      character_portrait_tasks: {
        Row: {
          id: string;
          character_id: string;
          user_id: string;
          prompt: string;
          seed: number;
          source_hash: string;
          status: string;
          attempts: number;
          max_attempts: number;
          available_at: string;
          locked_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          character_id: string;
          user_id: string;
          prompt: string;
          seed: number;
          source_hash: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          character_id?: string;
          user_id?: string;
          prompt?: string;
          seed?: number;
          source_hash?: string;
          status?: string;
          attempts?: number;
          max_attempts?: number;
          available_at?: string;
          locked_at?: string | null;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      activate_branch: {
        Args: {
          p_thread_id: string;
          p_branch_id: string;
        };
        Returns: Database["public"]["Tables"]["chat_branches"]["Row"];
      };
      begin_turn: {
        Args: {
          p_branch_id: string;
          p_expected_head_turn_id: string | null;
          p_user_input_text: string;
          p_user_input_payload: Json;
          p_parent_turn_id_override?: string | null;
          p_force_parent_override?: boolean;
          p_user_input_hidden?: boolean;
          p_starter_seed?: boolean;
        };
        Returns: Database["public"]["Tables"]["chat_turns"]["Row"];
      };
      commit_turn: {
        Args: {
          p_branch_id: string;
          p_turn_id: string;
          p_assistant_output_text: string;
          p_assistant_output_payload: Json;
          p_assistant_provider: string | null;
          p_assistant_model: string | null;
          p_assistant_connection_label: string | null;
          p_finish_reason: string | null;
          p_total_tokens: number | null;
          p_prompt_tokens: number | null;
          p_completion_tokens: number | null;
        };
        Returns: Database["public"]["Tables"]["chat_turns"]["Row"];
      };
      fail_turn: {
        Args: {
          p_branch_id: string;
          p_turn_id: string;
          p_failure_code: string;
          p_failure_message: string;
        };
        Returns: Database["public"]["Tables"]["chat_turns"]["Row"];
      };
      create_branch_from_turn: {
        Args: {
          p_source_branch_id: string;
          p_source_turn_id: string;
          p_name: string;
          p_make_active: boolean;
        };
        Returns: Database["public"]["Tables"]["chat_branches"]["Row"];
      };
      rewind_branch_to_turn: {
        Args: {
          p_branch_id: string;
          p_target_turn_id: string;
          p_expected_head_turn_id?: string | null;
        };
        Returns: Database["public"]["Tables"]["chat_branches"]["Row"];
      };
      set_default_persona: {
        Args: {
          target_persona_id: string;
        };
        Returns: Database["public"]["Tables"]["user_personas"]["Row"];
      };
      claim_turn_reconcile_tasks: {
        Args: {
          limit_count?: number;
        };
        Returns: Database["public"]["Tables"]["turn_reconcile_tasks"]["Row"][];
      };
      claim_character_portrait_tasks: {
        Args: {
          limit_count?: number;
        };
        Returns: Database["public"]["Tables"]["character_portrait_tasks"]["Row"][];
      };
      cleanup_stale_generation_locks: {
        Args: {
          p_stale_before?: string;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
