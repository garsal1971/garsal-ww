/**
 * Handles the multi-step announcement creation flow.
 * Text messages are routed here when the user is mid-flow.
 */
import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { createAnnuncio, findMatches, getCollezioni } from "../utils/db.ts";
import { getSession, setState, upsertSession } from "../utils/session.ts";
import {
  cartaKeyboard,
  collectionKeyboard,
  mainMenu,
  matchMessage,
  tipoKeyboard,
} from "./keyboards.ts";

export async function handleNicknameInput(msg: TelegramMessage) {
  const nickname = msg.text?.trim();
  if (!nickname || nickname.length < 2) {
    await sendMessage(msg.chat.id, "Nickname non valido. Riprova:");
    return;
  }

  await upsertSession(msg.from.id, {
    telegram_username: msg.from.username,
    nickname_weward: nickname,
    state: "idle",
    state_data: {},
  });

  await sendMessage(
    msg.chat.id,
    `✅ Nickname impostato: <b>${nickname}</b>\n\nCosa vuoi fare?`,
    mainMenu(),
  );
}

export async function startPublishFlow(chatId: number, userId: number) {
  const collezioni = await getCollezioni();
  if (collezioni.length === 0) {
    await sendMessage(chatId, "Nessuna collezione disponibile al momento.");
    return;
  }
  await setState(userId, "selecting_collection");
  await sendMessage(
    chatId,
    "📚 <b>Scegli la collezione:</b>",
    collectionKeyboard(collezioni),
  );
}

export async function handleCollectionSelected(
  chatId: number,
  userId: number,
  messageId: number,
  callbackId: string,
  collId: number,
  collNome: string,
) {
  await setState(userId, "selecting_carta", {
    collezione_id: collId,
    collezione_nome: collNome,
  });
  const { editMessage, answerCallbackQuery } = await import(
    "../utils/telegram.ts"
  );
  await answerCallbackQuery(callbackId);
  await editMessage(
    chatId,
    messageId,
    `📚 Collezione: <b>${collNome}</b>\n\n🃏 <b>Scegli il numero della carta (1-9):</b>`,
    cartaKeyboard(),
  );
}

export async function handleCartaSelected(
  chatId: number,
  userId: number,
  messageId: number,
  callbackId: string,
  numeroCarta: number,
) {
  const session = await getSession(userId);
  await setState(userId, "selecting_tipo", {
    ...session?.state_data,
    numero_carta: numeroCarta,
  });
  const { editMessage, answerCallbackQuery } = await import(
    "../utils/telegram.ts"
  );
  await answerCallbackQuery(callbackId);
  await editMessage(
    chatId,
    messageId,
    `📚 Collezione: <b>${session?.state_data?.collezione_nome}</b>\n` +
      `🃏 Carta: <b>${numeroCarta}</b>\n\n` +
      `Hai questa carta o la stai cercando?`,
    tipoKeyboard(),
  );
}

export async function handleTipoSelected(
  chatId: number,
  userId: number,
  messageId: number,
  callbackId: string,
  tipo: "ho" | "cerco",
) {
  const session = await getSession(userId);
  const { editMessage, answerCallbackQuery } = await import(
    "../utils/telegram.ts"
  );
  await answerCallbackQuery(callbackId);

  if (tipo === "cerco") {
    await saveAnnuncio(chatId, userId, messageId, session, tipo);
  } else {
    await setState(userId, "waiting_quantita", {
      ...session?.state_data,
      tipo,
    });
    await editMessage(
      chatId,
      messageId,
      `📚 Collezione: <b>${session?.state_data?.collezione_nome}</b>\n` +
        `🃏 Carta: <b>${session?.state_data?.numero_carta}</b>\n\n` +
        `Quanti doppioni hai? Rispondimi con un numero:`,
    );
  }
}

export async function handleQuantitaInput(msg: TelegramMessage) {
  const session = await getSession(msg.from.id);
  const quantita = parseInt(msg.text?.trim() ?? "");

  if (isNaN(quantita) || quantita < 1) {
    await sendMessage(msg.chat.id, "Inserisci un numero valido (es: 1, 2, 3...):");
    return;
  }

  await saveAnnuncio(msg.chat.id, msg.from.id, null, session, "ho", quantita);
}

async function saveAnnuncio(
  chatId: number,
  userId: number,
  _messageId: number | null,
  session: Awaited<ReturnType<typeof getSession>>,
  tipo: "ho" | "cerco",
  quantita?: number,
) {
  const sd = session?.state_data;
  if (!sd?.collezione_id || !sd?.numero_carta || !session?.nickname_weward) {
    await sendMessage(chatId, "Dati mancanti. Riprova dall'inizio.", mainMenu());
    await setState(userId, "idle");
    return;
  }

  const annuncio = await createAnnuncio({
    telegram_user_id: userId,
    telegram_username: session.telegram_username,
    nickname_weward: session.nickname_weward,
    collezione_id: sd.collezione_id,
    numero_carta: sd.numero_carta,
    tipo,
    quantita,
  });

  await setState(userId, "idle");

  const matches = await findMatches(annuncio);
  const matchText = matchMessage(matches, tipo);

  const tipoLabel = tipo === "ho" ? "Ho doppione" : "Cerco";
  const qtyLabel = tipo === "ho" && quantita ? ` (x${quantita})` : "";

  await sendMessage(
    chatId,
    `✅ <b>Annuncio pubblicato!</b>\n` +
      `📚 ${sd.collezione_nome} – Carta <b>${sd.numero_carta}</b> – ${tipoLabel}${qtyLabel}\n\n` +
      matchText,
    mainMenu(),
  );
}
