import type { TelegramUpdate } from "./types.ts";
import { getSession, upsertSession } from "./utils/session.ts";
import { sendMessage } from "./utils/telegram.ts";
import { purgeExpired } from "./utils/db.ts";
import { handleOffro } from "./handlers/offro.ts";
import { handleCerco } from "./handlers/cerco.ts";
import { handleLista } from "./handlers/lista.ts";
import { handleNicknameInput, handleStart, HELP } from "./handlers/commands.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  try {
    const update: TelegramUpdate = await req.json();
    await handleUpdate(update);
  } catch (err) {
    console.error("Unhandled error:", err);
  }

  return new Response("OK", { status: 200 });
});

async function handleUpdate(update: TelegramUpdate) {
  purgeExpired().catch(console.error);

  const msg = update.message;
  if (!msg?.text) return;

  const raw = msg.text.trim();
  const upper = raw.toUpperCase();
  const userId = msg.from.id;

  // Ensure session exists
  let session = await getSession(userId);
  if (!session) {
    await upsertSession(userId, {
      telegram_username: msg.from.username,
      state: "waiting_nickname",
    });
    session = await getSession(userId);
  }

  // /start è sempre disponibile
  if (upper.startsWith("/START")) {
    await handleStart(msg, !!session?.nickname_weward);
    return;
  }

  // Prima volta: chiedi nickname
  if (!session?.nickname_weward) {
    await handleNicknameInput(msg);
    return;
  }

  // ── Comandi ───────────────────────────────────────────────────────────────────

  if (upper === "LISTA") {
    await handleLista(msg);
    return;
  }

  if (upper.startsWith("OFFRO")) {
    await handleOffro(msg, raw.slice(5).trim(), session!);
    return;
  }

  if (upper.startsWith("CERCO")) {
    await handleCerco(msg, raw.slice(5).trim());
    return;
  }

  await sendMessage(msg.chat.id, HELP);
}
