export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
  nodo_inmo: {
    Tables: {
      cash_movements: {
        Row: {
          amount: number
          cash_account_id: string | null
          category: string | null
          concept: string
          concepto_id: string | null
          created_at: string
          currency: string
          date: string
          destination_account_id: string | null
          destination_category: string | null
          id: string
          org_id: string
          owner_id: string | null
          payment_id: string | null
          source: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          category?: string | null
          concept: string
          concepto_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          destination_account_id?: string | null
          destination_category?: string | null
          id?: string
          org_id: string
          owner_id?: string | null
          payment_id?: string | null
          source?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          category?: string | null
          concept?: string
          concepto_id?: string | null
          created_at?: string
          currency?: string
          date?: string
          destination_account_id?: string | null
          destination_category?: string | null
          id?: string
          org_id?: string
          owner_id?: string | null
          payment_id?: string | null
          source?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_concepto_id_fkey"
            columns: ["concepto_id"]
            isOneToOne: false
            referencedRelation: "conceptos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "cash_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_accounts: {
        Row: {
          alias: string | null
          bank_name: string | null
          cbu: string | null
          created_at: string
          currency: string
          id: string
          initial_balance: number
          kind: string
          label: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          alias?: string | null
          bank_name?: string | null
          cbu?: string | null
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          kind?: string
          label: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          alias?: string | null
          bank_name?: string | null
          cbu?: string | null
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          kind?: string
          label?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conceptos: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conceptos_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          can_view_construction: boolean
          can_view_rentals: boolean
          can_view_sales: boolean
          commission_rate: number
          created_at: string
          dni: string | null
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          portal_user_id: string | null
          roles: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          can_view_construction?: boolean
          can_view_rentals?: boolean
          can_view_sales?: boolean
          commission_rate?: number
          created_at?: string
          dni?: string | null
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          portal_user_id?: string | null
          roles?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          can_view_construction?: boolean
          can_view_rentals?: boolean
          can_view_sales?: boolean
          commission_rate?: number
          created_at?: string
          dni?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          portal_user_id?: string | null
          roles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      contract_guarantors: {
        Row: {
          contract_id: string
          created_at: string
          guarantor_id: string
          id: string
          org_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          guarantor_id: string
          id?: string
          org_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          guarantor_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_guarantors_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_guarantors_guarantor_id_fkey"
            columns: ["guarantor_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          adjustment_index: string
          adjustment_period_months: number
          commission_amount: number | null
          contract_type: string
          created_at: string
          currency: string
          deposit_amount: number | null
          end_date: string
          expenses_paid_by: string
          id: string
          next_adjustment_date: string | null
          notes: string | null
          org_id: string
          property_id: string
          rent_amount: number
          signing_city: string | null
          signing_date: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adjustment_index?: string
          adjustment_period_months?: number
          commission_amount?: number | null
          contract_type?: string
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          end_date: string
          expenses_paid_by?: string
          id?: string
          next_adjustment_date?: string | null
          notes?: string | null
          org_id: string
          property_id: string
          rent_amount: number
          signing_city?: string | null
          signing_date?: string | null
          start_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adjustment_index?: string
          adjustment_period_months?: number
          commission_amount?: number | null
          contract_type?: string
          created_at?: string
          currency?: string
          deposit_amount?: number | null
          end_date?: string
          expenses_paid_by?: string
          id?: string
          next_adjustment_date?: string | null
          notes?: string | null
          org_id?: string
          property_id?: string
          rent_amount?: number
          signing_city?: string | null
          signing_date?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          contract_id: string | null
          document_type: string
          file_path: string
          id: string
          label: string
          notes: string | null
          org_id: string
          property_id: string | null
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          contract_id?: string | null
          document_type?: string
          file_path: string
          id?: string
          label: string
          notes?: string | null
          org_id: string
          property_id?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          contract_id?: string | null
          document_type?: string
          file_path?: string
          id?: string
          label?: string
          notes?: string | null
          org_id?: string
          property_id?: string | null
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      org_profiles: {
        Row: {
          address: string | null
          created_at: string
          cuit: string | null
          email: string | null
          legal_name: string | null
          logo_path: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          legal_name?: string | null
          logo_path?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          cuit?: string | null
          email?: string | null
          legal_name?: string | null
          logo_path?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      owner_settlements: {
        Row: {
          amount: number
          breakdown: Json | null
          created_at: string
          currency: string
          id: string
          org_id: string
          owner_id: string
          payment_id: string
          settled_date: string | null
          settlement_group: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          breakdown?: Json | null
          created_at?: string
          currency?: string
          id?: string
          org_id: string
          owner_id: string
          payment_id: string
          settled_date?: string | null
          settlement_group?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          breakdown?: Json | null
          created_at?: string
          currency?: string
          id?: string
          org_id?: string
          owner_id?: string
          payment_id?: string
          settled_date?: string | null
          settlement_group?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_settlements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_settlements_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          currency: string
          due_date: string
          expenses_amount: number
          id: string
          notes: string | null
          org_id: string
          paid_amount: number | null
          paid_date: string | null
          payment_method: string | null
          period: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          currency?: string
          due_date: string
          expenses_amount?: number
          id?: string
          notes?: string | null
          org_id: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          period: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          expenses_amount?: number
          id?: string
          notes?: string | null
          org_id?: string
          paid_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          period?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          bathrooms: number | null
          commission_rate: number | null
          created_at: string
          currency: string
          description: string | null
          has_bbq: boolean
          has_elevator: boolean
          has_garage: boolean
          has_garden: boolean
          has_laundry: boolean
          has_parking: boolean
          has_pool: boolean
          id: string
          inventory_description: string | null
          localidad: string | null
          main_photo: string | null
          operation: string
          org_id: string
          owner_id: string | null
          pets_allowed: boolean
          photos: string[]
          property_type: string
          provincia: string | null
          rooms: number | null
          sale_price: number | null
          status: string
          total_sqm: number | null
          updated_at: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          commission_rate?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          has_bbq?: boolean
          has_elevator?: boolean
          has_garage?: boolean
          has_garden?: boolean
          has_laundry?: boolean
          has_parking?: boolean
          has_pool?: boolean
          id?: string
          inventory_description?: string | null
          localidad?: string | null
          main_photo?: string | null
          operation: string
          org_id: string
          owner_id?: string | null
          pets_allowed?: boolean
          photos?: string[]
          property_type: string
          provincia?: string | null
          rooms?: number | null
          sale_price?: number | null
          status?: string
          total_sqm?: number | null
          updated_at?: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          commission_rate?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          has_bbq?: boolean
          has_elevator?: boolean
          has_garage?: boolean
          has_garden?: boolean
          has_laundry?: boolean
          has_parking?: boolean
          has_pool?: boolean
          id?: string
          inventory_description?: string | null
          localidad?: string | null
          main_photo?: string | null
          operation?: string
          org_id?: string
          owner_id?: string | null
          pets_allowed?: boolean
          photos?: string[]
          property_type?: string
          provincia?: string | null
          rooms?: number | null
          sale_price?: number | null
          status?: string
          total_sqm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_contact_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_expenses: {
        Row: {
          amount: number
          applied_settlement_id: string | null
          charged_to_owner: boolean
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          org_id: string
          property_id: string
          receipt_path: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          applied_settlement_id?: string | null
          charged_to_owner: boolean
          created_at?: string
          currency?: string
          description: string
          expense_date?: string
          id?: string
          org_id: string
          property_id: string
          receipt_path?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applied_settlement_id?: string | null
          charged_to_owner?: boolean
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          org_id?: string
          property_id?: string
          receipt_path?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_expenses_applied_settlement_id_fkey"
            columns: ["applied_settlement_id"]
            isOneToOne: false
            referencedRelation: "owner_settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          category: string
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          org_id: string
          priority: string
          property_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          org_id: string
          priority?: string
          property_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          org_id?: string
          priority?: string
          property_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      owner_chargeable_expenses: {
        Row: {
          amount: number | null
          currency: string | null
          description: string | null
          expense_date: string | null
          expense_id: string | null
          org_id: string | null
          owner_id: string | null
          property_id: string | null
          type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_owner_contact_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      settle_owner: {
        Args: {
          p_currency: string
          p_owner_id: string
          p_settlement_ids: string[]
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
      [_ in never]: never
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
  shared: {
    Tables: {
      indices: {
        Row: {
          created_at: string
          id: string
          kind: string
          period: string
          source: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          period: string
          source?: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          period?: string
          source?: string
          value?: number
        }
        Relationships: []
      }
      nodo_id: {
        Row: {
          created_at: string
          id: string
          org_id: string
          product: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          product: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          product?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodo_id_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          product: string
          tier: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product?: string
          tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product?: string
          tier?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
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
  nodo_inmo: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  shared: {
    Enums: {},
  },
} as const

