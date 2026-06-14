import type { TelegramMessage, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { t } from "../utils/i18n.ts";

export function showLanguageSelection(chatId: number) {
  // The selectLanguage string is identical in both langs, so we use either
  return sendMessage(chatId, t("it").selectLanguage);
}

export async function handleLanguageSelection(
  msg: TelegramMessage,
): Promise<Lang | null> {
  const upper = msg.text?.trim().toUpperCase();

  if (upper !== "IT" && upper !== "ES") {
    await sendMessage(msg.chat.id, t("it").invalidLanguage);
    return null;
  }

  const lang: Lang = upper === "IT" ? "it" : "es";

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    language: lang,
    state: "pending_disclaimer",
  });

  return lang;
}
