import type { TelegramUpdate, Lang } from "./types.ts";
import { getSession, upsertSession } from "./utils/session.ts";
import { sendMessage } from "./utils/telegram.ts";
import { purgeExpired } from "./utils/db.ts";
import { t } from "./utils/i18n.ts";
import { handleOffro } from "./handlers/offro.ts";
import { handleCerco } from "./handlers/cerco.ts";
import { handleLista } from "./handlers/lista.ts";
import { handleMostraOfferte, handleCancellaNumero, handleCancellaTutte } from "./handlers/offerte.ts";
import { handleNicknameInput, handleStart, handleIscritti, handleCancellami } from "./handlers/commands.ts";
import { handleAccetto, showDisclaimer } from "./handlers/disclaimer.ts";
import { showLanguageSelection, handleLanguageSelection } from "./handlers/language.ts";

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
      state: "selecting_language",
      status: "pending",
    });
    session = await getSession(userId);
    await showLanguageSelection(msg.chat.id);
    return;
  }

  const lang: Lang = session.language ?? "it";

  // /start sempre disponibile
  if (upper.startsWith("/START")) {
    if (session.status === "active") {
      await handleStart(msg, !!session.nickname_weward, lang);
    } else {
      await showLanguageSelection(msg.chat.id);
    }
    return;
  }

  // Admin (lingua-agnostico)
  if (upper === "ISCRITTI") {
    await handleIscritti(msg, lang);
    return;
  }

  // Selezione lingua
  if (session.state === "selecting_language") {
    const chosen = await handleLanguageSelection(msg);
    if (chosen) await showDisclaimer(msg.chat.id, chosen);
    return;
  }

  // CANCELLAMI / BORRARME sempre disponibile
  if (upper === "CANCELLAMI" || upper === "BORRARME") {
    await handleCancellami(msg, lang);
    return;
  }

  // Utente non iscritto: accetta disclaimer
  if (session.status !== "active") {
    if (upper === t(lang).acceptWord) {
      await handleAccetto(msg, lang);
    } else {
      await sendMessage(msg.chat.id, t(lang).notRegistered);
    }
    return;
  }

  // Utente iscritto senza nickname
  if (!session.nickname_weward) {
    await handleNicknameInput(msg, lang);
    return;
  }

  // ── Comandi bilingue ───────────────────────────────────────────────────────

  if (upper === "LISTA") {
    await handleLista(msg, lang);
    return;
  }

  if (upper === "MOSTRA OFFERTE" || upper === "VER OFERTAS") {
    await handleMostraOfferte(msg, session, lang);
    return;
  }

  // CANCELLA / BORRAR
  if (upper.startsWith("CANCELLA") || upper.startsWith("BORRAR")) {
    const arg = upper.startsWith("CANCELLA")
      ? upper.slice(8).trim()
      : upper.slice(6).trim();

    if (arg === "TUTTE" || arg === "TUTTO" || arg === "TODAS") {
      await handleCancellaTutte(msg, lang);
    } else {
      const n = parseInt(arg);
      if (!isNaN(n) && n > 0) {
        await handleCancellaNumero(msg, n, session, lang);
      } else {
        await sendMessage(msg.chat.id, t(lang).unknownCommand);
      }
    }
    return;
  }

  // OFFRO / OFREZCO
  if (upper.startsWith("OFFRO") || upper.startsWith("OFREZCO")) {
    const args = upper.startsWith("OFFRO")
      ? raw.slice(5).trim()
      : raw.slice(7).trim();
    await handleOffro(msg, args, session, lang);
    return;
  }

  // CERCO / BUSCO
  if (upper.startsWith("CERCO") || upper.startsWith("BUSCO")) {
    const args = raw.slice(5).trim();
    await handleCerco(msg, args, lang);
    return;
  }

  await sendMessage(msg.chat.id, t(lang).unknownCommand);
}
