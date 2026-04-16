import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import AdminDashboard from './AdminDashboard.jsx'
import AdminRequests from './AdminRequests.jsx'
import AdminUsers from './AdminUsers.jsx'
import AdminDepts from './AdminDepts.jsx'
import AdminNews from './AdminNews.jsx'
import AdminAchievements from './AdminAchievements.jsx'

const PAGES = [
  { id: 'dashboard', label: 'Дашборд', icon: '▦' },
  { id: 'requests',  label: 'Заявки',   icon: '📋', badge: true },
  { id: 'users',     label: 'Пользователи', icon: '👥' },
  { id: 'depts',     label: 'Участки',  icon: '🏭' },
  { id: 'news',      label: 'Новости',  icon: '📰' },
  { id: 'achievements', label: 'Достижения', icon: '🏅' },
]

export default function AdminLayout({ adminUser, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [requestBadge, setRequestBadge] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 640)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadBadge()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, () => loadBadge())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadBadge() {
    const { count } = await supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'new')
    setRequestBadge(count || 0)
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const isMobile = window.innerWidth <= 640

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Barlow', system-ui, sans-serif" }}>
      {/* Sidebar */}
      {(sidebarOpen || !isMobile) && (
        <aside style={{
          width: 230, background: 'var(--navy)', borderRight: '3px solid var(--red)',
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.12em', background: 'linear-gradient(135deg,#f53d2d,#c42b1c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: "'Barlow Condensed', sans-serif" }}>AKKERMANN</div>
            <div style={{ fontSize: 10, color: 'rgba(232,231,227,.5)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>PULSE · ADMIN</div>
          </div>

          <nav style={{ flex: 1, padding: '10px 8px' }}>
            {PAGES.map(({ id, label, icon, badge }) => (
              <button key={id} onClick={() => { setPage(id); if (isMobile) setSidebarOpen(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px',
                borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                color: page === id ? '#fff' : 'rgba(232,231,227,.6)',
                background: page === id ? 'var(--red)' : 'none',
                border: 'none', width: '100%', textAlign: 'left', marginBottom: 2,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.04em', textTransform: 'uppercase',
                transition: '.15s',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {badge && requestBadge > 0 && (
                  <span style={{ background: page === id ? 'rgba(255,255,255,.3)' : 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 2, minWidth: 16, textAlign: 'center' }}>
                    {requestBadge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ padding: '8px 12px', marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: '#e8e7e3', fontWeight: 700 }}>{adminUser.name}</div>
              <div style={{ fontSize: 10, color: 'rgba(232,231,227,.5)', textTransform: 'uppercase' }}>{adminUser.role}</div>
            </div>
            <button onClick={onLogout} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
              borderRadius: 3, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
              color: '#fca5a5', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%',
            }}>🚪 Выйти</button>
          </div>
        </aside>
      )}

      {/* Main */}
      <div style={{ marginLeft: !isMobile ? 230 : 0, flex: 1, minHeight: '100vh' }}>
        {/* Top bar */}
        <div style={{
          background: 'var(--navy)', borderBottom: '3px solid var(--red)',
          padding: '12px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 40, color: '#e8e7e3',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', color: '#e8e7e3', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>☰</button>
            )}
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {PAGES.find(p => p.id === page)?.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(232,231,227,.6)' }}>
            {new Date().toLocaleDateString('ru', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {page === 'dashboard'    && <AdminDashboard showToast={showToast} onPageChange={setPage} />}
          {page === 'requests'     && <AdminRequests adminUser={adminUser} showToast={showToast} onBadgeUpdate={loadBadge} />}
          {page === 'users'        && <AdminUsers adminUser={adminUser} showToast={showToast} />}
          {page === 'depts'        && <AdminDepts showToast={showToast} />}
          {page === 'news'         && <AdminNews adminUser={adminUser} showToast={showToast} />}
          {page === 'achievements' && <AdminAchievements showToast={showToast} />}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          background: 'var(--navy)', color: '#fff', padding: '10px 16px',
          borderRadius: 3, fontSize: 13, fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.04em',
          borderLeft: '3px solid var(--red)', boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          animation: 'fadeIn .3s ease',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
