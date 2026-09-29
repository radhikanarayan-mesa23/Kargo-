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
      candidates: {
        Row: {
          created_at: string
          cv_path: string | null
          cv_text_redacted: string | null
          email: string
          id: string
          name: string | null
          phone: string | null
          role_applied: Database["public"]["Enums"]["role_applied"]
          status: Database["public"]["Enums"]["candidate_status"]
        }
        Insert: {
          created_at?: string
          cv_path?: string | null
          cv_text_redacted?: string | null
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          role_applied: Database["public"]["Enums"]["role_applied"]
          status?: Database["public"]["Enums"]["candidate_status"]
        }
        Update: {
          created_at?: string
          cv_path?: string | null
          cv_text_redacted?: string | null
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          role_applied?: Database["public"]["Enums"]["role_applied"]
          status?: Database["public"]["Enums"]["candidate_status"]
        }
        Relationships: []
      }
      decisions: {
        Row: {
          candidate_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["decision_type"]
          id: string
          note: string | null
        }
        Insert: {
          candidate_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["decision_type"]
          id?: string
          note?: string | null
        }
        Update: {
          candidate_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["decision_type"]
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          body_template: string
          brief_md: string
          candidate_id: string
          created_at: string
          id: string
          subject: string
          type: Database["public"]["Enums"]["draft_type"]
        }
        Insert: {
          body_template: string
          brief_md: string
          candidate_id: string
          created_at?: string
          id?: string
          subject: string
          type: Database["public"]["Enums"]["draft_type"]
        }
        Update: {
          body_template?: string
          brief_md?: string
          candidate_id?: string
          created_at?: string
          id?: string
          subject?: string
          type?: Database["public"]["Enums"]["draft_type"]
        }
        Relationships: [
          {
            foreignKeyName: "drafts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          candidate_id: string
          error: string | null
          id: string
          mode: Database["public"]["Enums"]["email_mode"]
          resend_id: string | null
          sent_at: string
          status: string
          type: Database["public"]["Enums"]["draft_type"]
        }
        Insert: {
          candidate_id: string
          error?: string | null
          id?: string
          mode: Database["public"]["Enums"]["email_mode"]
          resend_id?: string | null
          sent_at?: string
          status: string
          type: Database["public"]["Enums"]["draft_type"]
        }
        Update: {
          candidate_id?: string
          error?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["email_mode"]
          resend_id?: string | null
          sent_at?: string
          status?: string
          type?: Database["public"]["Enums"]["draft_type"]
        }
        Relationships: [
          {
            foreignKeyName: "emails_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          band: Database["public"]["Enums"]["band"]
          c1: number
          c2: number
          c3: number
          c4: number
          c5: number
          candidate_id: string
          confidence: Json
          created_at: string
          gates: Json
          hidden_value: Json
          key_insight: string
          model: string | null
          probes: Json
          quotes: Json
          risks: Json
          rubric_variant: Database["public"]["Enums"]["rubric_variant"]
          total: number
        }
        Insert: {
          band: Database["public"]["Enums"]["band"]
          c1: number
          c2: number
          c3: number
          c4: number
          c5: number
          candidate_id: string
          confidence?: Json
          created_at?: string
          gates?: Json
          hidden_value?: Json
          key_insight?: string
          model?: string | null
          probes?: Json
          quotes?: Json
          risks?: Json
          rubric_variant: Database["public"]["Enums"]["rubric_variant"]
          total: number
        }
        Update: {
          band?: Database["public"]["Enums"]["band"]
          c1?: number
          c2?: number
          c3?: number
          c4?: number
          c5?: number
          candidate_id?: string
          confidence?: Json
          created_at?: string
          gates?: Json
          hidden_value?: Json
          key_insight?: string
          model?: string | null
          probes?: Json
          quotes?: Json
          risks?: Json
          rubric_variant?: Database["public"]["Enums"]["rubric_variant"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      band: "PRIORITY_SHORTLIST" | "SHORTLIST" | "HOLD" | "DECLINE_QUEUE"
      candidate_status:
        | "uploaded"
        | "scoring"
        | "scored"
        | "needs_review"
        | "advanced"
        | "held"
        | "declined"
      decision_type: "advance" | "hold" | "decline"
      draft_type: "invite" | "decline"
      email_mode: "dry" | "live"
      role_applied: "pm" | "spm"
      rubric_variant: "pm" | "spm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
