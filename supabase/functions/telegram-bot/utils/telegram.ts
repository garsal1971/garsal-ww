const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`Telegram ${method} failed:`, await res.text());
  return res.json();
}

export function sendMessage(chatId: number, text: string) {
  return call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}
