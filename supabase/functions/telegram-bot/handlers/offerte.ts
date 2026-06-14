import type { TelegramMessage, UserSession, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { deleteAnnuncio, deleteAllUserAnnunci, getUserAnnunci } from "../utils/db.ts";
import { upsertSession } from "../utils/session.ts";
import { t } from "../utils/i18n.ts";

export async function handleMostraOfferte(
  msg: TelegramMessage,
  session: UserSession,
  lang: Lang,
) {
  const annunci = await getUserAnnunci(msg.from.id);

  if (annunci.length === 0) {
    await sendMessage(msg.chat.id, t(lang).noActiveOffers);
    return;
  }

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
    `${t(lang).offersHeader(annunci.length)}\n\n` +
      lines.join("\n\n") +
      `\n\n${t(lang).offersFooter}`,
  );
}

export async function handleCancellaNumero(
  msg: TelegramMessage,
  numero: number,
  session: UserSession,
  lang: Lang,
) {
  const offerMap = session.state_data?.offer_map;
  const dbId = offerMap?.[String(numero)];

  if (!dbId) {
    await sendMessage(msg.chat.id, t(lang).cancelNotFound(numero));
    return;
  }

  await deleteAnnuncio(dbId, msg.from.id);

  const updated = { ...offerMap };
  delete updated[String(numero)];
  await upsertSession(msg.from.id, {
    state_data: { ...session.state_data, offer_map: updated },
  });

  await sendMessage(msg.chat.id, t(lang).cancelDone(numero));
}

export async function handleCancellaTutte(msg: TelegramMessage, lang: Lang) {
  await deleteAllUserAnnunci(msg.from.id);
  await sendMessage(msg.chat.id, t(lang).cancelAllDone);
}
