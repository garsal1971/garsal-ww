import type { TelegramMessage, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { upsertSession } from "../utils/session.ts";
import { getUserStats } from "../utils/db.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { t } from "../utils/i18n.ts";

const ADMIN_ID = parseInt(Deno.env.get("ADMIN_TELEGRAM_ID") ?? "0");
const MAX_USERS = parseInt(Deno.env.get("MAX_USERS") ?? "50");

export async function handleStart(msg: TelegramMessage, hasNickname: boolean, lang: Lang) {
  if (hasNickname) {
    await sendMessage(msg.chat.id, t(lang).help);
  } else {
    await sendMessage(
      msg.chat.id,
      `Ciao! 👋 Benvenuto nel bot per lo scambio di <b>WeCards</b>.\n\n` +
        t(lang).askNickname,
    );
  }
}

export async function handleCancellami(msg: TelegramMessage, lang: Lang) {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const userId = msg.from.id;

  await Promise.all([
    db.from("annunci").delete().eq("telegram_user_id", userId),
    db.from("user_sessions").delete().eq("telegram_user_id", userId),
  ]);

  await sendMessage(msg.chat.id, t(lang).selfCancelDone);
}

export async function handleIscritti(msg: TelegramMessage, lang: Lang) {
  if (ADMIN_ID === 0 || msg.from.id !== ADMIN_ID) return;
  const stats = await getUserStats();
  const maxLabel = MAX_USERS > 0 ? `/${MAX_USERS}` : "";
  await sendMessage(msg.chat.id, t(lang).statsMessage(stats.active, maxLabel, stats.pending));
}

export async function handleNicknameInput(msg: TelegramMessage, lang: Lang): Promise<boolean> {
  const nickname = msg.text?.trim();
  if (!nickname || nickname.length < 2) {
    await sendMessage(msg.chat.id, t(lang).invalidNickname);
    return false;
  }

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    nickname_weward: nickname,
    state: "idle",
  });

  await sendMessage(msg.chat.id, t(lang).nicknameSet(nickname, t(lang).help));
  return true;
}
