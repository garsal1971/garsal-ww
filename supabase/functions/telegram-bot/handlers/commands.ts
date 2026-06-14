import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";

export const HELP =
  `<b>Comandi disponibili:</b>\n\n` +
  `<code>OFFRO collezione;carta;cosa cerco</code>\n` +
  `  Pubblica un annuncio di scambio\n` +
  `  Es: <code>OFFRO Roma;3;cerco la 5 di Parigi</code>\n\n` +
  `<code>CERCO collezione;carta</code>\n` +
  `  Vedi chi offre quella carta\n` +
  `  Es: <code>CERCO Roma;3</code>\n\n` +
  `<code>LISTA</code>\n` +
  `  Mostra le collezioni con numero di offerte attive`;

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
