import type { Lang } from "../types.ts";

type Translations = {
  selectLanguage: string;
  invalidLanguage: string;
  disclaimerText: string;
  acceptWord: string;
  maxUsersReached: (max: number) => string;
  registrationConfirmed: string;
  askNickname: string;
  invalidNickname: string;
  nicknameSet: (nickname: string, help: string) => string;
  help: string;
  // OFFRO
  offerUsage: string;
  offerInvalidFormat: string;
  invalidCardNumber: string;
  missingExchangeText: string;
  collectionNotFound: (name: string) => string;
  collectionAmbiguous: (name: string, list: string) => string;
  offerPublished: (colName: string, carta: number, testo: string, expires: string) => string;
  // CERCO
  cercoUsage: string;
  cercoInvalidFormat: string;
  cercoNoOffers: (colName: string, carta: number) => string;
  cercoHeader: (colName: string) => string;
  // LISTA
  listaEmpty: string;
  listaHeader: string;
  // MOSTRA OFFERTE
  noActiveOffers: string;
  offersHeader: (n: number) => string;
  offersFooter: string;
  // CANCELLA
  cancelNotFound: (n: number) => string;
  cancelDone: (n: number) => string;
  cancelAllDone: string;
  // CANCELLAMI
  selfCancelDone: string;
  // Admin
  statsMessage: (active: number, maxLabel: string, pending: number) => string;
  // Misc
  unknownCommand: string;
  notRegistered: string;
};

const it: Translations = {
  selectLanguage:
    `🌐 <b>Seleziona la lingua / Selecciona el idioma</b>\n\n` +
    `Scrivi <b>IT</b> per italiano\n` +
    `Escribe <b>ES</b> para español`,

  invalidLanguage:
    `Lingua non valida. Scrivi <b>IT</b> per italiano o <b>ES</b> para español.`,

  disclaimerText:
    `📋 <b>Disclaimer</b>\n\n` +
    `Questo bot è un servizio indipendente creato da utenti WeWard per facilitare lo scambio di WeCards tra collezionisti. Non è affiliato, sponsorizzato o approvato da WeWard o da WeWard SAS.\n\n` +
    `I nomi delle collezioni e delle carte sono proprietà di WeWard SAS. Questo bot non raccoglie né conserva dati personali oltre allo username Telegram e al nickname WeWard, utilizzati esclusivamente per facilitare i contatti tra utenti. Gli annunci vengono eliminati automaticamente dopo 7 giorni.\n\n` +
    `Puoi cancellare il tuo nickname e tutti i tuoi annunci in qualsiasi momento usando il comando <code>CANCELLAMI</code>.\n\n` +
    `Gli scambi avvengono direttamente tra utenti: il bot non è responsabile dell'esito delle trattative.\n\n` +
    `Scrivi <b>ACCETTO</b> per confermare e continuare.`,

  acceptWord: "ACCETTO",

  maxUsersReached: (max) =>
    `😔 Il bot ha raggiunto il numero massimo di iscritti (<b>${max}</b>).\n` +
    `Non è possibile iscriversi al momento. Riprova più avanti.`,

  registrationConfirmed:
    `✅ Iscrizione confermata!\n\nPer iniziare, inviami il tuo <b>nickname WeWard</b>:`,

  askNickname: `Per iniziare, inviami il tuo <b>nickname WeWard</b>:`,

  invalidNickname: `Nickname non valido (min. 2 caratteri). Riprova:`,

  nicknameSet: (nickname, help) =>
    `✅ Nickname impostato: <b>${nickname}</b>\n\n${help}`,

  help:
    `<b>Comandi disponibili:</b>\n\n` +
    `<code>OFFRO collezione;carta;cosa cerco</code>\n` +
    `  Pubblica un annuncio di scambio\n` +
    `  Es: <code>OFFRO Roma;3;cerco la 5 di Parigi</code>\n\n` +
    `<code>CERCO collezione</code> o <code>CERCO collezione;carta</code>\n` +
    `  Vedi chi offre quella carta\n\n` +
    `<code>LISTA</code>\n` +
    `  Mostra le collezioni con numero di offerte attive\n\n` +
    `<code>MOSTRA OFFERTE</code>\n` +
    `  Elenca le tue offerte attive con numero progressivo\n\n` +
    `<code>CANCELLA [prog]</code>\n` +
    `  Cancella l'offerta con quel numero (dopo MOSTRA OFFERTE)\n\n` +
    `<code>CANCELLA TUTTE</code>\n` +
    `  Cancella tutte le tue offerte\n\n` +
    `<code>CANCELLAMI</code>\n` +
    `  Elimina tutti i tuoi dati e annunci dal bot`,

  offerUsage:
    `Formato: <code>OFFRO collezione;carta;cosa cerco in cambio</code>\n` +
    `Es: <code>OFFRO Roma;3;cerco la carta 5 di Parigi</code>`,

  offerInvalidFormat:
    `❌ Formato non valido.\nUsa: <code>OFFRO collezione;carta;cosa cerco in cambio</code>`,

  invalidCardNumber: `❌ Il numero carta deve essere tra 1 e 9.`,

  missingExchangeText: `❌ Specifica cosa cerchi in cambio.`,

  collectionNotFound: (name) =>
    `❌ Collezione "<b>${name}</b>" non trovata.\n` +
    `Scrivi <code>LISTA</code> per vedere le collezioni disponibili.`,

  collectionAmbiguous: (name, list) =>
    `⚠️ Più collezioni trovate per "<b>${name}</b>":\n${list}\n\nSii più specifico.`,

  offerPublished: (colName, carta, testo, expires) =>
    `✅ <b>Annuncio pubblicato!</b>\n\n` +
    `📚 ${colName} – Carta ${carta}\n` +
    `💬 In cambio cerco: <i>${testo}</i>\n` +
    `📅 Scade il: ${expires}`,

  cercoUsage:
    `Formato:\n` +
    `<code>CERCO collezione</code> – tutte le offerte della collezione\n` +
    `<code>CERCO collezione;carta</code> – offerte per carta specifica\n\n` +
    `Es: <code>CERCO Roma</code> oppure <code>CERCO Roma;3</code>`,

  cercoInvalidFormat: `❌ Il numero carta deve essere tra 1 e 9.`,

  cercoNoOffers: (colName, carta) =>
    `🃏 <b>${colName} – Carta ${carta}</b>\n\nNessuno offre questa carta al momento.`,

  cercoHeader: (colName) => `📚 <b>${colName}</b>\n\nNessuna offerta attiva per questa collezione.`,

  listaEmpty: `Nessuna collezione disponibile.`,

  listaHeader: `📚 <b>Collezioni disponibili:</b>`,

  noActiveOffers: `Non hai offerte attive al momento.`,

  offersHeader: (n) => `📋 <b>Le tue offerte attive (${n}):</b>`,

  offersFooter:
    `Per cancellarne una: <code>CANCELLA 1</code>\n` +
    `Per cancellarle tutte: <code>CANCELLA TUTTE</code>`,

  cancelNotFound: (n) =>
    `❌ Nessuna offerta numero ${n}.\nUsa <code>MOSTRA OFFERTE</code> per vedere la lista aggiornata.`,

  cancelDone: (n) => `✅ Offerta ${n} eliminata.`,

  cancelAllDone: `✅ Tutte le tue offerte sono state eliminate.`,

  selfCancelDone:
    `✅ I tuoi dati sono stati eliminati.\n\nNickname, annunci e iscrizione sono stati cancellati.\nPuoi riscriverti in qualsiasi momento con /start.`,

  statsMessage: (active, maxLabel, pending) =>
    `📊 <b>Statistiche iscritti:</b>\n\n` +
    `✅ Attivi: <b>${active}${maxLabel}</b>\n` +
    `⏳ In attesa: <b>${pending}</b>\n` +
    `👥 Totale: <b>${active + pending}</b>`,

  unknownCommand:
    `Comando non riconosciuto. Scrivi <code>LISTA</code> per vedere le collezioni o /start per l'elenco comandi.`,

  notRegistered:
    `Per usare il bot devi prima accettare il disclaimer.\nScrivi <b>ACCETTO</b> per continuare.`,
};

const es: Translations = {
  selectLanguage:
    `🌐 <b>Seleziona la lingua / Selecciona el idioma</b>\n\n` +
    `Scrivi <b>IT</b> per italiano\n` +
    `Escribe <b>ES</b> para español`,

  invalidLanguage:
    `Idioma no válido. Escribe <b>IT</b> per italiano o <b>ES</b> para español.`,

  disclaimerText:
    `📋 <b>Aviso legal</b>\n\n` +
    `Este bot es un servicio independiente creado por usuarios de WeWard para facilitar el intercambio de WeCards entre coleccionistas. No está afiliado, patrocinado ni respaldado por WeWard ni por WeWard SAS.\n\n` +
    `Los nombres de las colecciones y las cartas son propiedad de WeWard SAS. Este bot no recopila ni almacena datos personales más allá del nombre de usuario de Telegram y el apodo de WeWard, utilizados exclusivamente para facilitar el contacto entre usuarios. Los anuncios se eliminan automáticamente después de 7 días.\n\n` +
    `Puedes eliminar tu apodo y todos tus anuncios en cualquier momento usando el comando <code>BORRARME</code>.\n\n` +
    `Los intercambios se realizan directamente entre usuarios: el bot no es responsable del resultado de las negociaciones.\n\n` +
    `Escribe <b>ACEPTO</b> para confirmar y continuar.`,

  acceptWord: "ACEPTO",

  maxUsersReached: (max) =>
    `😔 El bot ha alcanzado el número máximo de usuarios (<b>${max}</b>).\n` +
    `No es posible registrarse en este momento. Inténtalo más adelante.`,

  registrationConfirmed:
    `✅ ¡Registro confirmado!\n\nPara empezar, envíame tu <b>apodo de WeWard</b>:`,

  askNickname: `Para empezar, envíame tu <b>apodo de WeWard</b>:`,

  invalidNickname: `Apodo no válido (mín. 2 caracteres). Inténtalo de nuevo:`,

  nicknameSet: (nickname, help) =>
    `✅ Apodo establecido: <b>${nickname}</b>\n\n${help}`,

  help:
    `<b>Comandos disponibles:</b>\n\n` +
    `<code>OFREZCO colección;carta;qué busco</code>\n` +
    `  Publica un anuncio de intercambio\n` +
    `  Ej: <code>OFREZCO Roma;3;busco la 5 de París</code>\n\n` +
    `<code>BUSCO colección</code> o <code>BUSCO colección;carta</code>\n` +
    `  Ver quién ofrece esa carta\n\n` +
    `<code>LISTA</code>\n` +
    `  Muestra las colecciones con número de ofertas activas\n\n` +
    `<code>VER OFERTAS</code>\n` +
    `  Lista tus ofertas activas con número progresivo\n\n` +
    `<code>BORRAR [prog]</code>\n` +
    `  Borra la oferta con ese número (después de VER OFERTAS)\n\n` +
    `<code>BORRAR TODAS</code>\n` +
    `  Borra todas tus ofertas\n\n` +
    `<code>BORRARME</code>\n` +
    `  Elimina todos tus datos y anuncios del bot`,

  offerUsage:
    `Formato: <code>OFREZCO colección;carta;qué busco a cambio</code>\n` +
    `Ej: <code>OFREZCO Roma;3;busco la carta 5 de París</code>`,

  offerInvalidFormat:
    `❌ Formato no válido.\nUsa: <code>OFREZCO colección;carta;qué busco a cambio</code>`,

  invalidCardNumber: `❌ El número de carta debe estar entre 1 y 9.`,

  missingExchangeText: `❌ Especifica qué buscas a cambio.`,

  collectionNotFound: (name) =>
    `❌ Colección "<b>${name}</b>" no encontrada.\n` +
    `Escribe <code>LISTA</code> para ver las colecciones disponibles.`,

  collectionAmbiguous: (name, list) =>
    `⚠️ Varias colecciones encontradas para "<b>${name}</b>":\n${list}\n\nSé más específico.`,

  offerPublished: (colName, carta, testo, expires) =>
    `✅ <b>¡Anuncio publicado!</b>\n\n` +
    `📚 ${colName} – Carta ${carta}\n` +
    `💬 A cambio busco: <i>${testo}</i>\n` +
    `📅 Expira el: ${expires}`,

  cercoUsage:
    `Formato:\n` +
    `<code>BUSCO colección</code> – todas las ofertas de la colección\n` +
    `<code>BUSCO colección;carta</code> – ofertas para carta específica\n\n` +
    `Ej: <code>BUSCO Roma</code> o <code>BUSCO Roma;3</code>`,

  cercoInvalidFormat: `❌ El número de carta debe estar entre 1 y 9.`,

  cercoNoOffers: (colName, carta) =>
    `🃏 <b>${colName} – Carta ${carta}</b>\n\nNadie ofrece esta carta en este momento.`,

  cercoHeader: (colName) => `📚 <b>${colName}</b>\n\nNinguna oferta activa para esta colección.`,

  listaEmpty: `No hay colecciones disponibles.`,

  listaHeader: `📚 <b>Colecciones disponibles:</b>`,

  noActiveOffers: `No tienes ofertas activas en este momento.`,

  offersHeader: (n) => `📋 <b>Tus ofertas activas (${n}):</b>`,

  offersFooter:
    `Para borrar una: <code>BORRAR 1</code>\n` +
    `Para borrarlas todas: <code>BORRAR TODAS</code>`,

  cancelNotFound: (n) =>
    `❌ No hay oferta número ${n}.\nUsa <code>VER OFERTAS</code> para ver la lista actualizada.`,

  cancelDone: (n) => `✅ Oferta ${n} eliminada.`,

  cancelAllDone: `✅ Todas tus ofertas han sido eliminadas.`,

  selfCancelDone:
    `✅ Tus datos han sido eliminados.\n\nApodo, anuncios e inscripción han sido cancelados.\nPuedes volver a registrarte en cualquier momento con /start.`,

  statsMessage: (active, maxLabel, pending) =>
    `📊 <b>Estadísticas de usuarios:</b>\n\n` +
    `✅ Activos: <b>${active}${maxLabel}</b>\n` +
    `⏳ En espera: <b>${pending}</b>\n` +
    `👥 Total: <b>${active + pending}</b>`,

  unknownCommand:
    `Comando no reconocido. Escribe <code>LISTA</code> para ver las colecciones o /start para la lista de comandos.`,

  notRegistered:
    `Para usar el bot debes aceptar primero el aviso legal.\nEscribe <b>ACEPTO</b> para continuar.`,
};

export const translations: Record<Lang, Translations> = { it, es };

export function t(lang: Lang): Translations {
  return translations[lang] ?? translations.it;
}
