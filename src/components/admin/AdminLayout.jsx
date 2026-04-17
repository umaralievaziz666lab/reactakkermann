import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { can, roleIcon, roleColor, ROLES } from '../../lib/permissions.js'
import AdminDashboard from './AdminDashboard.jsx'
import AdminRequests from './AdminRequests.jsx'
import AdminUsers from './AdminUsers.jsx'
import AdminDepts from './AdminDepts.jsx'
import AdminNews from './AdminNews.jsx'
import AdminAchievements from './AdminAchievements.jsx'
import DeadlineCalendar from './DeadlineCalendar.jsx'

export default function AdminLayout({ adminUser, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [requestBadge, setRequestBadge] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [toast, setToast] = useState(null)

  const role = adminUser?.role || 'staff'

  // Build pages based on role
  const ALL_PAGES = [
    { id: 'dashboard',    label: 'Дашборд',      icon: '▦',  permission: null },
    { id: 'requests',     label: 'Заявки',        icon: '📋', permission: null, badge: true },
    { id: 'users',        label: 'Пользователи',  icon: '👥', permission: 'manage_users' },
    { id: 'depts',        label: 'Участки',       icon: '🏭', permission: 'manage_departments' },
    { id: 'news',         label: 'Новости',       icon: '📰', permission: 'publish_news' },
    { id: 'achievements', label: 'Достижения',    icon: '🏅', permission: 'manage_achievements' },
  { id: 'calendar',     label: 'Дедлайны',      icon: '📅', permission: null },
  ]

  const pages = ALL_PAGES.filter(p => !p.permission || can(role, p.permission))

  useEffect(() => {
    loadBadge()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'requests' }, () => loadBadge())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadBadge() {
    const { count } = await supabase.from('requests').select('*', { count:'exact', head:true }).eq('status','new')
    setRequestBadge(count || 0)
  }

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const isMobile = window.innerWidth <= 768
  const rColor = roleColor(role)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#e8e7e3' }}>

      {/* Sidebar */}
      {(sidebarOpen || !isMobile) && (
        <>
          {/* Overlay for mobile */}
          {isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:49 }} />}

          <aside style={{
            width:230, background:'#0f1c2c', borderRight:'3px solid #f53d2d',
            position:'fixed', top:0, left:0, bottom:0, zIndex:50,
            display:'flex', flexDirection:'column', overflowY:'auto',
            transition:'transform .25s',
          }}>
            {/* Logo */}
            <div style={{ padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize:15, fontWeight:800, letterSpacing:'.12em', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontFamily:"'Barlow Condensed',sans-serif" }}>AKKERMANN</div>
              <div style={{ fontSize:10, color:'rgba(232,231,227,.4)', letterSpacing:'.1em', textTransform:'uppercase', fontFamily:"'Barlow Condensed',sans-serif" }}>PULSE · ADMIN</div>
            </div>

            {/* Role badge */}
            <div style={{ padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, background:'rgba(255,255,255,.04)', border:`1px solid ${rColor}33` }}>
                <span style={{ fontSize:18 }}>{roleIcon(role)}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#e8e7e3' }}>{adminUser.name}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:rColor, textTransform:'uppercase', letterSpacing:'.04em' }}>{ROLES[role]||role}</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex:1, padding:'10px 8px' }}>
              {pages.map(({ id, label, icon, badge }) => (
                <button key={id} onClick={() => { setPage(id); if(isMobile) setSidebarOpen(false) }} style={{
                  display:'flex', alignItems:'center', gap:9, padding:'9px 12px',
                  borderRadius:3, cursor:'pointer', fontSize:13, fontWeight:700,
                  color: page===id ? '#fff' : 'rgba(232,231,227,.55)',
                  background: page===id ? '#f53d2d' : 'none',
                  border:'none', width:'100%', textAlign:'left', marginBottom:2,
                  fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em', textTransform:'uppercase',
                  transition:'.15s',
                }}>
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <span style={{ flex:1 }}>{label}</span>
                  {badge && requestBadge > 0 && (
                    <span style={{ background:page===id?'rgba(255,255,255,.3)':'#f53d2d', color:'#fff', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:2, minWidth:16, textAlign:'center' }}>
                      {requestBadge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom */}
            <div style={{ padding:'10px 8px', borderTop:'1px solid rgba(255,255,255,.08)' }}>
              <button onClick={onLogout} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:3, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)', color:'#fca5a5', fontSize:12, fontWeight:700, cursor:'pointer', width:'100%', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em' }}>
                🚪 ВЫЙТИ
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main */}
      <div style={{ marginLeft: !isMobile ? 230 : 0, flex:1, minHeight:'100vh', transition:'margin .25s' }}>
        {/* Top bar */}
        <div style={{ background:'#0f1c2c', borderBottom:'3px solid #f53d2d', padding:'0 22px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background:'none', border:'none', color:'#e8e7e3', fontSize:22, cursor:'pointer', lineHeight:1 }}>☰</button>
            )}
            <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.08em', textTransform:'uppercase' }}>
              {pages.find(p => p.id === page)?.icon} {pages.find(p => p.id === page)?.label}
            </span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Role pill in topbar */}
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:3, background:`${rColor}22`, color:rColor, border:`1px solid ${rColor}44`, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em' }}>
              {roleIcon(role)} {ROLES[role]||role}
            </span>
            <span style={{ fontSize:11, color:'rgba(232,231,227,.4)' }}>
              {new Date().toLocaleDateString('ru', { day:'2-digit', month:'short', year:'numeric' })}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:20 }}>
          {page === 'dashboard' && <AdminDashboard showToast={showToast} onPageChange={setPage} adminUser={adminUser} />}
          {page === 'requests'     && <AdminRequests adminUser={adminUser} showToast={showToast} onBadgeUpdate={loadBadge} />}
          {page === 'users'        && can(role,'manage_users')        && <AdminUsers adminUser={adminUser} showToast={showToast} />}
          {page === 'depts'        && can(role,'manage_departments')  && <AdminDepts showToast={showToast} />}
          {page === 'news'         && can(role,'publish_news')        && <AdminNews adminUser={adminUser} showToast={showToast} />}
          {page === 'achievements' && can(role,'manage_achievements') && <AdminAchievements showToast={showToast} /> }
          {page === 'calendar' && <DeadlineCalendar showToast={showToast} />}

          {/* Access denied */}
          {page !== 'dashboard' && page !== 'requests' && !pages.find(p => p.id === page) && (
            <div style={{ textAlign:'center', padding:'80px 20px' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🔒</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#0f1c2c', marginBottom:8 }}>Нет доступа</div>
              <div style={{ fontSize:14, color:'#5a7080' }}>Ваша роль <strong>{ROLES[role]}</strong> не имеет доступа к этому разделу</div>
              <button onClick={() => setPage('dashboard')} style={{ marginTop:20, padding:'10px 24px', borderRadius:3, border:'none', background:'#f53d2d', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                На дашборд
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:20, right:20, zIndex:9999,
          background: toast.type==='error' ? '#dc2626' : toast.type==='success' ? '#16a34a' : '#0f1c2c',
          color:'#fff', padding:'10px 16px', borderRadius:3,
          fontSize:13, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em',
          borderLeft:`3px solid ${toast.type==='error'?'#ef4444':toast.type==='success'?'#22c55e':'#f53d2d'}`,
          boxShadow:'0 4px 20px rgba(0,0,0,.3)', animation:'fadeIn .3s ease',
          maxWidth:320,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
