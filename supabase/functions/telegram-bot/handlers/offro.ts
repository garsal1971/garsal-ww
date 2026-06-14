import type { TelegramMessage, UserSession } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getCollezioni, upsertOfferta } from "../utils/db.ts";
import { searchCollezione } from "../utils/collections.ts";

export async function handleOffro(
  msg: TelegramMessage,
  args: string,
  session: UserSession,
) {
  if (!args) {
    await sendMessage(
      msg.chat.id,
      "Formato: <code>OFFRO collezione;carta;cosa cerco in cambio</code>\n" +
        "Es: <code>OFFRO Roma;3;cerco la carta 5 di Parigi</code>",
    );
    return;
  }

  const parts = args.split(";").map((s) => s.trim());
  if (parts.length < 3) {
    await sendMessage(
      msg.chat.id,
      "❌ Formato non valido.\nUsa: <code>OFFRO collezione;carta;cosa cerco in cambio</code>",
    );
    return;
  }

  const [collInput, cartaInput, ...testoArr] = parts;
  const carta = parseInt(cartaInput);
  if (isNaN(carta) || carta < 1 || carta > 9) {
    await sendMessage(msg.chat.id, "❌ Il numero carta deve essere tra 1 e 9.");
    return;
  }

  const testo = testoArr.join(";").trim();
  if (!testo) {
    await sendMessage(msg.chat.id, "❌ Specifica cosa cerchi in cambio.");
    return;
  }

  const collezioni = await getCollezioni();
  const result = searchCollezione(collInput, collezioni);

  if (result.status === "not_found") {
    await sendMessage(
      msg.chat.id,
      `❌ Collezione "<b>${collInput}</b>" non trovata.\n` +
        `Scrivi <code>LISTA</code> per vedere le collezioni disponibili.`,
    );
    return;
  }

  if (result.status === "ambiguous") {
    const nomi = result.matches.map((c) => `• ${c.nome}`).join("\n");
    await sendMessage(
      msg.chat.id,
      `⚠️ Più collezioni trovate per "<b>${collInput}</b>":\n${nomi}\n\nSii più specifico.`,
    );
    return;
  }

  const { collezione } = result;
  await upsertOfferta({
    telegram_user_id: msg.from.id,
    telegram_username: msg.from.username,
    nickname_weward: session.nickname_weward!,
    collezione_id: collezione.id,
    numero_carta: carta,
    testo_libero: testo,
  });

  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expStr = expires.toLocaleDateString("it-IT");

  await sendMessage(
    msg.chat.id,
    `✅ <b>Annuncio pubblicato!</b>\n\n` +
      `📚 ${collezione.nome} – Carta ${carta}\n` +
      `💬 In cambio cerco: <i>${testo}</i>\n` +
      `📅 Scade il: ${expStr}`,
  );
}
