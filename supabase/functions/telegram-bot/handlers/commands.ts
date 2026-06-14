import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getSession, setState, upsertSession } from "../utils/session.ts";
import { deleteAllUserAnnunci, getUserAnnunci } from "../utils/db.ts";
import { mainMenu, myAnnunciMessage } from "./keyboards.ts";

export async function handleStart(msg: TelegramMessage) {
  const userId = msg.from.id;
  const username = msg.from.username;

  await upsertSession(userId, { telegram_username: username });
  const session = await getSession(userId);

  if (session?.nickname_weward) {
    await sendMessage(
      msg.chat.id,
      `Bentornato, <b>${session.nickname_weward}</b>! 👋\nCosa vuoi fare?`,
      mainMenu(),
    );
  } else {
    await setState(userId, "waiting_nickname");
    await sendMessage(
      msg.chat.id,
      `Ciao! 👋 Benvenuto nel bot per lo scambio di <b>WeCards</b>.\n\nPer iniziare, inviami il tuo <b>nickname WeWard</b> (quello visibile nel profilo):`,
    );
  }
}

export async function handleHelp(msg: TelegramMessage) {
  await sendMessage(
    msg.chat.id,
    `<b>Come funziona il bot?</b>\n\n` +
      `1️⃣ Imposta il tuo nickname WeWard\n` +
      `2️⃣ Pubblica un annuncio: <i>ho doppione</i> o <i>cerco</i> una carta\n` +
      `3️⃣ Il bot cerca automaticamente i match\n` +
      `4️⃣ Se trovato, ti condivido l'username Telegram dell'altro utente\n` +
      `5️⃣ Vi mettete d'accordo direttamente su Telegram!\n\n` +
      `Gli annunci scadono dopo <b>7 giorni</b> di inattività.\n\n` +
      `<b>Comandi:</b>\n` +
      `/start – Torna al menu principale\n` +
      `/miei – I tuoi annunci attivi\n` +
      `/cancella – Elimina tutti i tuoi annunci\n` +
      `/help – Mostra questo messaggio`,
  );
}

export async function handleMieiAnnunci(msg: TelegramMessage) {
  const annunci = await getUserAnnunci(msg.from.id);
  const { text, keyboard } = myAnnunciMessage(annunci);
  await sendMessage(msg.chat.id, text, keyboard);
}

export async function handleCancellaTutti(msg: TelegramMessage) {
  await deleteAllUserAnnunci(msg.from.id);
  await setState(msg.from.id, "idle");
  await sendMessage(
    msg.chat.id,
    `✅ Tutti i tuoi annunci sono stati eliminati.`,
    mainMenu(),
  );
}
