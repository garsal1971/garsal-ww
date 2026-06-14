import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { countActiveUsers } from "../utils/db.ts";

const MAX_USERS = parseInt(Deno.env.get("MAX_USERS") ?? "0"); // 0 = illimitato

const DISCLAIMER_TEXT =
  `⚠️ <b>Prima di iniziare, leggi e accetta le condizioni d'uso:</b>\n\n` +
  `• Questo bot è un servizio non ufficiale per facilitare lo scambio di WeCards tra utenti\n` +
  `• Non siamo affiliati con WeWard S.r.l.\n` +
  `• Gli scambi avvengono direttamente tra utenti: il bot non è responsabile di eventuali problemi\n` +
  `• Il tuo username Telegram e nickname WeWard saranno visibili agli altri utenti del bot\n` +
  `• Gli annunci scadono automaticamente dopo 7 giorni\n` +
  `• Puoi richiedere la cancellazione dei tuoi dati in qualsiasi momento\n\n` +
  `Scrivi <b>ACCETTO</b> per confermare e continuare.`;

export async function showDisclaimer(chatId: number) {
  await sendMessage(chatId, DISCLAIMER_TEXT);
}

export async function handleAccetto(msg: TelegramMessage) {
  // Check max users limit
  if (MAX_USERS > 0) {
    const active = await countActiveUsers();
    if (active >= MAX_USERS) {
      await sendMessage(
        msg.chat.id,
        `😔 Il bot ha raggiunto il numero massimo di iscritti (<b>${MAX_USERS}</b>).\n` +
          `Non è possibile iscriversi al momento. Riprova più avanti.`,
      );
      return false;
    }
  }

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    status: "active",
    state: "waiting_nickname",
    accepted_at: new Date().toISOString(),
  });

  await sendMessage(
    msg.chat.id,
    `✅ Iscrizione confermata!\n\nPer iniziare, inviami il tuo <b>nickname WeWard</b>:`,
  );
  return true;
}
