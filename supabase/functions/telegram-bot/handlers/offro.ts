import type { TelegramMessage, UserSession, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { getCollezioni, upsertOfferta } from "../utils/db.ts";
import { searchCollezione } from "../utils/collections.ts";
import { t } from "../utils/i18n.ts";

export async function handleOffro(
  msg: TelegramMessage,
  args: string,
  session: UserSession,
  lang: Lang,
) {
  if (!args) {
    await sendMessage(msg.chat.id, t(lang).offerUsage);
    return;
  }

  const parts = args.split(";").map((s) => s.trim());
  if (parts.length < 3) {
    await sendMessage(msg.chat.id, t(lang).offerInvalidFormat);
    return;
  }

  const [collInput, cartaInput, ...testoArr] = parts;
  const carta = parseInt(cartaInput);
  if (isNaN(carta) || carta < 1 || carta > 9) {
    await sendMessage(msg.chat.id, t(lang).invalidCardNumber);
    return;
  }

  const testo = testoArr.join(";").trim();
  if (!testo) {
    await sendMessage(msg.chat.id, t(lang).missingExchangeText);
    return;
  }

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
  await upsertOfferta({
    telegram_user_id: msg.from.id,
    telegram_username: msg.from.username,
    nickname_weward: session.nickname_weward!,
    collezione_id: collezione.id,
    numero_carta: carta,
    testo_libero: testo,
  });

  const locale = lang === "es" ? "es-ES" : "it-IT";
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString(locale);

  await sendMessage(msg.chat.id, t(lang).offerPublished(collezione.nome, carta, testo, expires));
}
