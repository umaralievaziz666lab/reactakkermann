// supabase/functions/send-code/index.ts
// Деплой: supabase functions deploy send-code
// Используется для отправки 2FA кода администраторам

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const BOT_TOKEN = Deno.env.get('BOT_TOKEN')!

serve(async (req) => {
  const { telegram_id, code } = await req.json()

  if (!telegram_id || !code) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 })
  }

  const text = `🔐 *Код входа в Akkermann Pulse Admin*\n\nВаш код: \`${code}\`\n\nДействителен 5 минут. Никому не сообщайте!`

  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegram_id,
      text,
      parse_mode: 'Markdown',
    }),
  })

  const result = await resp.json()
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
