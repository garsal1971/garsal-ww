// ── Telegram API types ────────────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
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

// ── App domain types ──────────────────────────────────────────────────────────

export type UserState = 'idle' | 'waiting_nickname';

export interface UserSession {
  telegram_user_id: number;
  telegram_username?: string;
  nickname_weward?: string;
  state: UserState;
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
  tipo: 'ho';
  testo_libero: string;
  created_at: string;
  expires_at: string;
}
