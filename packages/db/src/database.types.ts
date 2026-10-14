// Format of `supabase gen types typescript`. Regenerate after each migration
// (see README). Kept in line with supabase/migrations by hand until then.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      coaches: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coach_profiles: {
        Row: {
          coach_id: string;
          vision_summary: string | null;
          vision: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          vision_summary?: string | null;
          vision?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          coach_id?: string;
          vision_summary?: string | null;
          vision?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_profiles_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: true;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      coach_profile_shares: {
        Row: {
          id: string;
          coach_id: string;
          shared_with_coach_id: string | null;
          shared_with_club_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          shared_with_coach_id?: string | null;
          shared_with_club_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          shared_with_coach_id?: string | null;
          shared_with_club_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_profile_shares_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_profile_shares_shared_with_coach_id_fkey";
            columns: ["shared_with_coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coach_profile_shares_shared_with_club_id_fkey";
            columns: ["shared_with_club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          license_seats: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          license_seats?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          license_seats?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      session_loads: {
        Row: {
          id: string;
          team_id: string;
          session_date: string;
          kind: "training" | "match";
          rpe: number;
          duration_min: number;
          attendance: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          session_date: string;
          kind: "training" | "match";
          rpe: number;
          duration_min: number;
          attendance?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          session_date?: string;
          kind?: "training" | "match";
          rpe?: number;
          duration_min?: number;
          attendance?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_loads_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_loads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_proposals: {
        Row: {
          id: string;
          team_id: string;
          week_plan_id: string;
          role: string;
          task: string;
          version: number;
          status: Database["public"]["Enums"]["proposal_status"];
          feedback: string | null;
          output: Json | null;
          error: string | null;
          provider: string;
          model: string | null;
          usage: Json | null;
          content_version: string | null;
          created_by: string;
          created_at: string;
          decided_at: string | null;
          run_id: string | null;
          step: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          week_plan_id: string;
          role: string;
          task?: string;
          version?: number;
          status?: Database["public"]["Enums"]["proposal_status"];
          feedback?: string | null;
          output?: Json | null;
          error?: string | null;
          provider: string;
          model?: string | null;
          usage?: Json | null;
          content_version?: string | null;
          created_by?: string;
          created_at?: string;
          decided_at?: string | null;
          run_id?: string | null;
          step?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          week_plan_id?: string;
          role?: string;
          task?: string;
          version?: number;
          status?: Database["public"]["Enums"]["proposal_status"];
          feedback?: string | null;
          output?: Json | null;
          error?: string | null;
          provider?: string;
          model?: string | null;
          usage?: Json | null;
          content_version?: string | null;
          created_by?: string;
          created_at?: string;
          decided_at?: string | null;
          run_id?: string | null;
          step?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_proposals_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "staff_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_proposals_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_proposals_week_plan_id_fkey";
            columns: ["week_plan_id"];
            isOneToOne: false;
            referencedRelation: "week_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_proposals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_runs: {
        Row: {
          id: string;
          team_id: string;
          week_plan_id: string;
          kind: "week" | "match";
          version: number;
          status: "generating" | "ready" | "failed" | "approved" | "rejected";
          feedback: string | null;
          feedback_step: string | null;
          based_on: string | null;
          provider: string;
          created_by: string;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          week_plan_id: string;
          kind: "week" | "match";
          version?: number;
          status?: "generating" | "ready" | "failed" | "approved" | "rejected";
          feedback?: string | null;
          feedback_step?: string | null;
          based_on?: string | null;
          provider: string;
          created_by?: string;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          week_plan_id?: string;
          kind?: "week" | "match";
          version?: number;
          status?: "generating" | "ready" | "failed" | "approved" | "rejected";
          feedback?: string | null;
          feedback_step?: string | null;
          based_on?: string | null;
          provider?: string;
          created_by?: string;
          created_at?: string;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_runs_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_runs_week_plan_id_fkey";
            columns: ["week_plan_id"];
            isOneToOne: false;
            referencedRelation: "week_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      week_plans: {
        Row: {
          id: string;
          team_id: string;
          week_start: string;
          trainings: Json;
          matches: Json;
          previous_match_date: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          week_start: string;
          trainings?: Json;
          matches?: Json;
          previous_match_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          week_start?: string;
          trainings?: Json;
          matches?: Json;
          previous_match_date?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "week_plans_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "week_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          head_coach_id: string;
          club_id: string | null;
          name: string;
          season: string | null;
          club_name: string;
          logo_path: string | null;
          primary_color: string;
          secondary_color: string;
          training_schedule: Json;
          competition_start_date: string | null;
          periodization_weeks: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          head_coach_id: string;
          club_id?: string | null;
          name: string;
          season?: string | null;
          club_name: string;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          training_schedule?: Json;
          competition_start_date?: string | null;
          periodization_weeks?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          head_coach_id?: string;
          club_id?: string | null;
          name?: string;
          season?: string | null;
          club_name?: string;
          logo_path?: string | null;
          primary_color?: string;
          secondary_color?: string;
          training_schedule?: Json;
          competition_start_date?: string | null;
          periodization_weeks?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_head_coach_id_fkey";
            columns: ["head_coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      fitness_tests: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          test_code: string;
          test_date: string;
          result: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          test_code: string;
          test_date: string;
          result: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          player_id?: string;
          test_code?: string;
          test_date?: string;
          result?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fitness_tests_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitness_tests_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fitness_tests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      lineups: {
        Row: {
          id: string;
          team_id: string;
          title: string;
          match_date: string | null;
          opponent: string | null;
          formation: string;
          starters: Json;
          bench: string[];
          source: "coach" | "tactical-coach";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          title: string;
          match_date?: string | null;
          opponent?: string | null;
          formation: string;
          starters?: Json;
          bench?: string[];
          source?: "coach" | "tactical-coach";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          title?: string;
          match_date?: string | null;
          opponent?: string | null;
          formation?: string;
          starters?: Json;
          bench?: string[];
          source?: "coach" | "tactical-coach";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lineups_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      match_reports: {
        Row: {
          id: string;
          team_id: string;
          match_date: string;
          opponent_id: string | null;
          opponent_name: string;
          home: boolean | null;
          goals_for: number | null;
          goals_against: number | null;
          own_formation: string | null;
          opponent_formation: string | null;
          went_well: string | null;
          went_badly: string | null;
          lessons: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_date: string;
          opponent_id?: string | null;
          opponent_name: string;
          home?: boolean | null;
          goals_for?: number | null;
          goals_against?: number | null;
          own_formation?: string | null;
          opponent_formation?: string | null;
          went_well?: string | null;
          went_badly?: string | null;
          lessons?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          match_date?: string;
          opponent_id?: string | null;
          opponent_name?: string;
          home?: boolean | null;
          goals_for?: number | null;
          goals_against?: number | null;
          own_formation?: string | null;
          opponent_formation?: string | null;
          went_well?: string | null;
          went_badly?: string | null;
          lessons?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_reports_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_reports_opponent_id_fkey";
            columns: ["opponent_id"];
            isOneToOne: false;
            referencedRelation: "opponents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_reports_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          coach_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          club_id: string | null;
          team_id: string | null;
          valid_from: string;
          valid_until: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          club_id?: string | null;
          team_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          granted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          club_id?: string | null;
          team_id?: string | null;
          valid_from?: string;
          valid_until?: string | null;
          granted_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      opponent_lineups: {
        Row: {
          id: string;
          team_id: string;
          opponent_id: string;
          match_date: string | null;
          source: "coach" | "video";
          formation: string;
          starters: Json;
          bench: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          opponent_id: string;
          match_date?: string | null;
          source?: "coach" | "video";
          formation: string;
          starters?: Json;
          bench?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          opponent_id?: string;
          match_date?: string | null;
          source?: "coach" | "video";
          formation?: string;
          starters?: Json;
          bench?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opponent_lineups_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opponent_lineups_opponent_id_fkey";
            columns: ["opponent_id"];
            isOneToOne: false;
            referencedRelation: "opponents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opponent_lineups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      opponents: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          play_style: string | null;
          strengths: string | null;
          weaknesses: string | null;
          set_pieces: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          play_style?: string | null;
          strengths?: string | null;
          weaknesses?: string | null;
          set_pieces?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          name?: string;
          play_style?: string | null;
          strengths?: string | null;
          weaknesses?: string | null;
          set_pieces?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opponents_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opponents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      players: {
        Row: {
          id: string;
          team_id: string;
          first_name: string;
          last_name: string;
          shirt_number: number | null;
          primary_position: string | null;
          secondary_positions: string[];
          preferred_foot: Database["public"]["Enums"]["preferred_foot"] | null;
          joined_club_year: number | null;
          expected_return_date: string | null;
          archived_at: string | null;
          birth_year: number | null;
          status: Database["public"]["Enums"]["player_status"];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          first_name: string;
          last_name: string;
          shirt_number?: number | null;
          primary_position?: string | null;
          secondary_positions?: string[];
          preferred_foot?: Database["public"]["Enums"]["preferred_foot"] | null;
          joined_club_year?: number | null;
          expected_return_date?: string | null;
          archived_at?: string | null;
          birth_year?: number | null;
          status?: Database["public"]["Enums"]["player_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          first_name?: string;
          last_name?: string;
          shirt_number?: number | null;
          primary_position?: string | null;
          secondary_positions?: string[];
          preferred_foot?: Database["public"]["Enums"]["preferred_foot"] | null;
          joined_club_year?: number | null;
          expected_return_date?: string | null;
          archived_at?: string | null;
          birth_year?: number | null;
          status?: Database["public"]["Enums"]["player_status"];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          enabled: boolean;
          coach_id: string | null;
          club_id: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          enabled?: boolean;
          coach_id?: string | null;
          club_id?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          enabled?: boolean;
          coach_id?: string | null;
          club_id?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_flags_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feature_flags_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_read_coach_profile: { Args: { p_coach_id: string }; Returns: boolean };
      can_read_team: { Args: { p_team_id: string }; Returns: boolean };
      can_see_club: { Args: { p_club_id: string }; Returns: boolean };
      can_see_coach: { Args: { p_coach_id: string }; Returns: boolean };
      can_write_team: { Args: { p_team_id: string }; Returns: boolean };
      has_assistant_access: { Args: { p_team_id: string }; Returns: boolean };
      is_club_owner: { Args: { p_club_id: string }; Returns: boolean };
      is_feature_enabled: { Args: { p_key: string }; Returns: boolean };
      is_team_head_coach: { Args: { p_team_id: string }; Returns: boolean };
      staff_daily_limit: { Args: Record<PropertyKey, never>; Returns: number };
      team_id_from_storage_path: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      membership_role: "club_owner" | "assistant_coach";
      player_status: "available" | "injured" | "suspended" | "unavailable";
      preferred_foot: "left" | "right" | "both";
      proposal_status: "pending" | "generating" | "ready" | "failed" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
