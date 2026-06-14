import type { TelegramMessage, Lang } from "../types.ts";
import { sendMessage } from "../utils/telegram.ts";
import { countOffertePerCollezione, getCollezioni } from "../utils/db.ts";
import { t } from "../utils/i18n.ts";

export async function handleLista(msg: TelegramMessage, lang: Lang) {
  const [collezioni, counts] = await Promise.all([
    getCollezioni(),
    countOffertePerCollezione(),
  ]);

  if (collezioni.length === 0) {
    await sendMessage(msg.chat.id, t(lang).listaEmpty);
    return;
  }

  const lines = collezioni.map((c) => {
    const n = counts.get(c.id) ?? 0;
    return `• ${c.nome} (${n})`;
  });

  await sendMessage(
    msg.chat.id,
    `${t(lang).listaHeader}\n\n${lines.join("\n")}`,
  );
}
