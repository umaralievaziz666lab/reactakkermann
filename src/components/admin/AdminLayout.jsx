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
import AdminBell from './AdminBell.jsx'

const ALL_PAGES = [
  { id:'dashboard',    label:'Дашборд',      icon:'▦',  permission:null },
  { id:'requests',     label:'Заявки',        icon:'📋', permission:null, badge:true },
  { id:'users',        label:'Пользователи',  icon:'👥', permission:'manage_users' },
  { id:'depts',        label:'Участки',       icon:'🏭', permission:'manage_departments' },
  { id:'news',         label:'Новости',       icon:'📰', permission:'publish_news' },
  { id:'achievements', label:'Достижения',    icon:'🏅', permission:'manage_achievements' },
  { id:'calendar',     label:'Дедлайны',      icon:'📅', permission:null },
]

export default function AdminLayout({ adminUser, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [requestBadge, setRequestBadge] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [bellRequestId, setBellRequestId] = useState(null)
  const [toast, setToast] = useState(null)

  const role = adminUser?.role || 'staff'
  const pages = ALL_PAGES.filter(p => !p.permission || can(role, p.permission))
  const isMobile = window.innerWidth <= 768

  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
    loadBadge()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'requests' }, () => loadBadge())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadBadge() {
    const { count } = await supabase.from('requests').select('*',{count:'exact',head:true}).eq('status','new')
    setRequestBadge(count || 0)
  }

  function showToast(msg, type='info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const rColor = roleColor(role)
  const sideW = collapsed ? 60 : 230

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#e8e7e3' }}>

      {/* ── SIDEBAR ── */}
      {(sidebarOpen || !isMobile) && (
        <>
          {isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:49 }} />}
          <aside style={{
            width: sideW, background:'#0f1c2c', borderRight:'3px solid #f53d2d',
            position:'fixed', top:0, left:0, bottom:0, zIndex:50,
            display:'flex', flexDirection:'column', overflowY:'auto',
            transition:'width .25s ease', overflowX:'hidden',
          }}>
            {/* Logo + collapse button */}
            <div style={{ padding:'12px 10px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:60, flexShrink:0 }}>
              {!collapsed && (
                <div style={{ overflow:'hidden' }}>
                  <div style={{ fontSize:14, fontWeight:800, letterSpacing:'.1em', background:'linear-gradient(135deg,#f53d2d,#c42b1c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontFamily:"'Barlow Condensed',sans-serif", whiteSpace:'nowrap' }}>AKKERMANN</div>
                  <div style={{ fontSize:9, color:'rgba(232,231,227,.4)', letterSpacing:'.1em', textTransform:'uppercase', fontFamily:"'Barlow Condensed',sans-serif", whiteSpace:'nowrap' }}>PULSE · ADMIN</div>
                </div>
              )}
              <button
                onClick={() => setCollapsed(c => !c)}
                title={collapsed ? 'Раскрыть панель' : 'Свернуть панель'}
                style={{
                  background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)',
                  borderRadius:6, width:28, height:28, cursor:'pointer',
                  color:'rgba(232,231,227,.8)', fontSize:14, display:'flex',
                  alignItems:'center', justifyContent:'center', flexShrink:0,
                  transition:'background .15s',
                }}
                onMouseOver={e => e.currentTarget.style.background='rgba(245,61,45,.3)'}
                onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,.1)'}
              >
                {collapsed ? '›' : '‹'}
              </button>
            </div>

            {/* Role badge */}
            {!collapsed && (
              <div style={{ padding:'10px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, background:'rgba(255,255,255,.04)', border:`1px solid ${rColor}33` }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{roleIcon(role)}</span>
                  <div style={{ minWidth:0, overflow:'hidden' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#e8e7e3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{adminUser.name}</div>
                    <div style={{ fontSize:10, fontWeight:700, color:rColor, textTransform:'uppercase', letterSpacing:'.04em' }}>{ROLES[role]||role}</div>
                  </div>
                </div>
              </div>
            )}
            {collapsed && (
              <div style={{ padding:'10px 6px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', justifyContent:'center', flexShrink:0 }}>
                <div title={adminUser.name} style={{ width:38, height:38, borderRadius:'50%', background:`${rColor}33`, border:`2px solid ${rColor}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{roleIcon(role)}</div>
              </div>
            )}

            {/* Nav */}
            <nav style={{ flex:1, padding:'8px 6px' }}>
              {pages.map(({ id, label, icon, badge }) => (
                <button key={id}
                  onClick={() => { setPage(id); if(isMobile) setSidebarOpen(false) }}
                  title={collapsed ? label : ''}
                  style={{
                    display:'flex', alignItems:'center', justifyContent: collapsed?'center':'flex-start',
                    gap: collapsed?0:8, padding: collapsed?'10px':'9px 10px',
                    borderRadius:6, cursor:'pointer', fontSize:13, fontWeight:700,
                    color: page===id ? '#fff' : 'rgba(232,231,227,.6)',
                    background: page===id ? '#f53d2d' : 'none',
                    border:'none', width:'100%', textAlign:'left', marginBottom:2,
                    fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em',
                    textTransform:'uppercase', transition:'all .15s',
                    position:'relative',
                  }}
                  onMouseOver={e => page!==id && (e.currentTarget.style.background='rgba(255,255,255,.08)')}
                  onMouseOut={e => page!==id && (e.currentTarget.style.background='none')}
                >
                  <span style={{ fontSize:18, flexShrink:0 }}>{icon}</span>
                  {!collapsed && <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>}
                  {badge && requestBadge > 0 && (
                    <span style={{
                      background: page===id?'rgba(255,255,255,.3)':'#f53d2d', color:'#fff',
                      fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:3,
                      minWidth:16, textAlign:'center', flexShrink:0,
                      position: collapsed?'absolute':'static', top:4, right:4,
                    }}>
                      {requestBadge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom */}
            <div style={{ padding:'8px 6px', borderTop:'1px solid rgba(255,255,255,.08)', flexShrink:0 }}>
              <button onClick={onLogout} title={collapsed?'Выйти':''} style={{
                display:'flex', alignItems:'center', justifyContent: collapsed?'center':'flex-start',
                gap:8, padding: collapsed?'10px':'8px 10px',
                borderRadius:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.2)',
                color:'#fca5a5', fontSize:12, fontWeight:700, cursor:'pointer', width:'100%',
                fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em', transition:'.15s',
              }}>
                <span>🚪</span>
                {!collapsed && <span>ВЫЙТИ</span>}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ── MAIN ── */}
      <div style={{ marginLeft: !isMobile ? sideW : 0, flex:1, minHeight:'100vh', display:'flex', flexDirection:'column', transition:'margin .25s ease' }}>

        {/* Topbar */}
        <div style={{ background:'#0f1c2c', borderBottom:'3px solid #f53d2d', padding:'0 16px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background:'none', border:'none', color:'#e8e7e3', fontSize:22, cursor:'pointer', lineHeight:1 }}>☰</button>
            )}
            <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.08em', textTransform:'uppercase' }}>
              {pages.find(p => p.id===page)?.icon} {pages.find(p => p.id===page)?.label}
            </span>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:3, background:`${rColor}22`, color:rColor, border:`1px solid ${rColor}44`, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em' }}>
              {roleIcon(role)} {ROLES[role]||role}
            </span>
            <span style={{ fontSize:11, color:'rgba(232,231,227,.4)' }}>
              {new Date().toLocaleDateString('ru', { day:'2-digit', month:'short', year:'numeric' })}
            </span>
            <AdminBell adminUser={adminUser} onOpenRequest={(id) => setBellRequestId(id)} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:20, flex:1, overflowY:'auto', overflowX:'hidden' }}>
          {page==='dashboard'    && <AdminDashboard showToast={showToast} onPageChange={setPage} adminUser={adminUser} />}
          {page==='requests'     && <AdminRequests adminUser={adminUser} showToast={showToast} onBadgeUpdate={loadBadge} />}
          {page==='users'        && can(role,'manage_users')        && <AdminUsers adminUser={adminUser} showToast={showToast} />}
          {page==='depts'        && can(role,'manage_departments')  && <AdminDepts showToast={showToast} />}
          {page==='news'         && can(role,'publish_news')        && <AdminNews adminUser={adminUser} showToast={showToast} />}
          {page==='achievements' && can(role,'manage_achievements') && <AdminAchievements showToast={showToast} />}
          {page==='calendar'     && <DeadlineCalendar showToast={showToast} />}

          {/* Access denied */}
          {!['dashboard','requests','calendar'].includes(page) && !pages.find(p=>p.id===page) && (
            <div style={{ textAlign:'center', padding:'80px 20px' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🔒</div>
              <div style={{ fontSize:20, fontWeight:800, color:'#0f1c2c', marginBottom:8 }}>Нет доступа</div>
              <div style={{ fontSize:14, color:'#5a7080' }}>Ваша роль <strong>{ROLES[role]}</strong> не имеет доступа к этому разделу</div>
              <button onClick={() => setPage('dashboard')} style={{ marginTop:20, padding:'10px 24px', borderRadius:3, border:'none', background:'#f53d2d', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>На дашборд</button>
            </div>
          )}
        </div>
      </div>

      {/* Bell request detail */}
      {bellRequestId && <BellRequestDetail requestId={bellRequestId} onClose={() => setBellRequestId(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', bottom:20, right:20, zIndex:9999,
          background: toast.type==='error'?'#dc2626':toast.type==='success'?'#16a34a':'#0f1c2c',
          color:'#fff', padding:'10px 16px', borderRadius:3, fontSize:13, fontWeight:700,
          fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:'.04em',
          borderLeft:`3px solid ${toast.type==='error'?'#ef4444':toast.type==='success'?'#22c55e':'#f53d2d'}`,
          boxShadow:'0 4px 20px rgba(0,0,0,.3)', animation:'fadeIn .3s ease', maxWidth:320,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ── BELL REQUEST DETAIL ───────────────────────────────────────────────────────
function BellRequestDetail({ requestId, onClose }) {
  const [req, setReq] = React.useState(null)
  const [loading, setReq2] = React.useState(true)

  React.useEffect(() => {
    supabase.from('requests').select('*').eq('id', requestId).single()
      .then(({ data }) => { setReq(data); setReq2(false) })
  }, [requestId])

  const parseJson = (v, d) => { if (!v) return d; if (Array.isArray(v)) return v; try { return JSON.parse(v) } catch { return d } }
  const STATUS = { new:{l:'Новая',c:'#6b7280'}, work:{l:'В работе',c:'#3b82f6'}, approved:{l:'Принята',c:'#22c55e'}, rejected:{l:'Отклонена',c:'#ef4444'}, completed:{l:'Выполнена',c:'#8b5cf6'} }
  const padId = id => '#'+String(id).padStart(5,'0')
  const fmtD = d => { try { return new Date(d).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) } catch { return '—' } }

  return (
    <div onClick={e => { if (e.target===e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="fade-in" style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:520, maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,.4)', border:'1px solid #d1cfc9' }}>
        <div style={{ padding:'12px 16px', background:'#0f1c2c', borderBottom:'2px solid #f53d2d', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:800, color:'#e8e7e3', fontFamily:"'Barlow Condensed',sans-serif" }}>
            {req ? `${padId(req.id)} — ДЕТАЛИ` : 'ЗАГРУЗКА…'}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(232,231,227,.7)', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:20 }}>
          {loading ? <div style={{ textAlign:'center', padding:40, color:'#8fa0ae' }}>Загрузка…</div>
          : req ? (
            <>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:req.type==='risk'?'#fff7ed':'#ecfdf5', color:req.type==='risk'?'#c2410c':'#059669' }}>
                  {req.type==='risk'?`⚠️ Риск${req.risk_urgency?` L${req.risk_urgency}`:''}` :'💡 Идея'}
                </span>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:99, background:`${(STATUS[req.status]||STATUS.new).c}18`, color:(STATUS[req.status]||STATUS.new).c }}>
                  {(STATUS[req.status]||STATUS.new).l}
                </span>
              </div>
              <div style={{ fontSize:14, color:'#0f1c2c', lineHeight:1.7, marginBottom:12, background:'#f2f1ee', padding:12, borderRadius:8 }}>{req.description}</div>
              <div style={{ fontSize:12, color:'#5a7080', marginBottom:8 }}>👤 {req.anonymous?'Аноним':req.author} · 📍 {req.location||'—'} · 🕐 {fmtD(req.date||req.created_at)}</div>
              {req.assigned_to && <div style={{ fontSize:12, color:'#3b82f6', marginBottom:8 }}>👷 {req.assigned_to}</div>}
              {req.deadline && <div style={{ fontSize:12, fontWeight:700, color:new Date(req.deadline)<new Date()?'#dc2626':'#5a7080', marginBottom:12 }}>⏰ {fmtD(req.deadline)}{new Date(req.deadline)<new Date()?' — ПРОСРОЧЕНО!':''}</div>}
              {req.admin_comment && (
                <div style={{ background:'rgba(245,61,45,.05)', border:'1px solid rgba(245,61,45,.2)', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#f53d2d', marginBottom:4 }}>💬 Комментарий</div>
                  <div style={{ fontSize:13, color:'#2a3f52' }}>{req.admin_comment}</div>
                </div>
              )}
              {parseJson(req.media,[]).length > 0 && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {parseJson(req.media,[]).map((m,i) => <img key={i} src={m} onClick={()=>window.open(m,'_blank')} style={{ width:80,height:80,objectFit:'cover',borderRadius:8,border:'1px solid #d1cfc9',cursor:'pointer' }} />)}
                </div>
              )}
            </>
          ) : <div style={{ textAlign:'center', padding:40, color:'#8fa0ae' }}>Заявка не найдена</div>}
        </div>
      </div>
    </div>
  )
}
