import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
  );
}

/**
 * Supabase client singleton.
 *
 * Public schema:  supabase.from("table_name")
 * nodo_inmo:      supabase.schema("nodo_inmo").from("table_name")
 * shared:         supabase.schema("shared").from("table_name")
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
