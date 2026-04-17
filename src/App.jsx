import React, { useState, useEffect } from 'react'
import { supabase, store, lvlInfo, LEVELS } from './lib/supabase.js'
import SplashScreen from './components/common/SplashScreen.jsx'
import Registration from './components/common/Registration.jsx'
import MainApp from './components/MainApp.jsx'

export default function App() {
  const [screen, setScreen] = useState('splash')
  const [user, setUser] = useState(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Apply dark mode
    const dark = store.get('dark') === '1'
    setIsDark(dark)
    if (dark) document.documentElement.classList.add('dark')

    // Init Telegram WebApp
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()

      // Tell Telegram we handle safe areas ourselves
      if (tg.setHeaderColor) tg.setHeaderColor('#0f1c2c')
      if (tg.setBackgroundColor) tg.setBackgroundColor('#e8e7e3')

      // Disable Telegram's own back button behavior
      if (tg.BackButton) tg.BackButton.hide()

      // Apply Telegram viewport height
      const applyHeight = () => {
        const vh = tg.viewportStableHeight || window.innerHeight
        document.documentElement.style.setProperty('--tg-height', `${vh}px`)
      }
      applyHeight()
      tg.onEvent('viewportChanged', applyHeight)
    }

    // Set CSS variable for safe areas
    const updateSafeAreas = () => {
      // Force recalc of env() variables
      document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)')
      document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)')
    }
    updateSafeAreas()
    window.addEventListener('resize', updateSafeAreas)

    // Try to restore user from cache
    const cached = store.get('u')
    if (cached) {
      try {
        const u = JSON.parse(cached)
        if (u?.empId) {
          setUser(u)
          setScreen('app')
          refreshUser(u.empId)
          return
        }
      } catch {}
    }

    if (tg?.initDataUnsafe?.user) {
      checkTelegramUser(tg.initDataUnsafe.user)
    } else {
      setTimeout(() => setScreen('reg'), 1500)
    }

    return () => window.removeEventListener('resize', updateSafeAreas)
  }, [])

  async function checkTelegramUser(tgUser) {
    try {
      const { data } = await supabase.from('users').select('*').eq('telegram_id', String(tgUser.id)).single()
      if (data) {
        const u = mapUser(data)
        store.set('u', JSON.stringify(u))
        setUser(u)
        setScreen('app')
        supabase.from('users').update({
          telegram_username: tgUser.username,
          telegram_first_name: tgUser.first_name,
        }).eq('id', data.id)
      } else {
        setScreen('reg')
      }
    } catch { setScreen('reg') }
  }

  async function refreshUser(empId) {
    try {
      const { data } = await supabase.from('users').select('*').eq('id', empId).single()
      if (data) { const u = mapUser(data); store.set('u', JSON.stringify(u)); setUser(u) }
    } catch {}
  }

  function mapUser(data) {
    return {
      empId: data.id, name: data.name, department: data.department,
      role: data.role || 'staff', points: data.points || 0,
      phone: data.phone, email: data.email,
      telegramId: data.telegram_id, telegramUsername: data.telegram_username,
      profilePic: data.profile_pic, isTrained: data.is_trained,
      completedAchievements: data.completed_achievements || [],
      referredBy: data.referred_by,
    }
  }

  async function handleRegister(formData) {
    const tg = window.Telegram?.WebApp
    const tgUser = tg?.initDataUnsafe?.user
    const userData = {
      id: formData.empId, name: formData.name, phone: formData.phone,
      email: formData.email, department: formData.department,
      role: 'staff', points: 0,
      telegram_id: tgUser ? String(tgUser.id) : null,
      telegram_username: tgUser?.username || null,
      is_trained: false, completed_achievements: [],
      referred_by: formData.refCode ? formData.refCode.replace('REF_', '') : null,
    }
    const { data, error } = await supabase.from('users').upsert(userData, { onConflict: 'id' }).select().single()
    if (error) throw error
    if (formData.refCode) {
      const referrerId = formData.refCode.replace('REF_', '')
      if (referrerId && referrerId !== formData.empId) {
        const { data: ref } = await supabase.from('users').select('points').eq('id', referrerId).single()
        if (ref) await supabase.from('users').update({ points: (ref.points || 0) + 50 }).eq('id', referrerId)
      }
    }
    const u = mapUser(data)
    store.set('u', JSON.stringify(u))
    setUser(u)
    setScreen('app')
  }

  function toggleDark() {
    const next = !isDark; setIsDark(next)
    store.set('dark', next ? '1' : '0')
    document.documentElement.classList.toggle('dark', next)
  }

  function updateUser(updates) {
    setUser(prev => {
      const next = { ...prev, ...updates }
      store.set('u', JSON.stringify(next))
      return next
    })
  }

  if (screen === 'splash') return <SplashScreen />
  if (screen === 'reg') return <Registration onRegister={handleRegister} />
  return (
    <MainApp user={user} updateUser={updateUser} isDark={isDark} toggleDark={toggleDark}
      onLogout={() => { store.del('u'); setUser(null); setScreen('reg') }} />
  )
}
