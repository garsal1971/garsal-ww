import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { countActiveUsers } from "../utils/db.ts";

const MAX_USERS = parseInt(Deno.env.get("MAX_USERS") ?? "0"); // 0 = illimitato

const DISCLAIMER_TEXT =
  `📋 <b>Disclaimer</b>\n\n` +
  `Questo bot è un servizio indipendente creato da utenti WeWard per facilitare lo scambio di WeCards tra collezionisti. Non è affiliato, sponsorizzato o approvato da WeWard o da WeWard SAS.\n\n` +
  `I nomi delle collezioni e delle carte sono proprietà di WeWard SAS. Questo bot non raccoglie né conserva dati personali oltre allo username Telegram e al nickname WeWard, utilizzati esclusivamente per facilitare i contatti tra utenti. Gli annunci vengono eliminati automaticamente dopo 7 giorni.\n\n` +
  `Puoi cancellare il tuo nickname e tutti i tuoi annunci in qualsiasi momento usando il comando <code>CANCELLAMI</code>.\n\n` +
  `Gli scambi avvengono direttamente tra utenti: il bot non è responsabile dell'esito delle trattative.\n\n` +
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
