import React, { useState, useEffect, useCallback } from 'react'
import { supabase, pad } from '../lib/supabase.js'
import BottomNav from './common/BottomNav.jsx'
import FeedSection from './feed/FeedSection.jsx'
import NotifSection from './feed/NotifSection.jsx'
import NewsSection from './feed/NewsSection.jsx'
import ProfileSection from './profile/ProfileSection.jsx'
import CreateModal from './feed/CreateModal.jsx'
import Toast from './common/Toast.jsx'

export default function MainApp({ user, updateUser, isDark, toggleDark, onLogout }) {
  const [section, setSection] = useState('feed')
  const [notifBadge, setNotifBadge] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState(null)
  const [profileBadge, setProfileBadge] = useState(false)

  // Realtime notifications
  useEffect(() => {
    if (!user) return
    loadNotifBadge()
    const channel = supabase.channel('rt-notifs')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.empId}`
      }, () => {
        loadNotifBadge()
      })
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Scrollable content */}
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
            user={user}
            updateUser={updateUser}
            isDark={isDark}
            toggleDark={toggleDark}
            onLogout={onLogout}
            showToast={showToast}
            clearProfileBadge={() => setProfileBadge(false)}
          />
        )}
      </div>

      {/* Bottom Nav */}
      <BottomNav
        section={section}
        onSection={setSection}
        onCreate={() => setShowCreate(true)}
        notifBadge={notifBadge}
        profileBadge={profileBadge}
      />

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          user={user}
          onClose={() => setShowCreate(false)}
          onSuccess={(msg) => { showToast(msg, 'success'); setShowCreate(false) }}
          showToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  )
}
