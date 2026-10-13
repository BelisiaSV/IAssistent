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
      staff_proposals: {
        Row: {
          id: string;
          team_id: string;
          week_plan_id: string;
          role: string;
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
        };
        Insert: {
          id?: string;
          team_id: string;
          week_plan_id: string;
          role: string;
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
        };
        Update: {
          id?: string;
          team_id?: string;
          week_plan_id?: string;
          role?: string;
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
        };
        Relationships: [
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
      proposal_status: "generating" | "ready" | "failed" | "approved" | "rejected";
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
