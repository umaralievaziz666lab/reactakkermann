// supabase/functions/send-push/index.ts
// Деплой: supabase functions deploy send-push
// Слушает INSERT в таблицу notifications и шлёт Telegram сообщение

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BOT_TOKEN = Deno.env.get('BOT_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const { record } = await req.json()
  if (!record?.user_id) return new Response('ok')

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: user } = await sb.from('users').select('telegram_id').eq('id', record.user_id).single()

  if (user?.telegram_id) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_id,
        text: `🔔 *${record.title}*\n\n${record.message || ''}`,
        parse_mode: 'Markdown',
      }),
    })
  }

  return new Response('ok')
})
