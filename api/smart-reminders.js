// ============================================================
// VERCEL API ROUTE — Умные напоминания
// Напоминает сотрудникам если не заходили 3+ дня
// Вызывать: POST /api/smart-reminders
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)
const BOT_TOKEN = process.env.VITE_BOT_TOKEN

async function sendTG(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = req.headers['x-cron-secret'] || req.body?.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)

  try {
    // Find users who haven't posted in 3+ days
    const { data: allUsers } = await supabase
      .from('users')
      .select('id,name,telegram_id,role')
      .not('telegram_id', 'is', null)
      .eq('role', 'staff') // Only staff, not admins

    let reminded = 0

    for (const u of allUsers || []) {
      // Check last activity
      const { count } = await supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', u.id)
        .gte('created_at', threeDaysAgo.toISOString())

      // Also check comments
      const { count: commentCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id)
        .gte('created_at', threeDaysAgo.toISOString())

      if (count === 0 && commentCount === 0) {
        // Get their stats
        const { data: userStats } = await supabase
          .from('requests')
          .select('id', { count: 'exact' })
          .eq('author_id', u.id)

        await sendTG(u.telegram_id, `👋 *Привет, ${u.name}!*

Вы не заходили в Akkermann Pulse уже ${3}+ дня.

💡 За это время можно:
• Сообщить о замеченном риске
• Предложить идею по улучшению
• Прокомментировать заявки коллег

🎯 Выполните ежедневные задачи и получите бонусные баллы ТОП!

_Откройте приложение прямо сейчас_ 🚀`)
        reminded++
      }
    }

    return res.status(200).json({ ok: true, reminded })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
