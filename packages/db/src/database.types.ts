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
      admin_set_account_plan: { Args: { p_coach: string; p_plan: string | null }; Returns: undefined };
      admin_teams: {
        Args: Record<PropertyKey, never>;
        Returns: { id: string; name: string; club_name: string; head_coach_email: string; archived: boolean }[];
      };
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
