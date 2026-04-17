import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import BottomNav from './common/BottomNav.jsx'
import FeedSection from './feed/FeedSection.jsx'
import NotifSection from './feed/NotifSection.jsx'
import NewsSection from './feed/NewsSection.jsx'
import ProfileSection from './profile/ProfileSection.jsx'
import CreateModal from './feed/CreateModal.jsx'
import DailyTasks from './common/DailyTasks.jsx'
import Toast from './common/Toast.jsx'

export default function MainApp({ user, updateUser, isDark, toggleDark, onLogout }) {
  const [section, setSection] = useState('feed')
  const [notifBadge, setNotifBadge] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [showDailyTasks, setShowDailyTasks] = useState(false)
  const [toast, setToast] = useState(null)
  const [profileBadge, setProfileBadge] = useState(false)
  const [dailyDone, setDailyDone] = useState(false)

  useEffect(() => {
    if (!user) return
    loadNotifBadge()

    // Показываем ежедневные задачи один раз в день
    const todayKey = `daily_shown_${user.empId}_${new Date().toDateString()}`
    if (!localStorage.getItem(todayKey)) {
      setTimeout(() => {
        setShowDailyTasks(true)
        localStorage.setItem(todayKey, '1')
      }, 2000)
    }

    // Проверяем выполнены ли задачи
    const doneKey = `daily_${user.empId}_${new Date().toDateString()}`
    const done = JSON.parse(localStorage.getItem(doneKey) || '[]')
    setDailyDone(done.length >= 5)

    const channel = supabase.channel('rt-notifs')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.empId}`
      }, () => loadNotifBadge())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.empId])

  async function loadNotifBadge() {
    if (!user) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.empId)
      .eq('read', false)
    setNotifBadge(count || 0)
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  function checkDailyDone() {
    const doneKey = `daily_${user.empId}_${new Date().toDateString()}`
    const done = JSON.parse(localStorage.getItem(doneKey) || '[]')
    setDailyDone(done.length >= 5)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        {section === 'feed' && (
          <FeedSection user={user} showToast={showToast} updateUser={updateUser} />
        )}
        {section === 'notif' && (
          <NotifSection user={user} onBadgeUpdate={setNotifBadge} showToast={showToast} goToFeed={() => setSection('feed')} />
        )}
        {section === 'news' && (
          <NewsSection user={user} showToast={showToast} />
        )}
        {section === 'profile' && (
          <ProfileSection
            user={user} updateUser={updateUser}
            isDark={isDark} toggleDark={toggleDark}
            onLogout={onLogout} showToast={showToast}
            clearProfileBadge={() => setProfileBadge(false)}
            onShowDailyTasks={() => setShowDailyTasks(true)}
            dailyDone={dailyDone}
          />
        )}
      </div>

      <BottomNav
        section={section} onSection={setSection}
        onCreate={() => setShowCreate(true)}
        notifBadge={notifBadge}
        profileBadge={profileBadge}
      />

      {showCreate && (
        <CreateModal user={user} onClose={() => setShowCreate(false)}
          onSuccess={(msg) => { showToast(msg, 'success'); setShowCreate(false) }}
          showToast={showToast} />
      )}

      {showDailyTasks && (
        <DailyTasks
          user={user} updateUser={updateUser}
          showToast={showToast}
          onClose={() => { setShowDailyTasks(false); checkDailyDone() }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
