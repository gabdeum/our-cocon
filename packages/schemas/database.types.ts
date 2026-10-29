
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"family_id": string,"id": string,"payload": NonNullable<Json>,"seq": number,"source": string,"target_id": string | null,"target_kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"payload"?: NonNullable<Json>,"seq"?: never,"source"?: string,"target_id"?: string | null,"target_kind": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"seq"?: never,"source"?: string,"target_id"?: string | null,"target_kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_permissions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"events": boolean,"family_id": string,"groceries": boolean,"id": string,"recipes_delete": boolean,"recipes_edit": boolean,"source": string,"updated_at": string,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"events"?: boolean,"family_id": string,"groceries"?: boolean,"id"?: string,"recipes_delete"?: boolean,"recipes_edit"?: boolean,"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"events"?: boolean,"family_id"?: string,"groceries"?: boolean,"id"?: string,"recipes_delete"?: boolean,"recipes_edit"?: boolean,"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_permissions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_permissions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["user_id"]
    }
                  ]
                },"assistant_use": {
                  Row: {
                    "client_id": string,"last_used_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"last_used_at"?: string,"user_id": string
                  }
                  Update: {
                    "client_id"?: string,"last_used_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"catalog_ingredients": {
                  Row: {
                    "aisle": Database["public"]['Enums']["aisle"],"default_size": Database["public"]['Enums']["size_word"] | null,"density_g_per_ml": number | null,"diet": (string)[],"key": string,"names": NonNullable<Json>,"noun_plural": string | null,"noun_singular": string | null,"size_large_g": number | null,"size_medium_g": number | null,"size_small_g": number | null,"synonyms": NonNullable<Json>,"updated_at": string,"whole_only": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle": Database["public"]['Enums']["aisle"],"default_size"?: Database["public"]['Enums']["size_word"] | null,"density_g_per_ml"?: number | null,"diet"?: (string)[],"key": string,"names": NonNullable<Json>,"noun_plural"?: string | null,"noun_singular"?: string | null,"size_large_g"?: number | null,"size_medium_g"?: number | null,"size_small_g"?: number | null,"synonyms"?: NonNullable<Json>,"updated_at"?: string,"whole_only"?: boolean
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["aisle"],"default_size"?: Database["public"]['Enums']["size_word"] | null,"density_g_per_ml"?: number | null,"diet"?: (string)[],"key"?: string,"names"?: NonNullable<Json>,"noun_plural"?: string | null,"noun_singular"?: string | null,"size_large_g"?: number | null,"size_medium_g"?: number | null,"size_small_g"?: number | null,"synonyms"?: NonNullable<Json>,"updated_at"?: string,"whole_only"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"catalog_names": {
                  Row: {
                    "ingredient_key": string,"kind": string,"lang": string,"name_norm": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ingredient_key": string,"kind": string,"lang": string,"name_norm": string
                  }
                  Update: {
                    "ingredient_key"?: string,"kind"?: string,"lang"?: string,"name_norm"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_names_ingredient_key_fkey"
      columns: ["ingredient_key"]
isOneToOne: false
      referencedRelation: "catalog_ingredients"
      referencedColumns: ["key"]
    }
                  ]
                },"catalog_packs": {
                  Row: {
                    "ingredient_key": string,"label": string,"loose": boolean,"position": number,"profile": Database["public"]['Enums']["store_profile"],"size": number,"unit": Database["public"]['Enums']["unit"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ingredient_key": string,"label": string,"loose": boolean,"position": number,"profile": Database["public"]['Enums']["store_profile"],"size": number,"unit": Database["public"]['Enums']["unit"]
                  }
                  Update: {
                    "ingredient_key"?: string,"label"?: string,"loose"?: boolean,"position"?: number,"profile"?: Database["public"]['Enums']["store_profile"],"size"?: number,"unit"?: Database["public"]['Enums']["unit"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_packs_ingredient_key_fkey"
      columns: ["ingredient_key"]
isOneToOne: false
      referencedRelation: "catalog_ingredients"
      referencedColumns: ["key"]
    }
                  ]
                },"event_checklist_items": {
                  Row: {
                    "created_at": string,"created_by": string | null,"done": boolean,"done_by": string | null,"event_id": string,"family_id": string,"id": string,"label": string,"position": number,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"done_by"?: string | null,"event_id": string,"family_id": string,"id"?: string,"label": string,"position": number,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"done"?: boolean,"done_by"?: string | null,"event_id"?: string,"family_id"?: string,"id"?: string,"label"?: string,"position"?: number,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_checklist_items_done_by_family_id_fkey"
      columns: ["done_by","family_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_checklist_items_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_checklist_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_exceptions": {
                  Row: {
                    "cancelled": boolean,"created_at": string,"created_by": string | null,"event_id": string,"family_id": string,"id": string,"occurrence_date": string,"override": Json | null,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled"?: boolean,"created_at"?: string,"created_by"?: string | null,"event_id": string,"family_id": string,"id"?: string,"occurrence_date": string,"override"?: Json | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cancelled"?: boolean,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"family_id"?: string,"id"?: string,"occurrence_date"?: string,"override"?: Json | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_exceptions_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_exceptions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_members": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"family_id": string,"id": string,"member_id": string | null,"removed_name": string | null,"source": string,"updated_at": string,"updated_by": string | null,"who": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"family_id": string,"id"?: string,"member_id"?: string | null,"removed_name"?: string | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"who": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"family_id"?: string,"id"?: string,"member_id"?: string | null,"removed_name"?: string | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"who"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_members_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_members_member_id_family_id_fkey"
      columns: ["member_id","family_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"event_share_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"family_id": string,"id": string,"occurrence_date": string,"source": string,"stopped_at": string | null,"stopped_by": string | null,"stopped_source": string | null,"token": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"family_id": string,"id"?: string,"occurrence_date": string,"source"?: string,"stopped_at"?: string | null,"stopped_by"?: string | null,"stopped_source"?: string | null,"token": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"family_id"?: string,"id"?: string,"occurrence_date"?: string,"source"?: string,"stopped_at"?: string | null,"stopped_by"?: string | null,"stopped_source"?: string | null,"token"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_share_links_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_share_links_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"event_surprise": {
                  Row: {
                    "cover_note": string | null,"cover_title": string,"created_at": string,"created_by": string | null,"event_id": string,"family_id": string,"hidden_from": (string)[],"id": string,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_note"?: string | null,"cover_title": string,"created_at"?: string,"created_by"?: string | null,"event_id": string,"family_id": string,"hidden_from": (string)[],"id"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "cover_note"?: string | null,"cover_title"?: string,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"family_id"?: string,"hidden_from"?: (string)[],"id"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_surprise_event_id_family_id_fkey"
      columns: ["event_id","family_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "event_surprise_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "category": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"end_time": string | null,"ends_on": string,"family_id": string,"id": string,"location": string | null,"notes": string | null,"recurrence": Json | null,"reminder": string,"responsible_member_id": string | null,"slots": (string)[],"source": string,"start_time": string | null,"starts_on": string,"time_type": string,"title": string,"updated_at": string,"updated_by": string | null,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"end_time"?: string | null,"ends_on": string,"family_id": string,"id"?: string,"location"?: string | null,"notes"?: string | null,"recurrence"?: Json | null,"reminder"?: string,"responsible_member_id"?: string | null,"slots"?: (string)[],"source"?: string,"start_time"?: string | null,"starts_on": string,"time_type": string,"title": string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: string
                  }
                  Update: {
                    "category"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"end_time"?: string | null,"ends_on"?: string,"family_id"?: string,"id"?: string,"location"?: string | null,"notes"?: string | null,"recurrence"?: Json | null,"reminder"?: string,"responsible_member_id"?: string | null,"slots"?: (string)[],"source"?: string,"start_time"?: string | null,"starts_on"?: string,"time_type"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_responsible_member_id_family_id_fkey"
      columns: ["responsible_member_id","family_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"owner_id": string,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"owner_id": string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"family_calendar_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"family_id": string,"home_time_zone": string | null,"id": string,"slot_times": Json | null,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"home_time_zone"?: string | null,"id"?: string,"slot_times"?: Json | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"home_time_zone"?: string | null,"id"?: string,"slot_times"?: Json | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_calendar_settings_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_ingredients": {
                  Row: {
                    "aisle": Database["public"]['Enums']["aisle"] | null,"catalog_key": string | null,"created_at": string,"created_by": string | null,"custom_name": string | null,"family_id": string,"id": string,"name_norm": string | null,"packs": Json | null,"size_large_g": number | null,"size_medium_g": number | null,"size_small_g": number | null,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_name"?: string | null,"family_id": string,"id"?: string,"name_norm"?: string | null,"packs"?: Json | null,"size_large_g"?: number | null,"size_medium_g"?: number | null,"size_small_g"?: number | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_name"?: string | null,"family_id"?: string,"id"?: string,"name_norm"?: string | null,"packs"?: Json | null,"size_large_g"?: number | null,"size_medium_g"?: number | null,"size_small_g"?: number | null,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_ingredients_catalog_key_fkey"
      columns: ["catalog_key"]
isOneToOne: false
      referencedRelation: "catalog_ingredients"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "family_ingredients_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"family_settings": {
                  Row: {
                    "created_at": string,"created_by": string | null,"family_id": string,"has_scale": boolean,"has_thermometer": boolean,"id": string,"keep_awake": boolean,"round_to_packs": boolean,"source": string,"store_profile": Database["public"]['Enums']["store_profile"],"units": Database["public"]['Enums']["unit_system"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"has_scale"?: boolean,"has_thermometer"?: boolean,"id"?: string,"keep_awake"?: boolean,"round_to_packs"?: boolean,"source"?: string,"store_profile"?: Database["public"]['Enums']["store_profile"],"units"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"has_scale"?: boolean,"has_thermometer"?: boolean,"id"?: string,"keep_awake"?: boolean,"round_to_packs"?: boolean,"source"?: string,"store_profile"?: Database["public"]['Enums']["store_profile"],"units"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_settings_family_id_fkey"
      columns: ["family_id"]
isOneToOne: true
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"grocery_items": {
                  Row: {
                    "aisle": Database["public"]['Enums']["aisle"] | null,"catalog_key": string | null,"checked": boolean,"checked_at": string | null,"checked_by": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"family_id": string,"from_recipe": boolean,"id": string,"name": string,"quantity": number | null,"recipe_id": string | null,"source": string,"unit": Database["public"]['Enums']["unit"] | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"family_id": string,"from_recipe"?: boolean,"id"?: string,"name": string,"quantity"?: number | null,"recipe_id"?: string | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"family_id"?: string,"from_recipe"?: boolean,"id"?: string,"name"?: string,"quantity"?: number | null,"recipe_id"?: string | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "grocery_items_catalog_key_fkey"
      columns: ["catalog_key"]
isOneToOne: false
      referencedRelation: "catalog_ingredients"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "grocery_items_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grocery_items_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"grocery_recipes": {
                  Row: {
                    "created_at": string,"created_by": string | null,"family_id": string,"id": string,"recipe_id": string,"servings": number,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"recipe_id": string,"servings": number,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"recipe_id"?: string,"servings"?: number,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "grocery_recipes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grocery_recipes_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"family_id": string,"id": string,"member_id": string | null,"source": string,"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_at"?: string,"family_id": string,"id"?: string,"member_id"?: string | null,"source"?: string,"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"member_id"?: string | null,"source"?: string,"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "color": Database["public"]['Enums']["member_color"],"created_at": string,"created_by": string | null,"display_name": string,"family_id": string,"id": string,"joined_at": string,"managed_by": string | null,"role": Database["public"]['Enums']["member_role"],"source": string,"updated_at": string,"updated_by": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color": Database["public"]['Enums']["member_color"],"created_at"?: string,"created_by"?: string | null,"display_name": string,"family_id": string,"id"?: string,"joined_at"?: string,"managed_by"?: string | null,"role": Database["public"]['Enums']["member_role"],"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "color"?: Database["public"]['Enums']["member_color"],"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"family_id"?: string,"id"?: string,"joined_at"?: string,"managed_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_managed_by_fkey"
      columns: ["managed_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"oauth_client_sources": {
                  Row: {
                    "client_id": string,"created_at": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"created_at"?: string,"source": string
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"source"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "catalog_key": string | null,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"name": string,"piece_noun_plural": string | null,"piece_noun_singular": string | null,"position": number,"prep_note": string | null,"quantity": number | null,"recipe_id": string,"size_word": Database["public"]['Enums']["size_word"] | null,"source": string,"unit": Database["public"]['Enums']["unit"] | null,"updated_at": string,"updated_by": string | null,"weight_per_piece_g": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "catalog_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"name": string,"piece_noun_plural"?: string | null,"piece_noun_singular"?: string | null,"position": number,"prep_note"?: string | null,"quantity"?: number | null,"recipe_id": string,"size_word"?: Database["public"]['Enums']["size_word"] | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null,"weight_per_piece_g"?: number | null
                  }
                  Update: {
                    "catalog_key"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"piece_noun_plural"?: string | null,"piece_noun_singular"?: string | null,"position"?: number,"prep_note"?: string | null,"quantity"?: number | null,"recipe_id"?: string,"size_word"?: Database["public"]['Enums']["size_word"] | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null,"weight_per_piece_g"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_catalog_key_fkey"
      columns: ["catalog_key"]
isOneToOne: false
      referencedRelation: "catalog_ingredients"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "recipe_ingredients_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"recipe_steps": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"name": string | null,"photo_path": string | null,"position": number,"recipe_id": string,"source": string,"temp_check_c": number | null,"temp_check_text": string | null,"timer_label": string | null,"timer_seconds": number | null,"tip": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"name"?: string | null,"photo_path"?: string | null,"position": number,"recipe_id": string,"source"?: string,"temp_check_c"?: number | null,"temp_check_text"?: string | null,"timer_label"?: string | null,"timer_seconds"?: number | null,"tip"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"name"?: string | null,"photo_path"?: string | null,"position"?: number,"recipe_id"?: string,"source"?: string,"temp_check_c"?: number | null,"temp_check_text"?: string | null,"timer_label"?: string | null,"timer_seconds"?: number | null,"tip"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_steps_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_steps_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"recipe_variants": {
                  Row: {
                    "changes": NonNullable<Json>,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"kind": Database["public"]['Enums']["variant_kind"],"name": string,"position": number,"recipe_id": string,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"kind": Database["public"]['Enums']["variant_kind"],"name": string,"position": number,"recipe_id": string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["variant_kind"],"name"?: string,"position"?: number,"recipe_id"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_variants_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_variants_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "best_months": (number)[],"created_at": string,"created_by": string | null,"cuisine": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"family_id": string,"has_scale": boolean | null,"has_thermometer": boolean | null,"id": string,"keep_awake": boolean | null,"name": string,"photo_path": string | null,"prep_minutes": number | null,"serves": number,"source": string,"source_text": string | null,"total_minutes": number | null,"units": Database["public"]['Enums']["unit_system"] | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "best_months"?: (number)[],"created_at"?: string,"created_by"?: string | null,"cuisine"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"family_id": string,"has_scale"?: boolean | null,"has_thermometer"?: boolean | null,"id"?: string,"keep_awake"?: boolean | null,"name": string,"photo_path"?: string | null,"prep_minutes"?: number | null,"serves"?: number,"source"?: string,"source_text"?: string | null,"total_minutes"?: number | null,"units"?: Database["public"]['Enums']["unit_system"] | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "best_months"?: (number)[],"created_at"?: string,"created_by"?: string | null,"cuisine"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"family_id"?: string,"has_scale"?: boolean | null,"has_thermometer"?: boolean | null,"id"?: string,"keep_awake"?: boolean | null,"name"?: string,"photo_path"?: string | null,"prep_minutes"?: number | null,"serves"?: number,"source"?: string,"source_text"?: string | null,"total_minutes"?: number | null,"units"?: Database["public"]['Enums']["unit_system"] | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"share_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"family_id": string,"id": string,"include_tips": boolean,"include_variants": boolean,"recipe_id": string,"source": string,"stopped_at": string | null,"stopped_by": string | null,"stopped_source": string | null,"token": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"include_tips"?: boolean,"include_variants"?: boolean,"recipe_id": string,"source"?: string,"stopped_at"?: string | null,"stopped_by"?: string | null,"stopped_source"?: string | null,"token": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"include_tips"?: boolean,"include_variants"?: boolean,"recipe_id"?: string,"source"?: string,"stopped_at"?: string | null,"stopped_by"?: string | null,"stopped_source"?: string | null,"token"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_links_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "share_links_recipe_id_family_id_fkey"
      columns: ["recipe_id","family_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id","family_id"]
    }
                  ]
                }
          }
          Views: {
            "events_visible": {
                  Row: {
                    "category": string | null,"checklist": Json | null,"created_at": string | null,"created_by": string | null,"creator_member_id": string | null,"deleted_at": string | null,"deleted_by": string | null,"end_time": string | null,"ends_on": string | null,"exceptions": Json | null,"family_id": string | null,"id": string | null,"location": string | null,"members": Json | null,"notes": string | null,"recurrence": Json | null,"reminder": string | null,"removed_members": Json | null,"responsible_member_id": string | null,"slots": (string)[] | null,"source": string | null,"start_time": string | null,"starts_on": string | null,"surprise": Json | null,"time_type": string | null,"title": string | null,"updated_at": string | null,"updated_by": string | null,"view": string | null,"visibility": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"ingredient_facts": {
                  Row: {
                    "aisle": Database["public"]['Enums']["aisle"] | null,"catalog_key": string | null,"default_size": Database["public"]['Enums']["size_word"] | null,"density_g_per_ml": number | null,"diet": (string)[] | null,"family_ingredient_id": string | null,"name": string | null,"noun_plural": string | null,"noun_singular": string | null,"plural": string | null,"size_large_g": number | null,"size_medium_g": number | null,"size_small_g": number | null,"whole_only": boolean | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"ingredient_packs": {
                  Row: {
                    "catalog_key": string | null,"family_ingredient_id": string | null,"label": string | null,"loose": boolean | null,"position": number | null,"profile": Database["public"]['Enums']["store_profile"] | null,"size": number | null,"unit": Database["public"]['Enums']["unit"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_activity_key":
{ Args: { "id": string,"payload": Json }; Returns: string
                           },
"_activity_kind":
{ Args: { "p_key": string }; Returns: string
                           },
"_assistant_for_redirects":
{ Args: { "uris": string }; Returns: string
                           },
"_created_event":
{ Args: { "eid": string }; Returns: boolean
                           },
"_events_visible":
{ Args: Record<PropertyKey, never>; Returns: {
              "category": string,"checklist": Json,"created_at": string,"created_by": string,"creator_member_id": string,"deleted_at": string,"deleted_by": string,"end_time": string,"ends_on": string,"exceptions": Json,"family_id": string,"id": string,"location": string,"members": Json,"notes": string,"recurrence": Json,"reminder": string,"removed_members": Json,"responsible_member_id": string,"slots": (string)[],"source": string,"start_time": string,"starts_on": string,"surprise": Json,"time_type": string,"title": string,"updated_at": string,"updated_by": string,"view": string,"visibility": string
            }[]
                           },
"_family_table":
{ Args: { "live": boolean,"t": unknown }; Returns: undefined
                           },
"_family_today":
{ Args: { "fam": string }; Returns: string
                           },
"_ingredient_facts":
{ Args: { "fam": string }; Returns: {
              "aisle": Database["public"]['Enums']["aisle"],"catalog_key": string,"default_size": Database["public"]['Enums']["size_word"],"density_g_per_ml": number,"diet": (string)[],"family_ingredient_id": string,"name": string,"noun_plural": string,"noun_singular": string,"plural": string,"size_large_g": number,"size_medium_g": number,"size_small_g": number,"whole_only": boolean
            }[]
                           },
"_load_catalog":
{ Args: { "data": Json }; Returns: undefined
                           },
"_managed":
{ Args: { "fam": string,"member_id": string }; Returns: {
              "color": Database["public"]['Enums']["member_color"],
"created_at": string,
"created_by": string | null,
"display_name": string,
"family_id": string,
"id": string,
"joined_at": string,
"managed_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"source": string,
"updated_at": string,
"updated_by": string | null,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"_me_locked":
{ Args: Record<PropertyKey, never>; Returns: {
              "color": Database["public"]['Enums']["member_color"],
"created_at": string,
"created_by": string | null,
"display_name": string,
"family_id": string,
"id": string,
"joined_at": string,
"managed_by": string | null,
"role": Database["public"]['Enums']["member_role"],
"source": string,
"updated_at": string,
"updated_by": string | null,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"_my_member_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_next_color":
{ Args: { "fam": string }; Returns: Database["public"]['Enums']["member_color"]
                           },
"_open_invite":
{ Args: { "lock"?: boolean,"token": string }; Returns: {
              "created_at": string,
"created_by": string,
"expires_at": string,
"family_id": string,
"id": string,
"member_id": string | null,
"source": string,
"token_hash": string,
"used_at": string | null,
"used_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "invites"
        isOneToOne: true
        isSetofReturn: false
      } },
"_override_keys_ok":
{ Args: { "o": Json }; Returns: boolean
                           },
"_recipe_folder_deleted":
{ Args: { "path": string }; Returns: boolean
                           },
"_request_source":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_require_owner":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_require_user":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_row_fingerprint":
{ Args: { "r": Json }; Returns: string
                           },
"_sees_event":
{ Args: { "eid": string }; Returns: boolean
                           } |
{ Args: { "creator": string,"eid": string,"vis": string }; Returns: boolean
                           },
"_sees_logged_event":
{ Args: { "actor": string,"eid": string,"secret": boolean }; Returns: boolean
                           },
"_token_hash":
{ Args: { "token": string }; Returns: string
                           },
"_upcoming_events_of":
{ Args: { "fam": string,"member": string }; Returns: string[]
                           },
"_valid_packs":
{ Args: { "p": Json }; Returns: boolean
                           },
"_variant_changes_ok":
{ Args: { "changes": Json }; Returns: boolean
                           },
"accept_invite":
{ Args: { "display_name": string,"replace_own_family"?: boolean,"token": string }; Returns: Json
                           },
"access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"activity_entries":
{ Args: { "p_actor"?: string,"p_before"?: string,"p_limit"?: number,"p_source"?: string }; Returns: {
              "actor_id": string,"can_restore": boolean,"can_undo": boolean,"count": number,"created_at": string,"event_id": string,"event_name": string,"key": string,"kind": string,"names": (string)[],"recipe_id": string,"recipe_name": string,"source": string,"undo_action": string,"undone_at": string,"undone_by": string
            }[]
                           },
"activity_filters":
{ Args: Record<PropertyKey, never>; Returns: {
              "actor_id": string,"source": string
            }[]
                           },
"add_managed_member":
{ Args: { "name": string,"pick"?: Database["public"]['Enums']["member_color"] }; Returns: string
                           },
"ai_allowed":
{ Args: { "permission": string }; Returns: boolean
                           },
"assistant_for_redirect":
{ Args: { "uri": string }; Returns: string
                           },
"check_request":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"claim_home_time_zone":
{ Args: { "tz": string }; Returns: undefined
                           },
"create_family":
{ Args: { "display_name": string,"family_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "for_member"?: string }; Returns: string
                           },
"delete_family":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"invite_status":
{ Args: { "token": string }; Returns: Json
                           },
"make_owner":
{ Args: { "member_id": string }; Returns: undefined
                           },
"managed_member_upcoming_events":
{ Args: { "member_id": string }; Returns: number
                           },
"match_ingredients":
{ Args: { "queries": Json }; Returns: {
              "aisle": Database["public"]['Enums']["aisle"],"catalog_key": string,"default_size": Database["public"]['Enums']["size_word"],"density_g_per_ml": number,"diet": (string)[],"family_ingredient_id": string,"how": string,"idx": number,"name": string,"noun_plural": string,"noun_singular": string,"plural": string,"size_large_g": number,"size_medium_g": number,"size_small_g": number,"whole_only": boolean
            }[]
                           },
"my_assistants":
{ Args: Record<PropertyKey, never>; Returns: {
              "assistant": string,"client_id": string,"client_name": string,"granted_at": string,"last_used_at": string
            }[]
                           },
"my_family_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"password_attempt_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"purge_cleared_groceries":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_deleted_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_deleted_recipes":
{ Args: { "ids": (string)[] }; Returns: number
                           },
"recipes_due_for_purge":
{ Args: Record<PropertyKey, never>; Returns: {
              "family_id": string,"id": string
            }[]
                           },
"remove_managed_member":
{ Args: { "member_id": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "member_id": string }; Returns: undefined
                           },
"rename_managed_member":
{ Args: { "member_id": string,"name": string }; Returns: undefined
                           },
"request_source":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"save_event":
{ Args: { "p_checklist"?: Json,"p_event": Json,"p_id"?: string,"p_members": Json,"p_surprise"?: Json }; Returns: string
                           },
"save_recipe_ingredients":
{ Args: { "p_ingredients": Json,"p_recipe_id": string }; Returns: undefined
                           },
"save_recipe_steps":
{ Args: { "p_recipe_id": string,"p_steps": Json }; Returns: undefined
                           },
"save_recipe_variants":
{ Args: { "p_recipe_id": string,"p_variants": Json }; Returns: undefined
                           },
"set_display_name":
{ Args: { "display_name": string }; Returns: undefined
                           },
"set_member_color":
{ Args: { "member_id": string,"pick": Database["public"]['Enums']["member_color"] }; Returns: undefined
                           },
"share_event":
{ Args: { "p_date": string,"p_event_id": string }; Returns: {
              "created": boolean,"created_at": string,"token": string
            }[]
                           },
"share_recipe":
{ Args: { "p_recipe_id": string }; Returns: {
              "created": boolean,"created_at": string,"include_tips": boolean,"include_variants": boolean,"token": string
            }[]
                           },
"shared_event":
{ Args: { "p_token": string }; Returns: Json
                           },
"shared_recipe":
{ Args: { "p_token": string }; Returns: Json
                           },
"split_event":
{ Args: { "p_before": Json,"p_checklist"?: Json,"p_event": Json,"p_from": string,"p_id": string,"p_members": Json,"p_surprise"?: Json }; Returns: string
                           },
"suggest_ingredients":
{ Args: { "lim"?: number,"q": string }; Returns: {
              "aisle": Database["public"]['Enums']["aisle"] | null,
"catalog_key": string | null,
"default_size": Database["public"]['Enums']["size_word"] | null,
"density_g_per_ml": number | null,
"diet": (string)[] | null,
"family_ingredient_id": string | null,
"name": string | null,
"noun_plural": string | null,
"noun_singular": string | null,
"plural": string | null,
"size_large_g": number | null,
"size_medium_g": number | null,
"size_small_g": number | null,
"whole_only": boolean | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "ingredient_facts"
        isOneToOne: false
        isSetofReturn: true
      } },
"touch_assistant":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"undo_ai_change":
{ Args: { "p_key": string,"p_skip_changed"?: boolean }; Returns: Json
                           }
          }
          Enums: {
            "aisle": "produce"|"bakery"|"dairy_eggs"|"meat_fish"|"dry_goods"|"spices_baking"|"frozen"|"drinks"|"household"|"other","member_color": "honey"|"rose"|"sky"|"mint"|"lilac"|"peach"|"pistachio"|"clay","member_role": "owner"|"editor","size_word": "small"|"medium"|"large","store_profile": "us"|"eu","unit": "g"|"kg"|"ml"|"l"|"tsp"|"tbsp"|"cup"|"oz"|"lb"|"piece"|"pinch","unit_system": "metric"|"imperial","variant_kind": "option"|"version"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "aisle": ["produce", "bakery", "dairy_eggs", "meat_fish", "dry_goods", "spices_baking", "frozen", "drinks", "household", "other"],"member_color": ["honey", "rose", "sky", "mint", "lilac", "peach", "pistachio", "clay"],"member_role": ["owner", "editor"],"size_word": ["small", "medium", "large"],"store_profile": ["us", "eu"],"unit": ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "piece", "pinch"],"unit_system": ["metric", "imperial"],"variant_kind": ["option", "version"]
          }
        }
} as const
