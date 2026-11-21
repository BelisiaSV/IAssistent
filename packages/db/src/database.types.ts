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
      bank_exercises: {
        Row: {
          id: string;
          number: string;
          source_id: string | null;
          title: string;
          kind: string;
          phase: string | null;
          target_group: string | null;
          tags: string[];
          principles: string[];
          content: Json;
          media_kind: string | null;
          media_key: string | null;
          media_path: string | null;
          source_title: string | null;
          source_content: Json | null;
          status: string;
          version: number;
          imported_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number: string;
          source_id?: string | null;
          title: string;
          kind: string;
          phase?: string | null;
          target_group?: string | null;
          tags?: string[];
          principles?: string[];
          content: Json;
          media_kind?: string | null;
          media_key?: string | null;
          media_path?: string | null;
          source_title?: string | null;
          source_content?: Json | null;
          status?: string;
          version?: number;
          imported_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number?: string;
          source_id?: string | null;
          title?: string;
          kind?: string;
          phase?: string | null;
          target_group?: string | null;
          tags?: string[];
          principles?: string[];
          content?: Json;
          media_kind?: string | null;
          media_key?: string | null;
          media_path?: string | null;
          source_title?: string | null;
          source_content?: Json | null;
          status?: string;
          version?: number;
          imported_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      coach_tasks: {
        Row: {
          id: string;
          team_id: string;
          title: string;
          done: boolean;
          done_at: string | null;
          role: string | null;
          asked_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          title: string;
          done?: boolean;
          done_at?: string | null;
          role?: string | null;
          asked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          title?: string;
          done?: boolean;
          done_at?: string | null;
          role?: string | null;
          asked_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competition_matches: {
        Row: {
          id: string;
          division: string;
          match_date: string;
          kickoff: string | null;
          home: string;
          away: string;
          home_goals: number | null;
          away_goals: number | null;
          status: string | null;
          matchday: number | null;
          home_club: string | null;
          away_club: string | null;
          referee: string | null;
          assistant_1: string | null;
          assistant_2: string | null;
          fourth_official: string | null;
          match_type: string | null;
          imported_at: string;
        };
        Insert: {
          id?: string;
          division: string;
          match_date: string;
          kickoff?: string | null;
          home: string;
          away: string;
          home_goals?: number | null;
          away_goals?: number | null;
          status?: string | null;
          matchday?: number | null;
          home_club?: string | null;
          away_club?: string | null;
          referee?: string | null;
          assistant_1?: string | null;
          assistant_2?: string | null;
          fourth_official?: string | null;
          match_type?: string | null;
          imported_at?: string;
        };
        Update: {
          id?: string;
          division?: string;
          match_date?: string;
          kickoff?: string | null;
          home?: string;
          away?: string;
          home_goals?: number | null;
          away_goals?: number | null;
          status?: string | null;
          matchday?: number | null;
          home_club?: string | null;
          away_club?: string | null;
          referee?: string | null;
          assistant_1?: string | null;
          assistant_2?: string | null;
          fourth_official?: string | null;
          match_type?: string | null;
          imported_at?: string;
        };
        Relationships: [];
      };
      competition_standings: {
        Row: {
          division: string;
          period: number;
          position: number;
          team: string;
          played: number;
          won: number;
          lost: number;
          drawn: number;
          goals_for: number;
          goals_against: number;
          points: number;
          imported_at: string;
        };
        Insert: {
          division: string;
          period?: number;
          position: number;
          team: string;
          played?: number;
          won?: number;
          lost?: number;
          drawn?: number;
          goals_for?: number;
          goals_against?: number;
          points?: number;
          imported_at?: string;
        };
        Update: {
          division?: string;
          period?: number;
          position?: number;
          team?: string;
          played?: number;
          won?: number;
          lost?: number;
          drawn?: number;
          goals_for?: number;
          goals_against?: number;
          points?: number;
          imported_at?: string;
        };
        Relationships: [];
      };
      coaches: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          plan_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          plan_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          plan_id?: string | null;
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
          federation_number: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          address: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          federation_number?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          address?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          federation_number?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          address?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
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
      club_subscriptions: {
        Row: {
          club_id: string;
          plan_id: string | null;
          license_seats: number;
          max_teams: number | null;
          modules: string[];
          starts_on: string;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          plan_id?: string | null;
          license_seats?: number;
          max_teams?: number | null;
          modules?: string[];
          starts_on?: string;
          ends_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          plan_id?: string | null;
          license_seats?: number;
          max_teams?: number | null;
          modules?: string[];
          starts_on?: string;
          ends_on?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_subscriptions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: true;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      club_licenses: {
        Row: {
          id: string;
          club_id: string;
          coach_id: string;
          status: string;
          activated_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          coach_id: string;
          status?: string;
          activated_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          coach_id?: string;
          status?: string;
          activated_at?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_licenses_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_licenses_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          coach_id: string;
          role: Database["public"]["Enums"]["club_role"];
          license_id: string | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          coach_id: string;
          role: Database["public"]["Enums"]["club_role"];
          license_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          coach_id?: string;
          role?: Database["public"]["Enums"]["club_role"];
          license_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_members_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      club_activation_codes: {
        Row: {
          id: string;
          club_id: string;
          code_hash: string;
          code_hint: string;
          role: Database["public"]["Enums"]["club_role"];
          team_id: string | null;
          team_role: string | null;
          note: string | null;
          expires_at: string | null;
          status: string;
          created_by: string | null;
          created_at: string;
          used_by: string | null;
          used_at: string | null;
          license_id: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          code_hash: string;
          code_hint: string;
          role: Database["public"]["Enums"]["club_role"];
          team_id?: string | null;
          team_role?: string | null;
          note?: string | null;
          expires_at?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          used_by?: string | null;
          used_at?: string | null;
          license_id?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          code_hash?: string;
          code_hint?: string;
          role?: Database["public"]["Enums"]["club_role"];
          team_id?: string | null;
          team_role?: string | null;
          note?: string | null;
          expires_at?: string | null;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          used_by?: string | null;
          used_at?: string | null;
          license_id?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_activation_codes_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      team_staff: {
        Row: {
          id: string;
          team_id: string;
          club_id: string;
          coach_id: string;
          role: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          club_id: string;
          coach_id: string;
          role: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          club_id?: string;
          coach_id?: string;
          role?: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_staff_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_staff_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_staff_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id"];
          },
        ];
      };
      club_team_links: {
        Row: {
          id: string;
          club_id: string;
          team_id: string;
          requested_by: string;
          status: string;
          requested_at: string;
          decided_by: string | null;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          team_id: string;
          requested_by: string;
          status?: string;
          requested_at?: string;
          decided_by?: string | null;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          team_id?: string;
          requested_by?: string;
          status?: string;
          requested_at?: string;
          decided_by?: string | null;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_team_links_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_team_links_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_audit_log: {
        Row: {
          id: number;
          club_id: string;
          actor_id: string | null;
          action: string;
          coach_id: string | null;
          team_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          club_id: string;
          actor_id?: string | null;
          action: string;
          coach_id?: string | null;
          team_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          club_id?: string;
          actor_id?: string | null;
          action?: string;
          coach_id?: string | null;
          team_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_audit_log_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_dna: {
        Row: {
          id: string;
          club_id: string;
          version: number;
          status: string;
          content: Json;
          note: string | null;
          created_by: string | null;
          created_at: string;
          updated_by: string | null;
          updated_at: string;
          published_by: string | null;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          version: number;
          status?: string;
          content?: Json;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_by?: string | null;
          updated_at?: string;
          published_by?: string | null;
          published_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          version?: number;
          status?: string;
          content?: Json;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_by?: string | null;
          updated_at?: string;
          published_by?: string | null;
          published_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_dna_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_exercises: {
        Row: {
          id: string;
          club_id: string;
          number: string;
          title: string;
          kind: string;
          phase: string | null;
          target_group: string | null;
          tags: string[];
          principles: string[];
          content: Json;
          age_categories: string[];
          level: string | null;
          origin: string;
          base_bank_number: string | null;
          source_exercise_id: string | null;
          status: string;
          recommended: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          approved_by: string | null;
          approved_at: string | null;
        };
        Insert: {
          id?: string;
          club_id: string;
          number: string;
          title: string;
          kind: string;
          phase?: string | null;
          target_group?: string | null;
          tags?: string[];
          principles?: string[];
          content?: Json;
          age_categories?: string[];
          level?: string | null;
          origin?: string;
          base_bank_number?: string | null;
          source_exercise_id?: string | null;
          status?: string;
          recommended?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: {
          id?: string;
          club_id?: string;
          number?: string;
          title?: string;
          kind?: string;
          phase?: string | null;
          target_group?: string | null;
          tags?: string[];
          principles?: string[];
          content?: Json;
          age_categories?: string[];
          level?: string | null;
          origin?: string;
          base_bank_number?: string | null;
          source_exercise_id?: string | null;
          status?: string;
          recommended?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_exercises_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_bank_picks: {
        Row: {
          club_id: string;
          bank_number: string;
          recommended: boolean;
          note: string | null;
          picked_by: string | null;
          created_at: string;
        };
        Insert: {
          club_id: string;
          bank_number: string;
          recommended?: boolean;
          note?: string | null;
          picked_by?: string | null;
          created_at?: string;
        };
        Update: {
          club_id?: string;
          bank_number?: string;
          recommended?: boolean;
          note?: string | null;
          picked_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_bank_picks_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_bank_picks_bank_number_fkey";
            columns: ["bank_number"];
            isOneToOne: false;
            referencedRelation: "bank_exercises";
            referencedColumns: ["number"];
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
      staff_meeting_turns: {
        Row: {
          id: string;
          meeting_id: string;
          team_id: string;
          version: number;
          position: number;
          role: string;
          kind: "opening" | "bijdrage" | "reactie" | "overzicht";
          status: "pending" | "generating" | "ready" | "failed";
          output: Json | null;
          provider: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          team_id: string;
          version: number;
          position: number;
          role: string;
          kind: "opening" | "bijdrage" | "reactie" | "overzicht";
          status?: "pending" | "generating" | "ready" | "failed";
          output?: Json | null;
          provider: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          team_id?: string;
          version?: number;
          position?: number;
          role?: string;
          kind?: "opening" | "bijdrage" | "reactie" | "overzicht";
          status?: "pending" | "generating" | "ready" | "failed";
          output?: Json | null;
          provider?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_meeting_turns_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "staff_meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_meeting_turns_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_meetings: {
        Row: {
          id: string;
          team_id: string;
          assignment: string;
          status: "running" | "ready" | "failed" | "approved";
          version: number;
          feedbacks: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          assignment: string;
          status?: "running" | "ready" | "failed" | "approved";
          version?: number;
          feedbacks?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          assignment?: string;
          status?: "running" | "ready" | "failed" | "approved";
          version?: number;
          feedbacks?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_meetings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_messages: {
        Row: {
          id: string;
          team_id: string;
          role: string;
          author: "coach" | "role";
          content: string;
          task_proposal: Json | null;
          provider: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          role: string;
          author: "coach" | "role";
          content: string;
          task_proposal?: Json | null;
          provider?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          role?: string;
          author?: "coach" | "role";
          content?: string;
          task_proposal?: Json | null;
          provider?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_messages_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_task_steps: {
        Row: {
          id: string;
          task_id: string;
          team_id: string;
          version: number;
          position: number;
          role: string;
          phase: "bijdrage" | "eindvoorstel";
          status: "pending" | "generating" | "ready" | "failed";
          output: Json | null;
          provider: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          team_id: string;
          version: number;
          position: number;
          role: string;
          phase: "bijdrage" | "eindvoorstel";
          status?: "pending" | "generating" | "ready" | "failed";
          output?: Json | null;
          provider: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          team_id?: string;
          version?: number;
          position?: number;
          role?: string;
          phase?: "bijdrage" | "eindvoorstel";
          status?: "pending" | "generating" | "ready" | "failed";
          output?: Json | null;
          provider?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_task_steps_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "staff_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_task_steps_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_tasks: {
        Row: {
          id: string;
          team_id: string;
          source_message_id: string;
          owner_role: string;
          roles: string[];
          title: string;
          assignment: string;
          status: "running" | "ready" | "failed" | "approved";
          version: number;
          feedback: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          source_message_id: string;
          owner_role: string;
          roles: string[];
          title: string;
          assignment: string;
          status?: "running" | "ready" | "failed" | "approved";
          version?: number;
          feedback?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          team_id?: string;
          source_message_id?: string;
          owner_role?: string;
          roles?: string[];
          title?: string;
          assignment?: string;
          status?: "running" | "ready" | "failed" | "approved";
          version?: number;
          feedback?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          decided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_tasks_source_message_id_fkey";
            columns: ["source_message_id"];
            isOneToOne: true;
            referencedRelation: "staff_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_tasks_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
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
          deleted_at: string | null;
          meeting_id: string | null;
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
          deleted_at?: string | null;
          meeting_id?: string | null;
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
          deleted_at?: string | null;
          meeting_id?: string | null;
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
          principle_override: Json | null;
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
          principle_override?: Json | null;
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
          principle_override?: Json | null;
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
          home_address: string | null;
          default_formation: string | null;
          age_category: string;
          preparation_start_date: string | null;
          preparation_weeks: number;
          animation_settings: Json;
          periodization_weeks: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          yellow_card_limit: number;
          yellow_card_ban: number;
          red_card_ban: number;
          federation_team: string | null;
          federation_divisions: string[];
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
          home_address?: string | null;
          default_formation?: string | null;
          age_category?: string;
          preparation_start_date?: string | null;
          preparation_weeks?: number;
          animation_settings?: Json;
          periodization_weeks?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          yellow_card_limit?: number;
          yellow_card_ban?: number;
          red_card_ban?: number;
          federation_team?: string | null;
          federation_divisions?: string[];
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
          home_address?: string | null;
          default_formation?: string | null;
          age_category?: string;
          preparation_start_date?: string | null;
          preparation_weeks?: number;
          animation_settings?: Json;
          periodization_weeks?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          yellow_card_limit?: number;
          yellow_card_ban?: number;
          red_card_ban?: number;
          federation_team?: string | null;
          federation_divisions?: string[];
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
      plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          audience: string;
          description: string | null;
          price_cents: number | null;
          billing_period: string;
          yearly_price_cents: number | null;
          max_coaches: number | null;
          max_teams: number | null;
          features: Json;
          modules: string[];
          recommended: boolean;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          audience: string;
          description?: string | null;
          price_cents?: number | null;
          billing_period?: string;
          yearly_price_cents?: number | null;
          max_coaches?: number | null;
          max_teams?: number | null;
          features?: Json;
          modules?: string[];
          recommended?: boolean;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          audience?: string;
          description?: string | null;
          price_cents?: number | null;
          billing_period?: string;
          yearly_price_cents?: number | null;
          max_coaches?: number | null;
          max_teams?: number | null;
          features?: Json;
          modules?: string[];
          recommended?: boolean;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          address: string | null;
          coach_name: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          logo_path: string | null;
          shirt_color: string | null;
          shirt_trim_color: string | null;
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
          address?: string | null;
          coach_name?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          logo_path?: string | null;
          shirt_color?: string | null;
          shirt_trim_color?: string | null;
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
          address?: string | null;
          coach_name?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          logo_path?: string | null;
          shirt_color?: string | null;
          shirt_trim_color?: string | null;
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
      club_activation_code_secrets: {
        Row: { code_id: string; code: string };
        Insert: { code_id: string; code: string };
        Update: { code_id?: string; code?: string };
        Relationships: [];
      };
      platform_admins: {
        Row: { coach_id: string; created_at: string };
        Insert: { coach_id: string; created_at?: string };
        Update: { coach_id?: string; created_at?: string };
        Relationships: [];
      };
      player_cards: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          match_date: string;
          card: "yellow" | "red";
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          match_date: string;
          card: "yellow" | "red";
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          player_id?: string;
          match_date?: string;
          card?: "yellow" | "red";
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_cards_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_cards_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
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
      exercises: {
        Row: {
          id: string;
          coach_id: string;
          title: string;
          phase: "opwarming" | "kern" | "afsluiting" | null;
          labels: string[];
          min_players: number | null;
          max_players: number | null;
          duration_min: number | null;
          organisation: string | null;
          course: string[];
          coaching_points: string[];
          variations: string[];
          animation: Json | null;
          video_path: string | null;
          sets: number | null;
          work_min: number | null;
          rest_min: number | null;
          intensity: "laag" | "matig" | "hoog" | "maximaal" | null;
          rpe: number | null;
          use_in_planning: boolean;
          kind: "exercise" | "set_piece";
          set_piece_type: string | null;
          signal: string | null;
          roles: Json;
          bank_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id?: string;
          title: string;
          phase?: "opwarming" | "kern" | "afsluiting" | null;
          labels?: string[];
          min_players?: number | null;
          max_players?: number | null;
          duration_min?: number | null;
          organisation?: string | null;
          course?: string[];
          coaching_points?: string[];
          variations?: string[];
          animation?: Json | null;
          video_path?: string | null;
          sets?: number | null;
          work_min?: number | null;
          rest_min?: number | null;
          intensity?: "laag" | "matig" | "hoog" | "maximaal" | null;
          rpe?: number | null;
          use_in_planning?: boolean;
          kind?: "exercise" | "set_piece";
          set_piece_type?: string | null;
          signal?: string | null;
          roles?: Json;
          bank_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          title?: string;
          phase?: "opwarming" | "kern" | "afsluiting" | null;
          labels?: string[];
          min_players?: number | null;
          max_players?: number | null;
          duration_min?: number | null;
          organisation?: string | null;
          course?: string[];
          coaching_points?: string[];
          variations?: string[];
          animation?: Json | null;
          video_path?: string | null;
          sets?: number | null;
          work_min?: number | null;
          rest_min?: number | null;
          intensity?: "laag" | "matig" | "hoog" | "maximaal" | null;
          rpe?: number | null;
          use_in_planning?: boolean;
          kind?: "exercise" | "set_piece";
          set_piece_type?: string | null;
          signal?: string | null;
          roles?: Json;
          bank_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_coach_id_fkey";
            columns: ["coach_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
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
      admin_import_players: { Args: { p_team_id: string; p_players: Json }; Returns: Json };
      admin_team_players: { Args: { p_team_id: string }; Returns: Database["public"]["Tables"]["players"]["Row"][] };
      admin_competition_teams: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; name: string; club_name: string; archived: boolean; federation_team: string | null; federation_divisions: string[] }[];
      };
      admin_import_competition: {
        Args: { p_divisions: string[]; p_matches: Json; p_standings: Json; p_referees: Json };
        Returns: Json;
      };
      admin_set_team_competition: { Args: { p_team: string; p_federation_team: string; p_divisions: string[] }; Returns: undefined };
      admin_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; email: string; full_name: string | null; plan_id: string | null }[];
      };
      admin_import_bank_exercises: { Args: { p_exercises: Json }; Returns: Json };
      admin_update_bank_exercise: {
        Args: {
          p_id: string;
          p_title: string;
          p_kind: string;
          p_phase: string | null;
          p_target_group: string | null;
          p_tags: string[];
          p_principles: string[];
          p_content: Json;
        };
        Returns: undefined;
      };
      admin_set_bank_exercise_media: { Args: { p_number: string; p_path: string | null; p_kind: string | null }; Returns: undefined };
      admin_set_bank_media: { Args: { p_media_key: string; p_path: string }; Returns: number };
      admin_set_bank_exercise_status: { Args: { p_id: string; p_status: string }; Returns: undefined };
      admin_set_account_plan: { Args: { p_coach: string; p_plan: string | null }; Returns: undefined };
      admin_teams: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; name: string; club_name: string; head_coach_email: string; archived: boolean }[];
      };
      admin_create_club: { Args: { p_name: string; p_federation_number?: string | null }; Returns: string };
      admin_club_members: {
        Args: { p_club_id: string };
        Returns: {
          coach_id: string;
          name: string | null;
          email: string;
          roles: string[] | null;
          license_id: string | null;
          license_status: string | null;
          active: boolean;
          since: string;
        }[];
      };
      admin_club_teams: {
        Args: { p_club_id: string };
        Returns: {
          id: string;
          name: string;
          age_category: string;
          season: string | null;
          archived: boolean;
          federation_team: string | null;
          federation_divisions: string[];
          staff: Json;
        }[];
      };
      admin_clubs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          federation_number: string | null;
          active: boolean;
          plan_name: string | null;
          license_seats: number;
          seats_used: number;
          max_teams: number | null;
          active_teams: number;
          members: number;
          ends_on: string | null;
        }[];
      };
      admin_federation_clubs: {
        Args: Record<PropertyKey, never>;
        Returns: { number: string; name: string; teams: Json; club_id: string | null }[];
      };
      admin_import_club: { Args: { p_club_id: string; p_data: Json }; Returns: Json };
      admin_save_federation_clubs: { Args: { p_clubs: Json }; Returns: number };
      admin_update_club: {
        Args: {
          p_club_id: string;
          p_name: string;
          p_federation_number: string | null;
          p_primary_color: string | null;
          p_secondary_color: string | null;
          p_address: string | null;
          p_contact_name: string | null;
          p_contact_email: string | null;
          p_contact_phone: string | null;
        };
        Returns: undefined;
      };
      admin_set_club_subscription: {
        Args: {
          p_club_id: string;
          p_plan_id: string | null;
          p_license_seats: number;
          p_max_teams: number | null;
          p_modules: string[] | null;
          p_starts_on: string | null;
          p_ends_on: string | null;
        };
        Returns: undefined;
      };
      assign_team_staff: { Args: { p_team_id: string; p_coach_id: string; p_role: string }; Returns: string };
      cancel_club_team_link: { Args: { p_link_id: string }; Returns: undefined };
      discard_club_dna_draft: { Args: { p_club_id: string }; Returns: undefined };
      publish_club_dna: { Args: { p_club_id: string; p_note?: string | null }; Returns: undefined };
      save_club_dna_draft: { Args: { p_club_id: string; p_content: Json }; Returns: string };
      save_club_exercise: { Args: { p_club_id: string; p_id: string | null; p_data: Json }; Returns: string };
      set_club_bank_pick: {
        Args: { p_club_id: string; p_bank_number: string; p_pick: boolean; p_recommended?: boolean };
        Returns: undefined;
      };
      set_club_exercise_recommended: { Args: { p_id: string; p_recommended: boolean }; Returns: undefined };
      set_club_exercise_status: { Args: { p_id: string; p_status: string }; Returns: undefined };
      club_people: {
        Args: { p_club_id: string };
        Returns: {
          coach_id: string;
          name: string | null;
          email: string;
          roles: string[] | null;
          license_id: string | null;
          license_status: string | null;
          active: boolean;
          since: string;
        }[];
      };
      club_pending_links: {
        Args: { p_club_id: string };
        Returns: { id: string; team_name: string; team_club_name: string; requester: string; requested_at: string }[];
      };
      club_has_module: { Args: { p_club_id: string; p_module: string }; Returns: boolean };
      club_is_active: { Args: { p_club_id: string }; Returns: boolean };
      club_module_codes: { Args: Record<PropertyKey, never>; Returns: string[] };
      club_seats_used: { Args: { p_club_id: string }; Returns: number };
      create_club_activation_code: {
        Args: {
          p_club_id: string;
          p_role: Database["public"]["Enums"]["club_role"];
          p_expires_at?: string | null;
          p_team_id?: string | null;
          p_team_role?: string | null;
          p_note?: string | null;
        };
        Returns: { id: string; code: string }[];
      };
      create_club_team: {
        Args: { p_club_id: string; p_name: string; p_club_name: string; p_age_category?: string | null; p_season?: string | null };
        Returns: string;
      };
      decide_club_team_link: { Args: { p_link_id: string; p_approve: boolean }; Returns: undefined };
      end_club_role: { Args: { p_member_id: string }; Returns: undefined };
      end_team_staff: { Args: { p_staff_id: string }; Returns: undefined };
      has_club_role: { Args: { p_club_id: string; p_roles: Database["public"]["Enums"]["club_role"][] }; Returns: boolean };
      has_team_staff_role: { Args: { p_team_id: string; p_roles: string[] }; Returns: boolean };
      is_club_member: { Args: { p_club_id: string }; Returns: boolean };
      redeem_club_activation_code: { Args: { p_code: string }; Returns: Json };
      request_club_team_link: { Args: { p_team_id: string; p_club_id: string }; Returns: string };
      reissue_club_activation_code: { Args: { p_code_id: string }; Returns: { id: string; code: string }[] };
      reveal_club_activation_code: { Args: { p_code_id: string }; Returns: string | null };
      revoke_club_activation_code: { Args: { p_code_id: string }; Returns: undefined };
      revoke_club_license: { Args: { p_license_id: string }; Returns: undefined };
      can_read_coach_profile: { Args: { p_coach_id: string }; Returns: boolean };
      can_read_team: { Args: { p_team_id: string }; Returns: boolean };
      can_see_club: { Args: { p_club_id: string }; Returns: boolean };
      can_see_coach: { Args: { p_coach_id: string }; Returns: boolean };
      can_read_division: { Args: { p_division: string }; Returns: boolean };
      can_write_team: { Args: { p_team_id: string }; Returns: boolean };
      has_assistant_access: { Args: { p_team_id: string }; Returns: boolean };
      is_club_owner: { Args: { p_club_id: string }; Returns: boolean };
      is_feature_enabled: { Args: { p_key: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_team_head_coach: { Args: { p_team_id: string }; Returns: boolean };
      staff_chat_daily_limit: { Args: Record<PropertyKey, never>; Returns: number };
      staff_daily_limit: { Args: Record<PropertyKey, never>; Returns: number };
      staff_meeting_daily_limit: { Args: Record<PropertyKey, never>; Returns: number };
      staff_task_daily_limit: { Args: Record<PropertyKey, never>; Returns: number };
      team_id_from_storage_path: { Args: { p_name: string }; Returns: string };
    };
    Enums: {
      club_role: "owner" | "admin" | "technical_director" | "team_coordinator" | "coach" | "assistant_coach";
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
