// ============================================================
// TELEGRAM УВЕДОМЛЕНИЯ — клиентская функция
// Вызывает наш Vercel API Route
// ============================================================

/**
 * Отправить Telegram уведомление пользователю
 * @param {string} telegramId - Telegram chat_id пользователя
 * @param {string} title - Заголовок уведомления
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип: status_update | comment | risk1 | achievement | news | deadline
 */
export async function sendTelegramNotif(telegramId, title, message, type = 'system') {
  if (!telegramId) return { ok: false, error: 'No telegram_id' }

  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: telegramId, title, message, type }),
    })
    return await res.json()
  } catch (err) {
    console.warn('Telegram notify failed:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Отправить уведомление пользователю по его ID в БД
 * Сначала загружает telegram_id из Supabase, потом шлёт
 */
export async function notifyUser(supabase, userId, title, message, type = 'system') {
  if (!userId) return

  try {
    // 1. Сохраняем в БД (для in-app уведомлений)
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      read: false,
      date: new Date().toISOString(),
    })

    // 2. Получаем telegram_id
    const { data: user } = await supabase
      .from('users')
      .select('telegram_id')
      .eq('id', userId)
      .single()

    // 3. Шлём в Telegram если есть
    if (user?.telegram_id) {
      await sendTelegramNotif(user.telegram_id, title, message, type)
    }
  } catch (err) {
    console.warn('notifyUser error:', err.message)
  }
}

/**
 * Отправить уведомление всем пользователям с определённой ролью
 */
export async function notifyRole(supabase, roles, title, message, type = 'news') {
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id')
      .in('role', roles)

    if (!users?.length) return

    // Сохраняем в БД всем
    await supabase.from('notifications').insert(
      users.map(u => ({
        user_id: u.id, title, message, type,
        read: false, date: new Date().toISOString(),
      }))
    )

    // Шлём в Telegram тем у кого есть
    const withTg = users.filter(u => u.telegram_id)
    await Promise.allSettled(
      withTg.map(u => sendTelegramNotif(u.telegram_id, title, message, type))
    )
  } catch (err) {
    console.warn('notifyRole error:', err.message)
  }
}

/**
 * Уведомить всех о новой новости
 */
export async function notifyNews(supabase, news, targetDept = null) {
  try {
    let query = supabase.from('users').select('id, telegram_id, department')
    if (targetDept) query = query.eq('department', targetDept)
    const { data: users } = await query

    if (!users?.length) return 0

    await supabase.from('notifications').insert(
      users.map(u => ({
        user_id: u.id,
        title: `📢 ${news.title}`,
        message: news.content.slice(0, 100) + (news.content.length > 100 ? '…' : ''),
        type: 'news', read: false, date: new Date().toISOString(),
      }))
    )

    const withTg = users.filter(u => u.telegram_id)
    await Promise.allSettled(
      withTg.map(u => sendTelegramNotif(u.telegram_id, `📢 ${news.title}`, news.content.slice(0, 200), 'news'))
    )

    return users.length
  } catch (err) {
    console.warn('notifyNews error:', err.message)
    return 0
  }
}
