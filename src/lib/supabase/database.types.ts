export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_connections: {
        Row: {
          base_url: string | null
          created_at: string
          default_model_id: string | null
          enabled: boolean
          encrypted_api_key: string | null
          health_message: string
          health_status: string
          id: string
          label: string
          last_checked_at: string | null
          last_model_refresh_at: string | null
          last_synced_at: string | null
          model_cache: Json
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_url?: string | null
          created_at?: string
          default_model_id?: string | null
          enabled?: boolean
          encrypted_api_key?: string | null
          health_message?: string
          health_status?: string
          id?: string
          label: string
          last_checked_at?: string | null
          last_model_refresh_at?: string | null
          last_synced_at?: string | null
          model_cache?: Json
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_url?: string | null
          created_at?: string
          default_model_id?: string | null
          enabled?: boolean
          encrypted_api_key?: string | null
          health_message?: string
          health_status?: string
          id?: string
          label?: string
          last_checked_at?: string | null
          last_model_refresh_at?: string | null
          last_synced_at?: string | null
          model_cache?: Json
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_portrait_tasks: {
        Row: {
          attempts: number
          available_at: string
          character_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          prompt: string
          seed: number
          source_hash: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          character_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          prompt: string
          seed: number
          source_hash: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          available_at?: string
          character_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          prompt?: string
          seed?: number
          source_hash?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_portrait_tasks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_portrait_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          appearance: string
          core_persona: string
          created_at: string
          definition: string
          example_conversations: Json
          greeting: string
          id: string
          max_output_tokens: number
          name: string
          negative_guidance: string
          portrait_generated_at: string | null
          portrait_last_error: string
          portrait_path: string
          portrait_prompt: string
          portrait_seed: number | null
          portrait_source_hash: string
          portrait_status: string
          starters: Json
          story: string
          style_rules: string
          temperature: number
          top_p: number
          updated_at: string
          user_id: string
        }
        Insert: {
          appearance?: string
          core_persona?: string
          created_at?: string
          definition?: string
          example_conversations?: Json
          greeting?: string
          id?: string
          max_output_tokens?: number
          name: string
          negative_guidance?: string
          portrait_generated_at?: string | null
          portrait_last_error?: string
          portrait_path?: string
          portrait_prompt?: string
          portrait_seed?: number | null
          portrait_source_hash?: string
          portrait_status?: string
          starters?: Json
          story?: string
          style_rules?: string
          temperature?: number
          top_p?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          appearance?: string
          core_persona?: string
          created_at?: string
          definition?: string
          example_conversations?: Json
          greeting?: string
          id?: string
          max_output_tokens?: number
          name?: string
          negative_guidance?: string
          portrait_generated_at?: string | null
          portrait_last_error?: string
          portrait_path?: string
          portrait_prompt?: string
          portrait_seed?: number | null
          portrait_source_hash?: string
          portrait_status?: string
          starters?: Json
          story?: string
          style_rules?: string
          temperature?: number
          top_p?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_branches: {
        Row: {
          created_at: string
          created_by: string
          fork_turn_id: string | null
          generation_locked: boolean
          head_turn_id: string | null
          id: string
          is_active: boolean
          locked_at: string | null
          locked_by_turn_id: string | null
          name: string
          parent_branch_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          fork_turn_id?: string | null
          generation_locked?: boolean
          head_turn_id?: string | null
          id?: string
          is_active?: boolean
          locked_at?: string | null
          locked_by_turn_id?: string | null
          name: string
          parent_branch_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          fork_turn_id?: string | null
          generation_locked?: boolean
          head_turn_id?: string | null
          id?: string
          is_active?: boolean
          locked_at?: string | null
          locked_by_turn_id?: string | null
          name?: string
          parent_branch_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_branches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_branches_fork_turn_fkey"
            columns: ["fork_turn_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id", "thread_id"]
          },
          {
            foreignKeyName: "chat_branches_head_turn_fkey"
            columns: ["head_turn_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id", "thread_id"]
          },
          {
            foreignKeyName: "chat_branches_locked_turn_fkey"
            columns: ["locked_by_turn_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id", "thread_id"]
          },
          {
            foreignKeyName: "chat_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_branches_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_pins: {
        Row: {
          body: string
          branch_id: string
          created_at: string
          id: string
          status: string
          thread_id: string
          turn_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          branch_id: string
          created_at?: string
          id?: string
          status?: string
          thread_id: string
          turn_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          branch_id?: string
          created_at?: string
          id?: string
          status?: string
          thread_id?: string
          turn_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_pins_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_pins_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_pins_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          archived_at: string | null
          brain_connection_id: string | null
          brain_model_id: string | null
          character_id: string
          connection_id: string
          created_at: string
          id: string
          is_title_autogenerated: boolean
          model_id: string
          persona_id: string | null
          pinned_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          brain_connection_id?: string | null
          brain_model_id?: string | null
          character_id: string
          connection_id: string
          created_at?: string
          id?: string
          is_title_autogenerated?: boolean
          model_id: string
          persona_id?: string | null
          pinned_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          brain_connection_id?: string | null
          brain_model_id?: string | null
          character_id?: string
          connection_id?: string
          created_at?: string
          id?: string
          is_title_autogenerated?: boolean
          model_id?: string
          persona_id?: string | null
          pinned_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_brain_connection_id_fkey"
            columns: ["brain_connection_id"]
            isOneToOne: false
            referencedRelation: "ai_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "ai_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "user_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_timeline_events: {
        Row: {
          affected_entity_ids: string[]
          affected_relationship_ids: string[]
          branch_id: string
          created_at: string
          detail: string
          event_type: string
          id: string
          importance: number
          thread_id: string
          title: string
          turn_id: string | null
        }
        Insert: {
          affected_entity_ids?: string[]
          affected_relationship_ids?: string[]
          branch_id: string
          created_at?: string
          detail: string
          event_type?: string
          id?: string
          importance?: number
          thread_id: string
          title: string
          turn_id?: string | null
        }
        Update: {
          affected_entity_ids?: string[]
          affected_relationship_ids?: string[]
          branch_id?: string
          created_at?: string
          detail?: string
          event_type?: string
          id?: string
          importance?: number
          thread_id?: string
          title?: string
          turn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_timeline_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_timeline_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_timeline_events_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_turns: {
        Row: {
          assistant_connection_label: string | null
          assistant_model: string | null
          assistant_output_payload: Json | null
          assistant_output_text: string | null
          assistant_provider: string | null
          branch_origin_id: string
          completion_tokens: number | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          feedback_rating: number | null
          finish_reason: string | null
          generation_finished_at: string | null
          generation_started_at: string
          generation_status: string
          id: string
          parent_turn_id: string | null
          prompt_tokens: number | null
          reserved_by_user_id: string
          starter_seed: boolean
          thread_id: string
          total_tokens: number | null
          updated_at: string
          user_input_hidden: boolean
          user_input_payload: Json
          user_input_text: string
        }
        Insert: {
          assistant_connection_label?: string | null
          assistant_model?: string | null
          assistant_output_payload?: Json | null
          assistant_output_text?: string | null
          assistant_provider?: string | null
          branch_origin_id: string
          completion_tokens?: number | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          feedback_rating?: number | null
          finish_reason?: string | null
          generation_finished_at?: string | null
          generation_started_at?: string
          generation_status?: string
          id?: string
          parent_turn_id?: string | null
          prompt_tokens?: number | null
          reserved_by_user_id: string
          starter_seed?: boolean
          thread_id: string
          total_tokens?: number | null
          updated_at?: string
          user_input_hidden?: boolean
          user_input_payload?: Json
          user_input_text?: string
        }
        Update: {
          assistant_connection_label?: string | null
          assistant_model?: string | null
          assistant_output_payload?: Json | null
          assistant_output_text?: string | null
          assistant_provider?: string | null
          branch_origin_id?: string
          completion_tokens?: number | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          feedback_rating?: number | null
          finish_reason?: string | null
          generation_finished_at?: string | null
          generation_started_at?: string
          generation_status?: string
          id?: string
          parent_turn_id?: string | null
          prompt_tokens?: number | null
          reserved_by_user_id?: string
          starter_seed?: boolean
          thread_id?: string
          total_tokens?: number | null
          updated_at?: string
          user_input_hidden?: boolean
          user_input_payload?: Json
          user_input_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_turns_branch_origin_fkey"
            columns: ["branch_origin_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id", "thread_id"]
          },
          {
            foreignKeyName: "chat_turns_parent_turn_fkey"
            columns: ["parent_turn_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id", "thread_id"]
          },
          {
            foreignKeyName: "chat_turns_reserved_by_user_id_fkey"
            columns: ["reserved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_turns_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_allowed: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_allowed?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_allowed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_personas: {
        Row: {
          backstory: string
          boundaries: string
          created_at: string
          goals: string
          id: string
          identity: string
          is_default: boolean
          name: string
          private_notes: string
          updated_at: string
          user_id: string
          voice_style: string
        }
        Insert: {
          backstory?: string
          boundaries?: string
          created_at?: string
          goals?: string
          id?: string
          identity?: string
          is_default?: boolean
          name: string
          private_notes?: string
          updated_at?: string
          user_id: string
          voice_style?: string
        }
        Update: {
          backstory?: string
          boundaries?: string
          created_at?: string
          goals?: string
          id?: string
          identity?: string
          is_default?: boolean
          name?: string
          private_notes?: string
          updated_at?: string
          user_id?: string
          voice_style?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_personas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      world_entities: {
        Row: {
          aliases: string[]
          branch_id: string
          canonical_name: string
          character_id: string | null
          created_at: string
          emotion_catalyst: string
          emotion_intensity: number
          entity_type: string
          id: string
          invalidated_at_turn_id: string | null
          is_present: boolean
          primary_emotion: string
          t_created: string
          t_expired: string | null
          thread_id: string
          updated_at: string
          valid_from_turn_id: string
        }
        Insert: {
          aliases?: string[]
          branch_id: string
          canonical_name: string
          character_id?: string | null
          created_at?: string
          emotion_catalyst?: string
          emotion_intensity?: number
          entity_type: string
          id?: string
          invalidated_at_turn_id?: string | null
          is_present?: boolean
          primary_emotion?: string
          t_created?: string
          t_expired?: string | null
          thread_id: string
          updated_at?: string
          valid_from_turn_id: string
        }
        Update: {
          aliases?: string[]
          branch_id?: string
          canonical_name?: string
          character_id?: string | null
          created_at?: string
          emotion_catalyst?: string
          emotion_intensity?: number
          entity_type?: string
          id?: string
          invalidated_at_turn_id?: string | null
          is_present?: boolean
          primary_emotion?: string
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          updated_at?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_entities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entities_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entities_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entities_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entities_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_entity_facts: {
        Row: {
          body: string
          branch_id: string
          created_at: string
          entity_id: string
          fact_type: string
          id: string
          invalidated_at_turn_id: string | null
          t_created: string
          t_expired: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Insert: {
          body: string
          branch_id: string
          created_at?: string
          entity_id: string
          fact_type: string
          id?: string
          invalidated_at_turn_id?: string | null
          t_created?: string
          t_expired?: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Update: {
          body?: string
          branch_id?: string
          created_at?: string
          entity_id?: string
          fact_type?: string
          id?: string
          invalidated_at_turn_id?: string | null
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_entity_facts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_facts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "world_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_facts_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_facts_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_facts_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_entity_placements: {
        Row: {
          branch_id: string
          created_at: string
          entity_id: string
          id: string
          invalidated_at_turn_id: string | null
          location_id: string
          micro_position: string
          t_created: string
          t_expired: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          entity_id: string
          id?: string
          invalidated_at_turn_id?: string | null
          location_id: string
          micro_position?: string
          t_created?: string
          t_expired?: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          entity_id?: string
          id?: string
          invalidated_at_turn_id?: string | null
          location_id?: string
          micro_position?: string
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_entity_placements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_placements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "world_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_placements_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_placements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "world_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_placements_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_entity_placements_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_location_edges: {
        Row: {
          branch_id: string
          created_at: string
          from_location_id: string
          id: string
          invalidated_at_turn_id: string | null
          is_bidirectional: boolean
          t_created: string
          t_expired: string | null
          thread_id: string
          to_location_id: string
          valid_from_turn_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          from_location_id: string
          id?: string
          invalidated_at_turn_id?: string | null
          is_bidirectional?: boolean
          t_created?: string
          t_expired?: string | null
          thread_id: string
          to_location_id: string
          valid_from_turn_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          from_location_id?: string
          id?: string
          invalidated_at_turn_id?: string | null
          is_bidirectional?: boolean
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          to_location_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_location_edges_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_location_edges_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "world_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_location_edges_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_location_edges_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_location_edges_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "world_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_location_edges_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_locations: {
        Row: {
          branch_id: string
          canonical_name: string
          created_at: string
          description: string
          environmental_modifiers: string[]
          id: string
          invalidated_at_turn_id: string | null
          t_created: string
          t_expired: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Insert: {
          branch_id: string
          canonical_name: string
          created_at?: string
          description?: string
          environmental_modifiers?: string[]
          id?: string
          invalidated_at_turn_id?: string | null
          t_created?: string
          t_expired?: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Update: {
          branch_id?: string
          canonical_name?: string
          created_at?: string
          description?: string
          environmental_modifiers?: string[]
          id?: string
          invalidated_at_turn_id?: string | null
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_locations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_locations_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_locations_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_locations_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_narrative_threads: {
        Row: {
          branch_id: string
          created_at: string
          dependency_ids: string[]
          id: string
          invalidated_at_turn_id: string | null
          objective: string
          status: string
          t_created: string
          t_expired: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          dependency_ids?: string[]
          id?: string
          invalidated_at_turn_id?: string | null
          objective: string
          status?: string
          t_created?: string
          t_expired?: string | null
          thread_id: string
          valid_from_turn_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          dependency_ids?: string[]
          id?: string
          invalidated_at_turn_id?: string | null
          objective?: string
          status?: string
          t_created?: string
          t_expired?: string | null
          thread_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_narrative_threads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_narrative_threads_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_narrative_threads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_narrative_threads_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_relationships: {
        Row: {
          branch_id: string
          created_at: string
          dynamic_status: string
          id: string
          invalidated_at_turn_id: string | null
          relationship_type: string
          source_entity_id: string
          t_created: string
          t_expired: string | null
          target_entity_id: string
          thread_id: string
          valid_from_turn_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          dynamic_status?: string
          id?: string
          invalidated_at_turn_id?: string | null
          relationship_type: string
          source_entity_id: string
          t_created?: string
          t_expired?: string | null
          target_entity_id: string
          thread_id: string
          valid_from_turn_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          dynamic_status?: string
          id?: string
          invalidated_at_turn_id?: string | null
          relationship_type?: string
          source_entity_id?: string
          t_created?: string
          t_expired?: string | null
          target_entity_id?: string
          thread_id?: string
          valid_from_turn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_relationships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_relationships_invalidated_at_turn_id_fkey"
            columns: ["invalidated_at_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_relationships_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "world_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_relationships_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "world_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_relationships_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_relationships_valid_from_turn_id_fkey"
            columns: ["valid_from_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
      world_snapshots: {
        Row: {
          based_on_turn_id: string | null
          branch_id: string
          created_at: string
          is_full_materialization: boolean
          last_turn_beat: string
          narrative_timestamp: string
          scene_summary: string
          story_summary: string
          thread_id: string
          transition_type: string
          turn_id: string
          updated_at: string
          version: number
        }
        Insert: {
          based_on_turn_id?: string | null
          branch_id: string
          created_at?: string
          is_full_materialization?: boolean
          last_turn_beat?: string
          narrative_timestamp?: string
          scene_summary?: string
          story_summary?: string
          thread_id: string
          transition_type?: string
          turn_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          based_on_turn_id?: string | null
          branch_id?: string
          created_at?: string
          is_full_materialization?: boolean
          last_turn_beat?: string
          narrative_timestamp?: string
          scene_summary?: string
          story_summary?: string
          thread_id?: string
          transition_type?: string
          turn_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "world_snapshots_based_on_turn_id_fkey"
            columns: ["based_on_turn_id"]
            isOneToOne: false
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "chat_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_snapshots_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "world_snapshots_turn_id_fkey"
            columns: ["turn_id"]
            isOneToOne: true
            referencedRelation: "chat_turns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_branch: {
        Args: { p_branch_id: string; p_thread_id: string }
        Returns: {
          created_at: string
          created_by: string
          fork_turn_id: string | null
          generation_locked: boolean
          head_turn_id: string | null
          id: string
          is_active: boolean
          locked_at: string | null
          locked_by_turn_id: string | null
          name: string
          parent_branch_id: string | null
          thread_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      begin_turn: {
        Args: {
          p_branch_id: string
          p_expected_head_turn_id: string | null
          p_force_parent_override?: boolean
          p_parent_turn_id_override?: string
          p_starter_seed?: boolean
          p_user_input_hidden?: boolean
          p_user_input_payload?: Json
          p_user_input_text: string
        }
        Returns: {
          assistant_connection_label: string | null
          assistant_model: string | null
          assistant_output_payload: Json | null
          assistant_output_text: string | null
          assistant_provider: string | null
          branch_origin_id: string
          completion_tokens: number | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          feedback_rating: number | null
          finish_reason: string | null
          generation_finished_at: string | null
          generation_started_at: string
          generation_status: string
          id: string
          parent_turn_id: string | null
          prompt_tokens: number | null
          reserved_by_user_id: string
          starter_seed: boolean
          thread_id: string
          total_tokens: number | null
          updated_at: string
          user_input_hidden: boolean
          user_input_payload: Json
          user_input_text: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_character_portrait_tasks: {
        Args: { limit_count?: number }
        Returns: {
          attempts: number
          available_at: string
          character_id: string
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          prompt: string
          seed: number
          source_hash: string
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "character_portrait_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_stale_generation_locks: {
        Args: { p_stale_before?: string }
        Returns: number
      }
      commit_turn: {
        Args: {
          p_assistant_connection_label: string | null
          p_assistant_model: string | null
          p_assistant_output_payload: Json
          p_assistant_output_text: string
          p_assistant_provider: string | null
          p_branch_id: string
          p_completion_tokens: number | null
          p_finish_reason: string | null
          p_prompt_tokens: number | null
          p_total_tokens: number | null
          p_turn_id: string
        }
        Returns: {
          assistant_connection_label: string | null
          assistant_model: string | null
          assistant_output_payload: Json | null
          assistant_output_text: string | null
          assistant_provider: string | null
          branch_origin_id: string
          completion_tokens: number | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          feedback_rating: number | null
          finish_reason: string | null
          generation_finished_at: string | null
          generation_started_at: string
          generation_status: string
          id: string
          parent_turn_id: string | null
          prompt_tokens: number | null
          reserved_by_user_id: string
          starter_seed: boolean
          thread_id: string
          total_tokens: number | null
          updated_at: string
          user_input_hidden: boolean
          user_input_payload: Json
          user_input_text: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_branch_from_turn: {
        Args: {
          p_make_active?: boolean
          p_name: string
          p_source_branch_id: string
          p_source_turn_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          fork_turn_id: string | null
          generation_locked: boolean
          head_turn_id: string | null
          id: string
          is_active: boolean
          locked_at: string | null
          locked_by_turn_id: string | null
          name: string
          parent_branch_id: string | null
          thread_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fail_turn: {
        Args: {
          p_branch_id: string
          p_failure_code: string
          p_failure_message: string
          p_turn_id: string
        }
        Returns: {
          assistant_connection_label: string | null
          assistant_model: string | null
          assistant_output_payload: Json | null
          assistant_output_text: string | null
          assistant_provider: string | null
          branch_origin_id: string
          completion_tokens: number | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          feedback_rating: number | null
          finish_reason: string | null
          generation_finished_at: string | null
          generation_started_at: string
          generation_status: string
          id: string
          parent_turn_id: string | null
          prompt_tokens: number | null
          reserved_by_user_id: string
          starter_seed: boolean
          thread_id: string
          total_tokens: number | null
          updated_at: string
          user_input_hidden: boolean
          user_input_payload: Json
          user_input_text: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_turns"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owns_thread: { Args: { target_thread_id: string }; Returns: boolean }
      rewind_branch_to_turn: {
        Args: {
          p_branch_id: string
          p_expected_head_turn_id?: string | null
          p_target_turn_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          fork_turn_id: string | null
          generation_locked: boolean
          head_turn_id: string | null
          id: string
          is_active: boolean
          locked_at: string | null
          locked_by_turn_id: string | null
          name: string
          parent_branch_id: string | null
          thread_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "chat_branches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_default_persona: {
        Args: { target_persona_id: string }
        Returns: {
          backstory: string
          boundaries: string
          created_at: string
          goals: string
          id: string
          identity: string
          is_default: boolean
          name: string
          private_notes: string
          updated_at: string
          user_id: string
          voice_style: string
        }
        SetofOptions: {
          from: "*"
          to: "user_personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
