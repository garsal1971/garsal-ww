import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Annuncio, Collezione } from "../types.ts";

function client() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollezioni(): Promise<Collezione[]> {
  const { data, error } = await client()
    .from("collezioni")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function createAnnuncio(params: {
  telegram_user_id: number;
  telegram_username?: string;
  nickname_weward: string;
  collezione_id: number;
  numero_carta: number;
  tipo: "ho" | "cerco";
  quantita?: number;
}): Promise<Annuncio> {
  const { data, error } = await client()
    .from("annunci")
    .insert(params)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserAnnunci(telegram_user_id: number): Promise<Annuncio[]> {
  const { data, error } = await client()
    .from("annunci")
    .select("*, collezioni(nome)")
    .eq("telegram_user_id", telegram_user_id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteAnnuncio(id: number, telegram_user_id: number) {
  const { error } = await client()
    .from("annunci")
    .delete()
    .eq("id", id)
    .eq("telegram_user_id", telegram_user_id);
  if (error) throw error;
}

export async function deleteAllUserAnnunci(telegram_user_id: number) {
  const { error } = await client()
    .from("annunci")
    .delete()
    .eq("telegram_user_id", telegram_user_id);
  if (error) throw error;
}

export async function purgeExpired() {
  const { error } = await client()
    .from("annunci")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface CartaAnnunci {
  ho: (Annuncio & { collezioni: Collezione })[];
  cerco: (Annuncio & { collezioni: Collezione })[];
}

/** All active announcements for a specific card (for /cerca). */
export async function findCartaAnnunci(
  collezione_id: number,
  numero_carta: number,
  excludeUserId: number,
): Promise<CartaAnnunci> {
  const { data, error } = await client()
    .from("annunci")
    .select("*, collezioni(nome)")
    .eq("collezione_id", collezione_id)
    .eq("numero_carta", numero_carta)
    .neq("telegram_user_id", excludeUserId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  const all = (data ?? []) as (Annuncio & { collezioni: Collezione })[];
  return {
    ho: all.filter((a) => a.tipo === "ho"),
    cerco: all.filter((a) => a.tipo === "cerco"),
  };
}

// ── Match logic ───────────────────────────────────────────────────────────────

export interface MatchResult {
  annuncio: Annuncio & { collezioni: Collezione };
  mutual: boolean;
}

/**
 * Find matches for a newly posted announcement.
 *
 * If tipo=cerco (I'm looking for carta X):
 *   → find other users who ho carta X + optionally cerco what I have
 *
 * If tipo=ho (I have carta X):
 *   → find other users who cerco carta X + optionally ho what they need
 */
export async function findMatches(
  newAnnuncio: Annuncio,
): Promise<MatchResult[]> {
  const db = client();
  const oppositeType = newAnnuncio.tipo === "ho" ? "cerco" : "ho";

  // Direct matches: someone with the opposite announcement for same carta/collezione
  const { data: direct, error } = await db
    .from("annunci")
    .select("*, collezioni(nome)")
    .eq("collezione_id", newAnnuncio.collezione_id)
    .eq("numero_carta", newAnnuncio.numero_carta)
    .eq("tipo", oppositeType)
    .neq("telegram_user_id", newAnnuncio.telegram_user_id)
    .gt("expires_at", new Date().toISOString());

  if (error) throw error;
  if (!direct || direct.length === 0) return [];

  // Check mutuality: does this match also want / have what we have / want?
  const results: MatchResult[] = [];

  for (const match of direct) {
    // Look for an announcement from the matched user that is the opposite of ours
    // (i.e., if we posted "cerco", check if they also posted "cerco" something we "ho")
    const { data: theirOther } = await db
      .from("annunci")
      .select("id")
      .eq("telegram_user_id", match.telegram_user_id)
      .eq("tipo", newAnnuncio.tipo)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    // mutual = they also have an announcement that mirrors ours
    // Simple heuristic: if their main match tipo is opposite AND they have any
    // announcement of our same tipo → likely mutual interest.
    const mutual = !!(theirOther && theirOther.length > 0);
    results.push({ annuncio: match as Annuncio & { collezioni: Collezione }, mutual });
  }

  return results;
}

/**
 * Returns existing announcements that should be notified about a new announcement.
 * When User B posts "ho carta X", notify all users who already have "cerco carta X".
 * When User B posts "cerco carta X", notify all users who already have "ho carta X".
 */
export async function findUsersToNotify(
  newAnnuncio: Annuncio,
): Promise<(Annuncio & { collezioni: Collezione })[]> {
  const oppositeType = newAnnuncio.tipo === "ho" ? "cerco" : "ho";

  const { data, error } = await client()
    .from("annunci")
    .select("*, collezioni(nome)")
    .eq("collezione_id", newAnnuncio.collezione_id)
    .eq("numero_carta", newAnnuncio.numero_carta)
    .eq("tipo", oppositeType)
    .neq("telegram_user_id", newAnnuncio.telegram_user_id)
    .gt("expires_at", new Date().toISOString());

  if (error) throw error;
  return (data ?? []) as (Annuncio & { collezioni: Collezione })[];
}
