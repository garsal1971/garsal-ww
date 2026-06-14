import type { TelegramMessage, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { countActiveUsers } from "../utils/db.ts";
import { t } from "../utils/i18n.ts";

const MAX_USERS = parseInt(Deno.env.get("MAX_USERS") ?? "50");

export function showDisclaimer(chatId: number, lang: Lang) {
  return sendMessage(chatId, t(lang).disclaimerText);
}

export async function handleAccetto(msg: TelegramMessage, lang: Lang): Promise<boolean> {
  if (MAX_USERS > 0) {
    const active = await countActiveUsers();
    if (active >= MAX_USERS) {
      await sendMessage(msg.chat.id, t(lang).maxUsersReached(MAX_USERS));
      return false;
    }
  }

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    status: "active",
    state: "waiting_nickname",
    accepted_at: new Date().toISOString(),
  });

  await sendMessage(msg.chat.id, t(lang).registrationConfirmed);
  return true;
}
