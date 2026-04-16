import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, store, lvlInfo, LEVELS } from './lib/supabase.js'
import SplashScreen from './components/common/SplashScreen.jsx'
import Registration from './components/common/Registration.jsx'
import MainApp from './components/MainApp.jsx'

export default function App() {
  const [screen, setScreen] = useState('splash') // 'splash' | 'reg' | 'app'
  const [user, setUser] = useState(null)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const dark = store.get('dark') === '1'
    setIsDark(dark)
    if (dark) document.documentElement.classList.add('dark')

    // Try to restore user from cache
    const cached = store.get('u')
    if (cached) {
      try {
        const u = JSON.parse(cached)
        if (u?.empId) {
          setUser(u)
          setScreen('app')
          // Refresh from DB in background
          refreshUser(u.empId)
          return
        }
      } catch {}
    }

    // Check Telegram WebApp
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.user) {
      tg.ready()
      tg.expand()
      checkTelegramUser(tg.initDataUnsafe.user)
    } else {
      // Show registration after splash
      setTimeout(() => setScreen('reg'), 1500)
    }
  }, [])

  async function checkTelegramUser(tgUser) {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', String(tgUser.id))
        .single()
      
      if (data) {
        const u = mapUser(data)
        store.set('u', JSON.stringify(u))
        setUser(u)
        setScreen('app')
        // Update telegram info
        supabase.from('users').update({
          telegram_username: tgUser.username,
          telegram_first_name: tgUser.first_name,
        }).eq('id', data.id)
      } else {
        setScreen('reg')
      }
    } catch {
      setScreen('reg')
    }
  }

  async function refreshUser(empId) {
    try {
      const { data } = await supabase.from('users').select('*').eq('id', empId).single()
      if (data) {
        const u = mapUser(data)
        store.set('u', JSON.stringify(u))
        setUser(u)
      }
    } catch {}
  }

  function mapUser(data) {
    return {
      empId: data.id,
      name: data.name,
      department: data.department,
      role: data.role || 'staff',
      points: data.points || 0,
      phone: data.phone,
      email: data.email,
      telegramId: data.telegram_id,
      telegramUsername: data.telegram_username,
      profilePic: data.profile_pic,
      isTrained: data.is_trained,
      completedAchievements: data.completed_achievements || [],
      referredBy: data.referred_by,
      notifCount: 0,
    }
  }

  async function handleRegister(formData) {
    // Called from Registration component
    const tg = window.Telegram?.WebApp
    const tgUser = tg?.initDataUnsafe?.user

    const userData = {
      id: formData.empId,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      department: formData.department,
      role: 'staff',
      points: 0,
      telegram_id: tgUser ? String(tgUser.id) : null,
      telegram_username: tgUser?.username || null,
      is_trained: false,
      completed_achievements: [],
      referred_by: formData.refCode ? formData.refCode.replace('REF_', '') : null,
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw error

    // Handle referral bonus
    if (formData.refCode) {
      const referrerId = formData.refCode.replace('REF_', '')
      if (referrerId && referrerId !== formData.empId) {
        const { data: referrer } = await supabase.from('users').select('points').eq('id', referrerId).single()
        if (referrer) {
          await supabase.from('users').update({ points: (referrer.points || 0) + 50 }).eq('id', referrerId)
        }
      }
    }

    const u = mapUser(data)
    store.set('u', JSON.stringify(u))
    setUser(u)
    setScreen('app')
  }

  function toggleDark() {
    const next = !isDark
    setIsDark(next)
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
    <MainApp
      user={user}
      updateUser={updateUser}
      isDark={isDark}
      toggleDark={toggleDark}
      onLogout={() => { store.del('u'); setUser(null); setScreen('reg') }}
    />
  )
}
