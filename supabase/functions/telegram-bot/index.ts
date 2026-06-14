import type { TelegramUpdate } from "./types.ts";
import { handleCallbackQuery } from "./handlers/callbacks.ts";
import {
  handleCancellaTutti,
  handleHelp,
  handleMieiAnnunci,
  handleStart,
} from "./handlers/commands.ts";
import {
  handleNicknameInput,
  handleQuantitaInput,
  startPublishFlow,
} from "./handlers/flow.ts";
import { getSession } from "./utils/session.ts";
import { sendMessage } from "./utils/telegram.ts";
import { mainMenu } from "./handlers/keyboards.ts";
import { purgeExpired } from "./utils/db.ts";

Deno.serve(async (req: Request) => {
  // Supabase Edge Functions require a 200 response quickly
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update: TelegramUpdate = await req.json();
    await handleUpdate(update);
  } catch (err) {
    console.error("Unhandled error:", err);
  }

  return new Response("OK", { status: 200 });
});

async function handleUpdate(update: TelegramUpdate) {
  // Opportunistically purge expired announcements
  purgeExpired().catch(console.error);

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const msg = update.message;
  if (!msg || !msg.text) return;

  const text = msg.text.trim();
  const userId = msg.from.id;

  // ── Commands (always available) ──────────────────────────────────────────────
  if (text.startsWith("/start")) {
    await handleStart(msg);
    return;
  }
  if (text.startsWith("/help")) {
    await handleHelp(msg);
    return;
  }
  if (text.startsWith("/miei")) {
    await handleMieiAnnunci(msg);
    return;
  }
  if (text.startsWith("/cancella")) {
    await handleCancellaTutti(msg);
    return;
  }

  // ── State-based routing ──────────────────────────────────────────────────────
  const session = await getSession(userId);
  const state = session?.state ?? "waiting_nickname";

  switch (state) {
    case "waiting_nickname":
      await handleNicknameInput(msg);
      break;

    case "waiting_quantita":
      await handleQuantitaInput(msg);
      break;

    case "idle":
    default:
      await sendMessage(
        msg.chat.id,
        "Usa i pulsanti qui sotto o /help per vedere i comandi disponibili.",
        mainMenu(),
      );
      break;
  }
}
