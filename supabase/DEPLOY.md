# Deploy – WeWard Telegram Bot

> **Regola fondamentale:** tutti i deploy (Edge Function e migrazioni) partono
> sempre dal branch **`master`**. Le GitHub Actions leggono il codice da master.
> Prima di deployare, assicurarsi che le modifiche siano mergiate su master.

## Prerequisiti
- Supabase CLI installata: `npm i -g supabase`
- Progetto Supabase creato su [supabase.com](https://supabase.com)
- Bot Telegram creato via [@BotFather](https://t.me/BotFather)

## 1. Applica la migrazione DB

```bash
supabase db push
# oppure manualmente dal SQL Editor di Supabase:
# incolla il contenuto di migrations/20240101000000_schema.sql
```

Aggiorna i nomi delle collezioni nella tabella `collezioni` con quelle reali di WeWard.

## 2. Configura i segreti

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<token_dal_botfather>
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` vengono iniettati automaticamente
nelle Edge Functions di Supabase.

## 3. Deploy della Edge Function

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

L'URL della funzione sarà:
```
https://<project-ref>.supabase.co/functions/v1/telegram-bot
```

## 4. Registra il webhook Telegram

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<project-ref>.supabase.co/functions/v1/telegram-bot"}'
```

## 5. Verifica

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Scadenza annunci

Gli annunci scadono automaticamente dopo 7 giorni. La pulizia avviene a ogni
richiesta al bot (fire-and-forget). Per una pulizia periodica affidabile,
crea un cron job in Supabase:

```sql
select cron.schedule(
  'purge-expired-annunci',
  '0 3 * * *',
  $$delete from annunci where expires_at < now()$$
);
```
