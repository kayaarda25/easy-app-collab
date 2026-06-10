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
      availabilities: {
        Row: {
          created_at: string
          end_date: string
          id: string
          note: string | null
          property_id: string
          start_date: string
          status: Database["public"]["Enums"]["availability_status"]
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          note?: string | null
          property_id: string
          start_date: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          note?: string | null
          property_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      match_reads: {
        Row: {
          last_read_at: string
          match_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          match_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          id: string
          property_a: string
          property_b: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_a: string
          property_b: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          property_a?: string
          property_b?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_property_a_fkey"
            columns: ["property_a"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_property_b_fkey"
            columns: ["property_b"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          match_id: string
          meta: Json | null
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          match_id: string
          meta?: Json | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          match_id?: string
          meta?: Json | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          emailed_at: string | null
          id: string
          link: string | null
          meta: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          link?: string | null
          meta?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          emailed_at?: string | null
          id?: string
          link?: string | null
          meta?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email_verified_at: string | null
          id: string
          identity_verified_at: string | null
          languages: string[] | null
          onboarded: boolean
          phone_verified_at: string | null
          trusted_host: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_at?: string | null
          id: string
          identity_verified_at?: string | null
          languages?: string[] | null
          onboarded?: boolean
          phone_verified_at?: string | null
          trusted_host?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_at?: string | null
          id?: string
          identity_verified_at?: string | null
          languages?: string[] | null
          onboarded?: boolean
          phone_verified_at?: string | null
          trusted_host?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          amenities: string[] | null
          bathrooms: number
          bedrooms: number
          beds: number
          check_in_instructions: string | null
          check_out_instructions: string | null
          city: string
          country: string
          created_at: string
          description: string | null
          house_number: string | null
          house_rules: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          max_guests: number
          owner_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["property_status"]
          street: string | null
          title: string
          updated_at: string
          verified_at: string | null
          zip_code: string | null
        }
        Insert: {
          amenities?: string[] | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_instructions?: string | null
          check_out_instructions?: string | null
          city: string
          country: string
          created_at?: string
          description?: string | null
          house_number?: string | null
          house_rules?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          max_guests?: number
          owner_id: string
          property_type?: Database["public"]["Enums"]["property_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          street?: string | null
          title: string
          updated_at?: string
          verified_at?: string | null
          zip_code?: string | null
        }
        Update: {
          amenities?: string[] | null
          bathrooms?: number
          bedrooms?: number
          beds?: number
          check_in_instructions?: string | null
          check_out_instructions?: string | null
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          house_number?: string | null
          house_rules?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          max_guests?: number
          owner_id?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["property_status"]
          street?: string | null
          title?: string
          updated_at?: string
          verified_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          position: number
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          property_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          category: Database["public"]["Enums"]["recommendation_category"]
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          link_url: string | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["recommendation_category"]
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["recommendation_category"]
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      review_private_feedback: {
        Row: {
          content: string
          created_at: string
          review_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          review_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_private_feedback_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          proposal_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          proposal_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          proposal_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "swap_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          entitlement: string | null
          expires_at: string | null
          id: string
          original_purchase_at: string | null
          period_type: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          product_id: string | null
          raw_event: Json | null
          revenuecat_customer_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          store: Database["public"]["Enums"]["subscription_store"]
          updated_at: string
          user_id: string
          will_renew: boolean
        }
        Insert: {
          created_at?: string
          entitlement?: string | null
          expires_at?: string | null
          id?: string
          original_purchase_at?: string | null
          period_type?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          product_id?: string | null
          raw_event?: Json | null
          revenuecat_customer_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: Database["public"]["Enums"]["subscription_store"]
          updated_at?: string
          user_id: string
          will_renew?: boolean
        }
        Update: {
          created_at?: string
          entitlement?: string | null
          expires_at?: string | null
          id?: string
          original_purchase_at?: string | null
          period_type?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          product_id?: string | null
          raw_event?: Json | null
          revenuecat_customer_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: Database["public"]["Enums"]["subscription_store"]
          updated_at?: string
          user_id?: string
          will_renew?: boolean
        }
        Relationships: []
      }
      swap_proposals: {
        Row: {
          created_at: string
          end_date: string
          guests: number
          id: string
          match_id: string
          message: string | null
          proposer_id: string
          start_date: string
          status: Database["public"]["Enums"]["proposal_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          guests?: number
          id?: string
          match_id: string
          message?: string | null
          proposer_id: string
          start_date: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          guests?: number
          id?: string
          match_id?: string
          message?: string | null
          proposer_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_proposals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      swipes: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["swipe_direction"]
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["swipe_direction"]
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["swipe_direction"]
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _meta?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      post_system_message: {
        Args: { _body: string; _match_id: string; _meta?: Json }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "admin" | "super_admin"
      availability_status:
        | "available"
        | "blocked"
        | "reserved"
        | "pending_swap"
        | "confirmed_swap"
      property_status: "draft" | "pending" | "approved" | "rejected" | "flagged"
      property_type:
        | "house"
        | "apartment"
        | "villa"
        | "cabin"
        | "loft"
        | "other"
      proposal_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "confirmed"
      recommendation_category:
        | "destination"
        | "bar"
        | "restaurant"
        | "sightseeing"
        | "other"
      subscription_plan: "basic" | "standard" | "premium"
      subscription_status:
        | "free"
        | "trialing"
        | "active"
        | "cancelled"
        | "expired"
        | "payment_failed"
      subscription_store: "app_store" | "play_store" | "none"
      swipe_direction: "like" | "pass"
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
    Enums: {
      app_role: ["user", "admin", "super_admin"],
      availability_status: [
        "available",
        "blocked",
        "reserved",
        "pending_swap",
        "confirmed_swap",
      ],
      property_status: ["draft", "pending", "approved", "rejected", "flagged"],
      property_type: ["house", "apartment", "villa", "cabin", "loft", "other"],
      proposal_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "confirmed",
      ],
      recommendation_category: [
        "destination",
        "bar",
        "restaurant",
        "sightseeing",
        "other",
      ],
      subscription_plan: ["basic", "standard", "premium"],
      subscription_status: [
        "free",
        "trialing",
        "active",
        "cancelled",
        "expired",
        "payment_failed",
      ],
      subscription_store: ["app_store", "play_store", "none"],
      swipe_direction: ["like", "pass"],
    },
  },
} as const
