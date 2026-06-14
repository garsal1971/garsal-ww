import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getCollezioni, getOfferte, getOfferteCollezione } from "../utils/db.ts";
import { searchCollezione } from "../utils/collections.ts";

export async function handleCerco(msg: TelegramMessage, args: string) {
  if (!args) {
    await sendMessage(
      msg.chat.id,
      "Formato:\n" +
        "<code>CERCO collezione</code> – tutte le offerte della collezione\n" +
        "<code>CERCO collezione;carta</code> – offerte per carta specifica\n\n" +
        "Es: <code>CERCO Roma</code> oppure <code>CERCO Roma;3</code>",
    );
    return;
  }

  const parts = args.split(";").map((s) => s.trim());
  const [collInput, cartaInput] = parts;

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

  // ── CERCO collezione;carta ─────────────────────────────────────────────────
  if (cartaInput) {
    const carta = parseInt(cartaInput);
    if (isNaN(carta) || carta < 1 || carta > 9) {
      await sendMessage(msg.chat.id, "❌ Il numero carta deve essere tra 1 e 9.");
      return;
    }

    const offerte = await getOfferte(collezione.id, carta);
    if (offerte.length === 0) {
      await sendMessage(
        msg.chat.id,
        `🃏 <b>${collezione.nome} – Carta ${carta}</b>\n\nNessuno offre questa carta al momento.`,
      );
      return;
    }

    const lines = offerte.map(formatOfferta);
    await sendMessage(
      msg.chat.id,
      `🃏 <b>${collezione.nome} – Carta ${carta}</b>\n` +
        `${offerte.length} offerta/e:\n\n` +
        lines.join("\n\n"),
    );
    return;
  }

  // ── CERCO collezione (tutte le carte) ─────────────────────────────────────
  const offerte = await getOfferteCollezione(collezione.id);
  if (offerte.length === 0) {
    await sendMessage(
      msg.chat.id,
      `📚 <b>${collezione.nome}</b>\n\nNessuna offerta attiva per questa collezione.`,
    );
    return;
  }

  // Group by card number
  const grouped = new Map<number, typeof offerte>();
  for (const o of offerte) {
    if (!grouped.has(o.numero_carta)) grouped.set(o.numero_carta, []);
    grouped.get(o.numero_carta)!.push(o);
  }

  const sections: string[] = [];
  for (const [carta, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    sections.push(
      `🃏 <b>Carta ${carta}</b> (${list.length}):\n` + list.map(formatOfferta).join("\n"),
    );
  }

  await sendMessage(
    msg.chat.id,
    `📚 <b>${collezione.nome}</b> – ${offerte.length} offerta/e totali\n\n` +
      sections.join("\n\n"),
  );
}

function formatOfferta(o: { telegram_username?: string; nickname_weward: string; testo_libero: string }) {
  const user = o.telegram_username
    ? `@${o.telegram_username}`
    : `<i>${o.nickname_weward}</i>`;
  return `👤 ${user} (${o.nickname_weward})\n   💬 <i>${o.testo_libero}</i>`;
}
