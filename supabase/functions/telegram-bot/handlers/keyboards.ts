import type { Annuncio, Collezione, InlineKeyboard } from "../types.ts";

export function mainMenu(): InlineKeyboard {
  return [
    [{ text: "📢 Pubblica annuncio", callback_data: "menu:pubblica" }],
    [{ text: "📋 I miei annunci", callback_data: "menu:miei" }],
  ];
}

export function collectionKeyboard(collezioni: Collezione[]): InlineKeyboard {
  const rows: InlineKeyboard = collezioni.map((c) => [
    { text: c.nome, callback_data: `coll:${c.id}:${c.nome}` },
  ]);
  rows.push([{ text: "❌ Annulla", callback_data: "menu:start" }]);
  return rows;
}

export function cartaKeyboard(): InlineKeyboard {
  // 3×3 grid + cancel
  return [
    [1, 2, 3].map((n) => ({ text: `${n}`, callback_data: `carta:${n}` })),
    [4, 5, 6].map((n) => ({ text: `${n}`, callback_data: `carta:${n}` })),
    [7, 8, 9].map((n) => ({ text: `${n}`, callback_data: `carta:${n}` })),
    [{ text: "❌ Annulla", callback_data: "menu:start" }],
  ];
}

export function tipoKeyboard(): InlineKeyboard {
  return [
    [
      { text: "🔁 Ho doppione", callback_data: "tipo:ho" },
      { text: "🔍 Cerco", callback_data: "tipo:cerco" },
    ],
    [{ text: "❌ Annulla", callback_data: "menu:start" }],
  ];
}

export function myAnnunciMessage(
  annunci: Annuncio[],
): { text: string; keyboard: InlineKeyboard } {
  if (annunci.length === 0) {
    return {
      text: "Non hai annunci attivi al momento.",
      keyboard: mainMenu(),
    };
  }

  const lines = annunci.map((a) => {
    const tipo = a.tipo === "ho" ? "🔁 Ho doppione" : "🔍 Cerco";
    const qty = a.tipo === "ho" && a.quantita ? ` (x${a.quantita})` : "";
    const nomeCollezione = (a.collezioni as { nome: string } | undefined)?.nome ?? `#${a.collezione_id}`;
    return `• ${tipo}${qty} – carta <b>${a.numero_carta}</b> di <i>${nomeCollezione}</i>`;
  });

  const keyboard: InlineKeyboard = [
    ...annunci.map((a) => [
      { text: `🗑 Elimina #${a.id}`, callback_data: `del:${a.id}` },
    ]),
    [{ text: "🏠 Menu principale", callback_data: "menu:start" }],
  ];

  return {
    text: `<b>I tuoi annunci attivi:</b>\n\n${lines.join("\n")}`,
    keyboard,
  };
}

export function matchMessage(
  matches: Array<{
    annuncio: Annuncio & { collezioni: Collezione };
    mutual: boolean;
  }>,
  tipo: "ho" | "cerco",
): string {
  if (matches.length === 0) {
    return tipo === "cerco"
      ? "Nessun match trovato al momento. Ti avviserò quando qualcuno pubblica quella carta! 👀"
      : "Nessun utente cerca questa carta al momento. Annuncio salvato! 👍";
  }

  const intro =
    tipo === "cerco"
      ? `🎉 <b>${matches.length} utente/i hanno questa carta!</b>`
      : `🎉 <b>${matches.length} utente/i cercano questa carta!</b>`;

  const lines = matches.map((m) => {
    const user = m.annuncio.telegram_username
      ? `@${m.annuncio.telegram_username}`
      : `<i>${m.annuncio.nickname_weward}</i>`;
    const qty =
      m.annuncio.tipo === "ho" && m.annuncio.quantita
        ? ` (ha ${m.annuncio.quantita} doppioni)`
        : "";
    const mutual = m.mutual ? " ✅ <i>match reciproco!</i>" : "";
    return `👤 ${user}${qty}${mutual}`;
  });

  return `${intro}\n\n${lines.join("\n")}\n\n<i>Contattali direttamente su Telegram per accordarvi sullo scambio.</i>`;
}
