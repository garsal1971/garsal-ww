import type { TelegramMessage, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getCollezioni, getOfferte, getOfferteCollezione } from "../utils/db.ts";
import { searchCollezione } from "../utils/collections.ts";
import { t } from "../utils/i18n.ts";

export async function handleCerco(msg: TelegramMessage, args: string, lang: Lang) {
  if (!args) {
    await sendMessage(msg.chat.id, t(lang).cercoUsage);
    return;
  }

  const parts = args.split(";").map((s) => s.trim());
  const [collInput, cartaInput] = parts;

  const collezioni = await getCollezioni();
  const result = searchCollezione(collInput, collezioni);

  if (result.status === "not_found") {
    await sendMessage(msg.chat.id, t(lang).collectionNotFound(collInput));
    return;
  }

  if (result.status === "ambiguous") {
    const list = result.matches.map((c) => `• ${c.nome}`).join("\n");
    await sendMessage(msg.chat.id, t(lang).collectionAmbiguous(collInput, list));
    return;
  }

  const { collezione } = result;

  // ── CERCO collezione;carta ─────────────────────────────────────────────────
  if (cartaInput) {
    const carta = parseInt(cartaInput);
    if (isNaN(carta) || carta < 1 || carta > 9) {
      await sendMessage(msg.chat.id, t(lang).cercoInvalidFormat);
      return;
    }

    const offerte = await getOfferte(collezione.id, carta);
    if (offerte.length === 0) {
      await sendMessage(msg.chat.id, t(lang).cercoNoOffers(collezione.nome, carta));
      return;
    }

    const lines = offerte.map((o) => formatOfferta(o, carta, collezione.nome, lang));
    await sendMessage(
      msg.chat.id,
      `🃏 <b>${collezione.nome} – Carta ${carta}</b>\n\n` + lines.join("\n\n"),
    );
    return;
  }

  // ── CERCO/BUSCO collezione (tutte le carte) ────────────────────────────────
  const offerte = await getOfferteCollezione(collezione.id);
  if (offerte.length === 0) {
    await sendMessage(msg.chat.id, t(lang).cercoHeader(collezione.nome));
    return;
  }

  const grouped = new Map<number, typeof offerte>();
  for (const o of offerte) {
    if (!grouped.has(o.numero_carta)) grouped.set(o.numero_carta, []);
    grouped.get(o.numero_carta)!.push(o);
  }

  const sections: string[] = [];
  for (const [carta, list] of [...grouped.entries()].sort((a, b) => a[0] - b[0])) {
    sections.push(
      `🃏 <b>Carta ${carta}:</b>\n` +
        list.map((o) => formatOfferta(o, carta, collezione.nome, lang)).join("\n"),
    );
  }

  await sendMessage(
    msg.chat.id,
    `📚 <b>${collezione.nome}</b>\n\n` + sections.join("\n\n"),
  );
}

function formatOfferta(
  o: { telegram_username?: string; nickname_weward: string; testo_libero: string },
  carta: number,
  collezione: string,
  lang: Lang,
) {
  if (o.telegram_username) {
    const contactText = lang === "es"
      ? `Hola, busco la carta ${carta} de ${collezione}`
      : `Ciao, cerco la carta ${carta} di ${collezione}`;
    const pretext = encodeURIComponent(contactText);
    const link = `https://t.me/${o.telegram_username}?text=${pretext}`;
    return (
      `👤 <a href="${link}">@${o.telegram_username}</a> (${o.nickname_weward})\n` +
      `   💬 <i>${o.testo_libero}</i>`
    );
  }
  return `👤 <i>${o.nickname_weward}</i>\n   💬 <i>${o.testo_libero}</i>`;
}
