// ── Telegram API types ────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

// ── App domain types ──────────────────────────────────────────────────────────

export type UserState =
  | 'idle'
  | 'waiting_nickname'
  | 'selecting_collection'
  | 'selecting_carta'
  | 'selecting_tipo'
  | 'waiting_quantita'
  | 'search_selecting_collection'
  | 'search_selecting_carta';

export interface StateData {
  collezione_id?: number;
  collezione_nome?: string;
  numero_carta?: number;
}

export interface UserSession {
  telegram_user_id: number;
  telegram_username?: string;
  nickname_weward?: string;
  state: UserState;
  state_data: StateData;
  updated_at: string;
}

export interface Collezione {
  id: number;
  nome: string;
}

export interface Annuncio {
  id: number;
  telegram_user_id: number;
  telegram_username?: string;
  nickname_weward: string;
  collezione_id: number;
  numero_carta: number;
  tipo: 'ho' | 'cerco';
  quantita?: number;
  created_at: string;
  expires_at: string;
  collezioni?: Collezione;
}
