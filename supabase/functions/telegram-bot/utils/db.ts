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

// ── Offers (OFFRO) ────────────────────────────────────────────────────────────

export async function upsertOfferta(params: {
  telegram_user_id: number;
  telegram_username?: string;
  nickname_weward: string;
  collezione_id: number;
  numero_carta: number;
  testo_libero: string;
}): Promise<void> {
  const db = client();
  // Replace existing offer from same user for same card
  await db
    .from("annunci")
    .delete()
    .eq("telegram_user_id", params.telegram_user_id)
    .eq("collezione_id", params.collezione_id)
    .eq("numero_carta", params.numero_carta);

  const { error } = await db.from("annunci").insert({ ...params, tipo: "ho" });
  if (error) throw error;
}

// ── Search (CERCO) ────────────────────────────────────────────────────────────

export interface OffertaRow extends Annuncio {
  collezioni: Collezione;
}

export async function getOfferte(
  collezione_id: number,
  numero_carta: number,
): Promise<OffertaRow[]> {
  const { data, error } = await client()
    .from("annunci")
    .select("*, collezioni(nome)")
    .eq("collezione_id", collezione_id)
    .eq("numero_carta", numero_carta)
    .eq("tipo", "ho")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OffertaRow[];
}

// ── List (LISTA) ──────────────────────────────────────────────────────────────

export async function countOffertePerCollezione(): Promise<Map<number, number>> {
  const { data, error } = await client()
    .from("annunci")
    .select("collezione_id")
    .eq("tipo", "ho")
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;

  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    counts.set(row.collezione_id, (counts.get(row.collezione_id) ?? 0) + 1);
  }
  return counts;
}

// ── Housekeeping ──────────────────────────────────────────────────────────────

export async function purgeExpired(): Promise<void> {
  await client()
    .from("annunci")
    .delete()
    .lt("expires_at", new Date().toISOString());
}
