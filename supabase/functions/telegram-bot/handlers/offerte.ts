import type { TelegramMessage, UserSession } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { deleteAnnuncio, deleteAllUserAnnunci, getUserAnnunci } from "../utils/db.ts";
import { upsertSession } from "../utils/session.ts";

export async function handleMostraOfferte(
  msg: TelegramMessage,
  session: UserSession,
) {
  const annunci = await getUserAnnunci(msg.from.id);

  if (annunci.length === 0) {
    await sendMessage(msg.chat.id, "Non hai offerte attive al momento.");
    return;
  }

  // Build progressive map and save it in session so CANCELLA N can resolve it
  const offerMap: Record<string, number> = {};
  annunci.forEach((a, i) => { offerMap[String(i + 1)] = a.id; });
  await upsertSession(msg.from.id, {
    state_data: { ...session.state_data, offer_map: offerMap },
  });

  const lines = annunci.map((a, i) => {
    const nome = (a.collezioni as { nome: string }).nome;
    return `${i + 1}. 📚 <b>${nome}</b> – Carta ${a.numero_carta}\n   💬 <i>${a.testo_libero}</i>`;
  });

  await sendMessage(
    msg.chat.id,
    `📋 <b>Le tue offerte attive (${annunci.length}):</b>\n\n` +
      lines.join("\n\n") +
      `\n\nPer cancellarne una: <code>CANCELLA 1</code>\n` +
      `Per cancellarle tutte: <code>CANCELLA TUTTE</code>`,
  );
}

export async function handleCancellaNumero(
  msg: TelegramMessage,
  numero: number,
  session: UserSession,
) {
  const offerMap = session.state_data?.offer_map;
  const dbId = offerMap?.[String(numero)];

  if (!dbId) {
    await sendMessage(
      msg.chat.id,
      `❌ Nessuna offerta numero ${numero}.\nUsa <code>MOSTRA OFFERTE</code> per vedere la lista aggiornata.`,
    );
    return;
  }

  await deleteAnnuncio(dbId, msg.from.id);

  // Remove from map
  const updated = { ...offerMap };
  delete updated[String(numero)];
  await upsertSession(msg.from.id, {
    state_data: { ...session.state_data, offer_map: updated },
  });

  await sendMessage(msg.chat.id, `✅ Offerta ${numero} eliminata.`);
}

export async function handleCancellaTutte(msg: TelegramMessage) {
  await deleteAllUserAnnunci(msg.from.id);
  await sendMessage(msg.chat.id, "✅ Tutte le tue offerte sono state eliminate.");
}
