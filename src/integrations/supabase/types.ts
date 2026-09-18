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
  public: {
    Tables: {
      omnifrog_activity: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          created_at: string
          details: Json
          file_path: string | null
          id: string
          level: string
          message: string
          model: string | null
          operation: string | null
          project_id: string
          provider: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          details?: Json
          file_path?: string | null
          id?: string
          level?: string
          message: string
          model?: string | null
          operation?: string | null
          project_id: string
          provider?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          created_at?: string
          details?: Json
          file_path?: string | null
          id?: string
          level?: string
          message?: string
          model?: string | null
          operation?: string | null
          project_id?: string
          provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnifrog_activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "omnifrog_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      omnifrog_projects: {
        Row: {
          build_state: Json
          created_at: string
          deployment_url: string | null
          files: Json
          id: string
          name: string
          preview_state: Json
          preview_url: string | null
          request: string
          status: string
          updated_at: string
        }
        Insert: {
          build_state?: Json
          created_at?: string
          deployment_url?: string | null
          files?: Json
          id?: string
          name: string
          preview_state?: Json
          preview_url?: string | null
          request: string
          status?: string
          updated_at?: string
        }
        Update: {
          build_state?: Json
          created_at?: string
          deployment_url?: string | null
          files?: Json
          id?: string
          name?: string
          preview_state?: Json
          preview_url?: string | null
          request?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnifrog_providers: {
        Row: {
          capabilities: Json
          category: string
          connection_status: string
          created_at: string
          credential_cipher: string | null
          credential_hint: Json
          credential_ref: string | null
          enabled: boolean
          is_default: boolean
          last_error: Json | null
          last_tested_at: string | null
          models: Json
          models_refreshed_at: string | null
          priority: number
          provider_id: string
          provider_name: string
          selected_model: string | null
          updated_at: string
          usage: Json
        }
        Insert: {
          capabilities?: Json
          category: string
          connection_status?: string
          created_at?: string
          credential_cipher?: string | null
          credential_hint?: Json
          credential_ref?: string | null
          enabled?: boolean
          is_default?: boolean
          last_error?: Json | null
          last_tested_at?: string | null
          models?: Json
          models_refreshed_at?: string | null
          priority?: number
          provider_id: string
          provider_name: string
          selected_model?: string | null
          updated_at?: string
          usage?: Json
        }
        Update: {
          capabilities?: Json
          category?: string
          connection_status?: string
          created_at?: string
          credential_cipher?: string | null
          credential_hint?: Json
          credential_ref?: string | null
          enabled?: boolean
          is_default?: boolean
          last_error?: Json | null
          last_tested_at?: string | null
          models?: Json
          models_refreshed_at?: string | null
          priority?: number
          provider_id?: string
          provider_name?: string
          selected_model?: string | null
          updated_at?: string
          usage?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
