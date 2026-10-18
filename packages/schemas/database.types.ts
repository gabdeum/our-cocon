
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
                    "action": string,"actor_id": string | null,"created_at": string,"family_id": string,"id": string,"payload": NonNullable<Json>,"source": string,"target_id": string | null,"target_kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"payload"?: NonNullable<Json>,"source"?: string,"target_id"?: string | null,"target_kind": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"source"?: string,"target_id"?: string | null,"target_kind"?: string
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
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"joined_count": number,"name": string,"owner_id": string,"source": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"joined_count"?: number,"name": string,"owner_id": string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"joined_count"?: number,"name"?: string,"owner_id"?: string,"source"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
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
                },"grocery_items": {
                  Row: {
                    "aisle": Database["public"]['Enums']["aisle"] | null,"catalog_key": string | null,"checked": boolean,"checked_at": string | null,"checked_by": string | null,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"name": string,"quantity": number | null,"recipe_id": string | null,"source": string,"unit": Database["public"]['Enums']["unit"] | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"name": string,"quantity"?: number | null,"recipe_id"?: string | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "aisle"?: Database["public"]['Enums']["aisle"] | null,"catalog_key"?: string | null,"checked"?: boolean,"checked_at"?: string | null,"checked_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"quantity"?: number | null,"recipe_id"?: string | null,"source"?: string,"unit"?: Database["public"]['Enums']["unit"] | null,"updated_at"?: string,"updated_by"?: string | null
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
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"family_id": string,"id": string,"source": string,"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"expires_at"?: string,"family_id": string,"id"?: string,"source"?: string,"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"source"?: string,"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "avatar_tone": Database["public"]['Enums']["avatar_tone"],"created_at": string,"created_by": string | null,"display_name": string,"family_id": string,"joined_at": string,"role": Database["public"]['Enums']["member_role"],"source": string,"updated_at": string,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_tone": Database["public"]['Enums']["avatar_tone"],"created_at"?: string,"created_by"?: string | null,"display_name": string,"family_id": string,"joined_at"?: string,"role": Database["public"]['Enums']["member_role"],"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "avatar_tone"?: Database["public"]['Enums']["avatar_tone"],"created_at"?: string,"created_by"?: string | null,"display_name"?: string,"family_id"?: string,"joined_at"?: string,"role"?: Database["public"]['Enums']["member_role"],"source"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
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
                    "best_months": (number)[],"created_at": string,"created_by": string | null,"cuisine": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"family_id": string,"id": string,"name": string,"photo_path": string | null,"prep_minutes": number | null,"serves": number,"source": string,"source_text": string | null,"total_minutes": number | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "best_months"?: (number)[],"created_at"?: string,"created_by"?: string | null,"cuisine"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"family_id": string,"id"?: string,"name": string,"photo_path"?: string | null,"prep_minutes"?: number | null,"serves"?: number,"source"?: string,"source_text"?: string | null,"total_minutes"?: number | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "best_months"?: (number)[],"created_at"?: string,"created_by"?: string | null,"cuisine"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"family_id"?: string,"id"?: string,"name"?: string,"photo_path"?: string | null,"prep_minutes"?: number | null,"serves"?: number,"source"?: string,"source_text"?: string | null,"total_minutes"?: number | null,"updated_at"?: string,"updated_by"?: string | null
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
                }
          }
          Views: {
            "ingredient_facts": {
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
            "_family_table":
{ Args: { "live": boolean,"t": unknown }; Returns: undefined
                           },
"_load_catalog":
{ Args: { "data": Json }; Returns: undefined
                           },
"_open_invite":
{ Args: { "lock"?: boolean,"token": string }; Returns: {
              "created_at": string,
"created_by": string,
"expires_at": string,
"family_id": string,
"id": string,
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
"_request_source":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_require_owner":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_require_user":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_token_hash":
{ Args: { "token": string }; Returns: string
                           },
"_tone_for":
{ Args: { "joined": number }; Returns: Database["public"]['Enums']["avatar_tone"]
                           },
"_valid_packs":
{ Args: { "p": Json }; Returns: boolean
                           },
"accept_invite":
{ Args: { "display_name": string,"replace_own_family"?: boolean,"token": string }; Returns: number
                           },
"create_family":
{ Args: { "display_name": string,"family_name": string }; Returns: string
                           },
"create_invite":
{ Args: Record<PropertyKey, never>; Returns: string
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
"match_ingredients":
{ Args: { "queries": Json }; Returns: {
              "aisle": Database["public"]['Enums']["aisle"],"catalog_key": string,"default_size": Database["public"]['Enums']["size_word"],"density_g_per_ml": number,"diet": (string)[],"family_ingredient_id": string,"how": string,"idx": number,"name": string,"noun_plural": string,"noun_singular": string,"plural": string,"size_large_g": number,"size_medium_g": number,"size_small_g": number,"whole_only": boolean
            }[]
                           },
"my_family_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"remove_member":
{ Args: { "member_id": string }; Returns: undefined
                           },
"set_display_name":
{ Args: { "display_name": string }; Returns: undefined
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
      } }
          }
          Enums: {
            "aisle": "produce"|"bakery"|"dairy_eggs"|"meat_fish"|"dry_goods"|"spices_baking"|"frozen"|"drinks"|"household"|"other","avatar_tone": "honey"|"sage"|"peach","member_role": "owner"|"editor","size_word": "small"|"medium"|"large","store_profile": "us"|"eu","unit": "g"|"kg"|"ml"|"l"|"tsp"|"tbsp"|"cup"|"oz"|"lb"|"piece"|"pinch","variant_kind": "option"|"version"
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
            "aisle": ["produce", "bakery", "dairy_eggs", "meat_fish", "dry_goods", "spices_baking", "frozen", "drinks", "household", "other"],"avatar_tone": ["honey", "sage", "peach"],"member_role": ["owner", "editor"],"size_word": ["small", "medium", "large"],"store_profile": ["us", "eu"],"unit": ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "piece", "pinch"],"variant_kind": ["option", "version"]
          }
        }
} as const
