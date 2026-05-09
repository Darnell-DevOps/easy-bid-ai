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
      ai_insights: {
        Row: {
          action_url: string | null
          created_at: string
          details: Json
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string
          expires_at: string | null
          generated_at: string
          id: string
          kind: string
          recommended_action: string | null
          score: number | null
          severity: string | null
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          details?: Json
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          kind: string
          recommended_action?: string | null
          score?: number | null
          severity?: string | null
          summary: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          details?: Json
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string
          expires_at?: string | null
          generated_at?: string
          id?: string
          kind?: string
          recommended_action?: string | null
          score?: number | null
          severity?: string | null
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      availability_settings: {
        Row: {
          buffer_minutes: number
          created_at: string
          id: string
          min_notice_hours: number
          timezone: string
          updated_at: string
          user_id: string
          working_days: number[]
          working_end: string
          working_start: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          id?: string
          min_notice_hours?: number
          timezone?: string
          updated_at?: string
          user_id: string
          working_days?: number[]
          working_end?: string
          working_start?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          id?: string
          min_notice_hours?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          working_days?: number[]
          working_end?: string
          working_start?: string
        }
        Relationships: []
      }
      booking_links: {
        Row: {
          available_days: number[]
          created_at: string
          custom_location: string | null
          description: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_active: boolean
          location_type: string
          name: string
          slug: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_days?: number[]
          created_at?: string
          custom_location?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          location_type?: string
          name: string
          slug: string
          start_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_days?: number[]
          created_at?: string
          custom_location?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          location_type?: string
          name?: string
          slug?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_link_id: string | null
          client_email: string
          client_message: string | null
          client_name: string
          created_at: string
          duration_minutes: number
          id: string
          location_details: string | null
          location_type: string
          meeting_name: string
          proposal_id: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_link_id?: string | null
          client_email: string
          client_message?: string | null
          client_name: string
          created_at?: string
          duration_minutes?: number
          id?: string
          location_details?: string | null
          location_type?: string
          meeting_name: string
          proposal_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_link_id?: string | null
          client_email?: string
          client_message?: string | null
          client_name?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          location_details?: string | null
          location_type?: string
          meeting_name?: string
          proposal_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: string | null
          method: string
          signature_data: string
          signed_at: string
          signer_email: string | null
          signer_name: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: string | null
          method?: string
          signature_data: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: string | null
          method?: string
          signature_data?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount_cents: number | null
          body: string
          client_email: string | null
          client_id: string | null
          client_name: string
          company_name: string | null
          contract_type: string
          created_at: string
          currency: string | null
          id: string
          proposal_id: string | null
          sent_at: string | null
          signed_at: string | null
          signing_token: string
          status: string
          title: string
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          body?: string
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          company_name?: string | null
          contract_type?: string
          created_at?: string
          currency?: string | null
          id?: string
          proposal_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signing_token?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          body?: string
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          company_name?: string | null
          contract_type?: string
          created_at?: string
          currency?: string | null
          id?: string
          proposal_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signing_token?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: []
      }
      landing_events: {
        Row: {
          created_at: string
          event: string
          id: string
          meta: Json
          path: string | null
          referrer: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          meta?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          meta?: Json
          path?: string | null
          referrer?: string | null
          session_id?: string | null
        }
        Relationships: []
      }
      onboarding_forms: {
        Row: {
          access_token: string
          client_email: string | null
          client_id: string | null
          client_name: string
          completed_at: string | null
          created_at: string
          fields: Json
          id: string
          proposal_id: string | null
          reminded_at: string | null
          responses: Json
          sent_at: string | null
          service_type: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          fields?: Json
          id?: string
          proposal_id?: string | null
          reminded_at?: string | null
          responses?: Json
          sent_at?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          completed_at?: string | null
          created_at?: string
          fields?: Json
          id?: string
          proposal_id?: string | null
          reminded_at?: string | null
          responses?: Json
          sent_at?: string | null
          service_type?: string | null
          started_at?: string | null
          status?: string
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
      retainer_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          due_date: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          paddle_transaction_id: string | null
          paid_at: string | null
          recovered_at: string | null
          retainer_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          due_date: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          paddle_transaction_id?: string | null
          paid_at?: string | null
          recovered_at?: string | null
          retainer_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          due_date?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          paddle_transaction_id?: string | null
          paid_at?: string | null
          recovered_at?: string | null
          retainer_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      retainer_reminders: {
        Row: {
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          retainer_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          retainer_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          retainer_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      retainers: {
        Row: {
          access_token: string
          amount_cents: number
          auto_renew: boolean
          billing_interval: string
          cancel_at_period_end: boolean
          cancelled_at: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          company_name: string | null
          contract_id: string | null
          created_at: string
          currency: string
          current_period_end: string | null
          custom_interval_days: number | null
          description: string | null
          end_date: string | null
          environment: string | null
          failed_payment_at: string | null
          failed_payment_reason: string | null
          has_failed_payment: boolean
          id: string
          last_billed_date: string | null
          last_recovery_email_at: string | null
          last_renewal_email_at: string | null
          next_billing_date: string | null
          notes: string | null
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_product_id: string | null
          paddle_subscription_id: string | null
          paused_at: string | null
          payment_recovered_at: string | null
          payment_retry_count: number
          proposal_id: string | null
          renewed_at: string | null
          scheduled_change: Json | null
          service_type: string | null
          start_date: string
          status: string
          template_key: string | null
          title: string
          total_billed_cents: number
          total_payments_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string
          amount_cents?: number
          auto_renew?: boolean
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          company_name?: string | null
          contract_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          custom_interval_days?: number | null
          description?: string | null
          end_date?: string | null
          environment?: string | null
          failed_payment_at?: string | null
          failed_payment_reason?: string | null
          has_failed_payment?: boolean
          id?: string
          last_billed_date?: string | null
          last_recovery_email_at?: string | null
          last_renewal_email_at?: string | null
          next_billing_date?: string | null
          notes?: string | null
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          paddle_subscription_id?: string | null
          paused_at?: string | null
          payment_recovered_at?: string | null
          payment_retry_count?: number
          proposal_id?: string | null
          renewed_at?: string | null
          scheduled_change?: Json | null
          service_type?: string | null
          start_date?: string
          status?: string
          template_key?: string | null
          title?: string
          total_billed_cents?: number
          total_payments_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          amount_cents?: number
          auto_renew?: boolean
          billing_interval?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          company_name?: string | null
          contract_id?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string | null
          custom_interval_days?: number | null
          description?: string | null
          end_date?: string | null
          environment?: string | null
          failed_payment_at?: string | null
          failed_payment_reason?: string | null
          has_failed_payment?: boolean
          id?: string
          last_billed_date?: string | null
          last_recovery_email_at?: string | null
          last_renewal_email_at?: string | null
          next_billing_date?: string | null
          notes?: string | null
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_product_id?: string | null
          paddle_subscription_id?: string | null
          paused_at?: string | null
          payment_recovered_at?: string | null
          payment_retry_count?: number
          proposal_id?: string | null
          renewed_at?: string | null
          scheduled_change?: Json | null
          service_type?: string | null
          start_date?: string
          status?: string
          template_key?: string | null
          title?: string
          total_billed_cents?: number
          total_payments_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      contract_record_view: { Args: { _token: string }; Returns: undefined }
      contract_sign: {
        Args: {
          _ip: string
          _method: string
          _signature_data: string
          _signer_email: string
          _signer_name: string
          _token: string
          _ua: string
        }
        Returns: string
      }
      mark_proposal_paid: {
        Args: { _proposal_id: string; _txn_id: string }
        Returns: undefined
      }
      onboarding_submit: {
        Args: { _complete?: boolean; _responses: Json; _token: string }
        Returns: string
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
