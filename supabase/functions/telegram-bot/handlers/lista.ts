import type { TelegramMessage } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { countOffertePerCollezione, getCollezioni } from "../utils/db.ts";

export async function handleLista(msg: TelegramMessage) {
  const [collezioni, counts] = await Promise.all([
    getCollezioni(),
    countOffertePerCollezione(),
  ]);

  if (collezioni.length === 0) {
    await sendMessage(msg.chat.id, "Nessuna collezione disponibile.");
    return;
  }

  const lines = collezioni.map((c) => {
    const n = counts.get(c.id) ?? 0;
    return `• ${c.nome} (${n})`;
  });

  await sendMessage(
    msg.chat.id,
    `📚 <b>Collezioni disponibili:</b>\n\n${lines.join("\n")}`,
  );
}
