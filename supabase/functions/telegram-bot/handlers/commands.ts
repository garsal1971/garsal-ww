import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { getUserStats } from "../utils/db.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_ID = parseInt(Deno.env.get("ADMIN_TELEGRAM_ID") ?? "0");
const MAX_USERS = parseInt(Deno.env.get("MAX_USERS") ?? "50");

export const HELP =
  `<b>Comandi disponibili:</b>\n\n` +
  `<code>OFFRO collezione;carta;cosa cerco</code>\n` +
  `  Pubblica un annuncio di scambio\n` +
  `  Es: <code>OFFRO Roma;3;cerco la 5 di Parigi</code>\n\n` +
  `<code>CERCO collezione</code> o <code>CERCO collezione;carta</code>\n` +
  `  Vedi chi offre quella carta\n\n` +
  `<code>LISTA</code>\n` +
  `  Mostra le collezioni con numero di offerte attive\n\n` +
  `<code>MOSTRA OFFERTE</code>\n` +
  `  Elenca le tue offerte attive con numero progressivo\n\n` +
  `<code>CANCELLA 1</code>\n` +
  `  Cancella l'offerta numero 1 (dopo MOSTRA OFFERTE)\n\n` +
  `<code>CANCELLA TUTTE</code>\n` +
  `  Cancella tutte le tue offerte\n\n` +
  `<code>CANCELLAMI</code>\n` +
  `  Elimina tutti i tuoi dati e annunci dal bot`;

export async function handleStart(msg: TelegramMessage, hasNickname: boolean) {
  if (hasNickname) {
    await sendMessage(msg.chat.id, HELP);
  } else {
    await sendMessage(
      msg.chat.id,
      `Ciao! 👋 Benvenuto nel bot per lo scambio di <b>WeCards</b>.\n\n` +
        `Per iniziare, inviami il tuo <b>nickname WeWard</b>:`,
    );
  }
}

export async function handleCancellami(msg: TelegramMessage) {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userId = msg.from.id;

  await Promise.all([
    db.from("annunci").delete().eq("telegram_user_id", userId),
    db.from("user_sessions").delete().eq("telegram_user_id", userId),
  ]);

  await sendMessage(
    msg.chat.id,
    `✅ I tuoi dati sono stati eliminati.\n\nNickname, annunci e iscrizione sono stati cancellati.\nPuoi riscriverti in qualsiasi momento con /start.`,
  );
}

export async function handleIscritti(msg: TelegramMessage) {
  if (ADMIN_ID === 0 || msg.from.id !== ADMIN_ID) return;
  const stats = await getUserStats();
  const maxLabel = MAX_USERS > 0 ? `/${MAX_USERS}` : "";
  await sendMessage(
    msg.chat.id,
    `📊 <b>Statistiche iscritti:</b>\n\n` +
      `✅ Attivi: <b>${stats.active}${maxLabel}</b>\n` +
      `⏳ In attesa: <b>${stats.pending}</b>\n` +
      `👥 Totale: <b>${stats.active + stats.pending}</b>`,
  );
}

export async function handleNicknameInput(msg: TelegramMessage) {
  const nickname = msg.text?.trim();
  if (!nickname || nickname.length < 2) {
    await sendMessage(msg.chat.id, "Nickname non valido (min. 2 caratteri). Riprova:");
    return false;
  }

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    nickname_weward: nickname,
    state: "idle",
  });

  await sendMessage(
    msg.chat.id,
    `✅ Nickname impostato: <b>${nickname}</b>\n\n${HELP}`,
  );
  return true;
}
