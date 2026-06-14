import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getCollezioni, getOfferte } from "../utils/db.ts";
import { searchCollezione } from "../utils/collections.ts";

export async function handleCerco(msg: TelegramMessage, args: string) {
  if (!args) {
    await sendMessage(
      msg.chat.id,
      "Formato: <code>CERCO collezione;carta</code>\nEs: <code>CERCO Roma;3</code>",
    );
    return;
  }

  const parts = args.split(";").map((s) => s.trim());
  if (parts.length < 2) {
    await sendMessage(
      msg.chat.id,
      "❌ Formato non valido.\nUsa: <code>CERCO collezione;carta</code>",
    );
    return;
  }

  const [collInput, cartaInput] = parts;
  const carta = parseInt(cartaInput);
  if (isNaN(carta) || carta < 1 || carta > 9) {
    await sendMessage(msg.chat.id, "❌ Il numero carta deve essere tra 1 e 9.");
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
  const offerte = await getOfferte(collezione.id, carta);

  if (offerte.length === 0) {
    await sendMessage(
      msg.chat.id,
      `🃏 <b>${collezione.nome} – Carta ${carta}</b>\n\nNessuno offre questa carta al momento.`,
    );
    return;
  }

  const lines = offerte.map((o) => {
    const user = o.telegram_username
      ? `@${o.telegram_username}`
      : `<i>${o.nickname_weward}</i>`;
    return `👤 ${user} (${o.nickname_weward})\n   💬 <i>${o.testo_libero}</i>`;
  });

  await sendMessage(
    msg.chat.id,
    `🃏 <b>${collezione.nome} – Carta ${carta}</b>\n` +
      `${offerte.length} offerta/e attive:\n\n` +
      lines.join("\n\n"),
  );
}
