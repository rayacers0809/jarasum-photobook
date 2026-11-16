import { createClient } from "@supabase/supabase-js";

// Publishable values — safe in the browser. Data access is enforced by RLS
// (public read for published books, writes only for staff via public.is_staff()).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nwgxznnfilbsnipwumsu.supabase.co";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_nyqxLhicXEnDwhS_SeEKWQ_EimSD4uH";

export const BUCKET = "photobook";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "jarasum-photobook-auth" },
});
