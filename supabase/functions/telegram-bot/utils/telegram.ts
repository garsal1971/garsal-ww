import type { InlineKeyboard } from "../types.ts";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Telegram ${method} failed:`, err);
  }
  return res.json();
}

export function sendMessage(
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(keyboard
      ? { reply_markup: { inline_keyboard: keyboard } }
      : {}),
  });
}

export function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(keyboard
      ? { reply_markup: { inline_keyboard: keyboard } }
      : {}),
  });
}

export function answerCallbackQuery(callbackId: string, text?: string) {
  return call("answerCallbackQuery", {
    callback_query_id: callbackId,
    ...(text ? { text } : {}),
  });
}

export function deleteMessage(chatId: number, messageId: number) {
  return call("deleteMessage", { chat_id: chatId, message_id: messageId });
}
