import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { UserSession } from "../types.ts";

function client() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function getSession(telegramUserId: number): Promise<UserSession | null> {
  const { data } = await client()
    .from("user_sessions")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .single();
  return data ?? null;
}

export async function upsertSession(
  telegramUserId: number,
  patch: Partial<Omit<UserSession, "telegram_user_id">>,
) {
  const { error } = await client()
    .from("user_sessions")
    .upsert(
      { telegram_user_id: telegramUserId, updated_at: new Date().toISOString(), ...patch },
      { onConflict: "telegram_user_id" },
    );
  if (error) throw error;
}
