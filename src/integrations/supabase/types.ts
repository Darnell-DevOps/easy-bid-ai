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
      clients: {
        Row: {
          ai_recommendation: string | null
          budget: string | null
          company: string | null
          created_at: string
          email: string | null
          goals: string | null
          id: string
          is_active: boolean
          lead_quality: string | null
          lead_source: string | null
          name: string
          original_lead_message: string | null
          phone: string | null
          project_description: string | null
          service_requested: string | null
          status: string
          timeline: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_recommendation?: string | null
          budget?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          goals?: string | null
          id?: string
          is_active?: boolean
          lead_quality?: string | null
          lead_source?: string | null
          name: string
          original_lead_message?: string | null
          phone?: string | null
          project_description?: string | null
          service_requested?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_recommendation?: string | null
          budget?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          goals?: string | null
          id?: string
          is_active?: boolean
          lead_quality?: string | null
          lead_source?: string | null
          name?: string
          original_lead_message?: string | null
          phone?: string | null
          project_description?: string | null
          service_requested?: string | null
          status?: string
          timeline?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      policies: {
        Row: {
          business_name: string
          business_type: string
          content: string
          country: string
          created_at: string
          data_collection: string | null
          id: string
          payment_methods: string | null
          policy_type: string
          refund_rules: string | null
          services_offered: string | null
          special_requirements: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          business_type: string
          content?: string
          country: string
          created_at?: string
          data_collection?: string | null
          id?: string
          payment_methods?: string | null
          policy_type: string
          refund_rules?: string | null
          services_offered?: string | null
          special_requirements?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          business_type?: string
          content?: string
          country?: string
          created_at?: string
          data_collection?: string | null
          id?: string
          payment_methods?: string | null
          policy_type?: string
          refund_rules?: string | null
          services_offered?: string | null
          special_requirements?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_at: string | null
          amount_cents: number | null
          budget: string
          client_id: string | null
          client_name: string
          client_paid: boolean
          client_response_message: string | null
          company_name: string
          created_at: string
          currency: string | null
          id: string
          invoice_content: string | null
          notes: string | null
          paddle_transaction_id: string | null
          paid_at: string | null
          pricing_breakdown: string | null
          project_scope: string
          proposal_content: string | null
          rejected_at: string | null
          sent_at: string | null
          service_type: string
          status: string
          timeline: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount_cents?: number | null
          budget?: string
          client_id?: string | null
          client_name: string
          client_paid?: boolean
          client_response_message?: string | null
          company_name: string
          created_at?: string
          currency?: string | null
          id?: string
          invoice_content?: string | null
          notes?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          pricing_breakdown?: string | null
          project_scope?: string
          proposal_content?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          service_type: string
          status?: string
          timeline?: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount_cents?: number | null
          budget?: string
          client_id?: string | null
          client_name?: string
          client_paid?: boolean
          client_response_message?: string | null
          company_name?: string
          created_at?: string
          currency?: string | null
          id?: string
          invoice_content?: string | null
          notes?: string | null
          paddle_transaction_id?: string | null
          paid_at?: string | null
          pricing_breakdown?: string | null
          project_scope?: string
          proposal_content?: string | null
          rejected_at?: string | null
          sent_at?: string | null
          service_type?: string
          status?: string
          timeline?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_portal_respond: {
        Args: { _action: string; _message?: string; _proposal_id: string }
        Returns: undefined
      }
      mark_proposal_paid: {
        Args: { _proposal_id: string; _txn_id: string }
        Returns: undefined
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
  public: {
    Enums: {},
  },
} as const
