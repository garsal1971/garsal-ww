import type { TelegramCallbackQuery } from "../types.ts";
import { answerCallbackQuery, sendMessage } from "../utils/telegram.ts";
import { deleteAnnuncio, getUserAnnunci } from "../utils/db.ts";
import { getSession } from "../utils/session.ts";
import { mainMenu, myAnnunciMessage } from "./keyboards.ts";
import {
  handleCartaSelected,
  handleCollectionSelected,
  handleSearchCartaSelected,
  handleSearchCollectionSelected,
  handleTipoSelected,
  startPublishFlow,
  startSearchFlow,
} from "./flow.ts";

export async function handleCallbackQuery(cq: TelegramCallbackQuery) {
  const data = cq.data ?? "";
  const userId = cq.from.id;
  const chatId = cq.message?.chat.id ?? userId;
  const messageId = cq.message?.message_id ?? 0;

  // ── Navigation ──────────────────────────────────────────────────────────────
  if (data === "menu:start") {
    await answerCallbackQuery(cq.id);
    const session = await getSession(userId);
    const name = session?.nickname_weward ?? cq.from.first_name;
    await sendMessage(chatId, `Ciao <b>${name}</b>! Cosa vuoi fare?`, mainMenu());
    return;
  }

  if (data === "menu:pubblica") {
    await answerCallbackQuery(cq.id);
    const session = await getSession(userId);
    if (!session?.nickname_weward) {
      await sendMessage(chatId, "Prima devi impostare il tuo nickname. Usa /start.");
      return;
    }
    await startPublishFlow(chatId, userId);
    return;
  }

  if (data === "menu:cerca") {
    await answerCallbackQuery(cq.id);
    await startSearchFlow(chatId, userId);
    return;
  }

  if (data === "menu:miei") {
    await answerCallbackQuery(cq.id);
    const annunci = await getUserAnnunci(userId);
    const { text, keyboard } = myAnnunciMessage(annunci);
    await sendMessage(chatId, text, keyboard);
    return;
  }

  // ── Delete announcement ──────────────────────────────────────────────────────
  if (data.startsWith("del:")) {
    const id = parseInt(data.slice(4));
    await deleteAnnuncio(id, userId);
    await answerCallbackQuery(cq.id, "Annuncio eliminato ✅");
    const annunci = await getUserAnnunci(userId);
    const { text, keyboard } = myAnnunciMessage(annunci);
    await sendMessage(chatId, text, keyboard);
    return;
  }

  // ── Flow: collection selected ────────────────────────────────────────────────
  // Route to publish or search based on current session state
  if (data.startsWith("coll:")) {
    const parts = data.split(":");
    const collId = parseInt(parts[1]);
    const collNome = parts.slice(2).join(":");
    const session = await getSession(userId);
    if (session?.state === "search_selecting_collection") {
      await handleSearchCollectionSelected(chatId, userId, messageId, cq.id, collId, collNome);
    } else {
      await handleCollectionSelected(chatId, userId, messageId, cq.id, collId, collNome);
    }
    return;
  }

  // ── Flow: card number selected ───────────────────────────────────────────────
  if (data.startsWith("carta:")) {
    const numero = parseInt(data.slice(6));
    const session = await getSession(userId);
    if (session?.state === "search_selecting_carta") {
      await handleSearchCartaSelected(chatId, userId, messageId, cq.id, numero);
    } else {
      await handleCartaSelected(chatId, userId, messageId, cq.id, numero);
    }
    return;
  }

  // ── Flow: tipo selected ──────────────────────────────────────────────────────
  if (data.startsWith("tipo:")) {
    const tipo = data.slice(5) as "ho" | "cerco";
    await handleTipoSelected(chatId, userId, messageId, cq.id, tipo);
    return;
  }

  await answerCallbackQuery(cq.id);
}
