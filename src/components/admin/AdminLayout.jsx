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
import AdminShop from './AdminShop.jsx'

const ALL_PAGES = [
  { id:'dashboard',    label:'Дашборд',      icon:'⬛', permission:null },
  { id:'requests',     label:'Заявки',        icon:'📋', permission:null,              badge:true },
  { id:'shop',         label:'Магазин',       icon:'🏪', permission:null },
  { id:'users',        label:'Сотрудники',    icon:'👥', permission:'manage_users' },
  { id:'news',         label:'Новости',       icon:'📰', permission:'publish_news' },
  { id:'depts',        label:'Участки',       icon:'🏭', permission:'manage_departments' },
  { id:'achievements', label:'Достижения',    icon:'🏅', permission:'manage_achievements' },
  { id:'calendar',     label:'Дедлайны',      icon:'📅', permission:null },
]

export default function AdminLayout({ adminUser, onLogout }) {
  const [page, setPage] = useState('dashboard')
  const [badge, setBadge] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bellId, setBellId] = useState(null)
  const [toast, setToast] = useState(null)

  const role = adminUser?.role || 'staff'
  const pages = ALL_PAGES.filter(p => !p.permission || can(role, p.permission))
  const isMobile = window.innerWidth <= 900

  useEffect(() => {
    if (isMobile) setCollapsed(true)
    loadBadge()
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'requests' }, loadBadge)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function loadBadge() {
    const { count } = await supabase.from('requests').select('*',{count:'exact',head:true}).eq('status','new')
    setBadge(count || 0)
  }

  function showToast(msg, type='info') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  const rColor = roleColor(role)
  const sw = collapsed ? 60 : 240

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#F0EFE9', fontFamily:'var(--font-body)' }}>

      {/* ─── SIDEBAR ─── */}
      {(!isMobile || mobileOpen) && (
        <>
          {isMobile && mobileOpen && <div onClick={() => setMobileOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:49 }} />}
          <aside style={{
            width: sw,
            background: 'var(--navy)',
            borderRight: '2px solid rgba(232,50,31,.4)',
            display: 'flex', flexDirection: 'column',
            position: isMobile ? 'fixed' : 'relative',
            top: 0, left: 0, bottom: 0, zIndex: 50,
            transition: 'width .22s cubic-bezier(.4,0,.2,1)',
            overflowX: 'hidden', overflowY: 'auto',
            flexShrink: 0,
          }}>

            {/* Logo */}
            <div style={{ padding:'16px 10px 12px', borderBottom:'1px solid rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent: collapsed?'center':'space-between', flexShrink:0 }}>
              {!collapsed && (
                <div style={{ overflow:'hidden' }}>
                  <div style={{ fontSize:18, fontFamily:'var(--font-display)', letterSpacing:'.15em', color:'#EEEAE0', whiteSpace:'nowrap' }}>
                    AKKERMANN
                  </div>
                  <div style={{ fontSize:9, fontFamily:'var(--font-display)', letterSpacing:'.25em', color:'var(--red)', whiteSpace:'nowrap' }}>
                    PULSE · ADMIN
                  </div>
                </div>
              )}
              <button onClick={() => setCollapsed(c=>!c)} title={collapsed?'Раскрыть':'Свернуть'} style={{
                width:28, height:28, borderRadius:7, background:'rgba(255,255,255,.08)',
                border:'1px solid rgba(255,255,255,.12)', color:'rgba(232,231,227,.7)',
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:14, flexShrink:0, transition:'background .15s',
              }}
                onMouseOver={e=>e.currentTarget.style.background='rgba(232,50,31,.25)'}
                onMouseOut={e=>e.currentTarget.style.background='rgba(255,255,255,.08)'}
              >{collapsed ? '›' : '‹'}</button>
            </div>

            {/* User pill */}
            <div style={{ padding:'10px 8px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:collapsed?'center':'flex-start',
                gap:9, padding:'8px 10px', borderRadius:10,
                background:'rgba(255,255,255,.05)', border:`1px solid ${rColor}30`,
              }}>
                <div style={{ width:32, height:32, borderRadius:9, background:`${rColor}25`, border:`1.5px solid ${rColor}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                  {roleIcon(role)}
                </div>
                {!collapsed && (
                  <div style={{ overflow:'hidden' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#EEEAE0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{adminUser.name}</div>
                    <div style={{ fontSize:10, fontFamily:'var(--font-display)', letterSpacing:'.06em', color:rColor, textTransform:'uppercase' }}>{ROLES[role]||role}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex:1, padding:'8px 6px', display:'flex', flexDirection:'column', gap:2 }}>
              {pages.map(({ id, label, icon, badge:hasBadge }) => {
                const active = page === id
                return (
                  <button key={id} onClick={() => { setPage(id); if(isMobile) setMobileOpen(false) }}
                    title={collapsed ? label : ''}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:collapsed?'center':'flex-start',
                      gap:9, padding:collapsed?'10px':'9px 12px',
                      borderRadius:9, cursor:'pointer', fontSize:12,
                      fontFamily:'var(--font-display)', letterSpacing:'.06em', textTransform:'uppercase',
                      color: active ? '#fff' : 'rgba(232,231,227,.5)',
                      background: active ? 'linear-gradient(135deg,var(--red),var(--red2))' : 'none',
                      boxShadow: active ? '0 3px 12px rgba(232,50,31,.35)' : 'none',
                      border:'none', width:'100%', textAlign:'left',
                      transition:'all .15s', position:'relative',
                    }}
                    onMouseOver={e => !active && (e.currentTarget.style.background='rgba(255,255,255,.07)')}
                    onMouseOut={e => !active && (e.currentTarget.style.background='none')}
                  >
                    <span style={{ fontSize:17, flexShrink:0 }}>{icon}</span>
                    {!collapsed && <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>}
                    {hasBadge && badge > 0 && (
                      <span style={{
                        background:'var(--red)', color:'#fff', fontSize:9, fontWeight:700,
                        padding:'1px 5px', borderRadius:99, minWidth:16, textAlign:'center', flexShrink:0,
                        position:collapsed?'absolute':'static', top:3, right:3,
                      }}>{badge}</span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Logout */}
            <div style={{ padding:'8px 6px', borderTop:'1px solid rgba(255,255,255,.07)', flexShrink:0 }}>
              <button onClick={onLogout} title={collapsed?'Выйти':''} style={{
                display:'flex', alignItems:'center', justifyContent:collapsed?'center':'flex-start',
                gap:9, padding:collapsed?'10px':'9px 12px',
                borderRadius:9, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)',
                color:'#fca5a5', fontSize:12, cursor:'pointer', width:'100%',
                fontFamily:'var(--font-display)', letterSpacing:'.06em', transition:'.15s',
              }}>
                <span>🚪</span>{!collapsed && 'ВЫЙТИ'}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ─── MAIN ─── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Topbar */}
        <header style={{
          height: 54, flexShrink:0,
          background: 'var(--navy)',
          borderBottom: '2px solid var(--red)',
          display: 'flex', alignItems: 'center',
          padding: '0 18px', gap: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        }}>
          {isMobile && (
            <button onClick={() => setMobileOpen(true)} style={{ background:'none', border:'none', color:'rgba(232,231,227,.7)', fontSize:22, cursor:'pointer', lineHeight:1, padding:0 }}>☰</button>
          )}

          {/* Breadcrumb */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'rgba(232,231,227,.3)', fontFamily:'var(--font-display)', letterSpacing:'.08em' }}>ADMIN</span>
            <span style={{ color:'rgba(232,231,227,.2)' }}>/</span>
            <span style={{ fontSize:14, fontFamily:'var(--font-display)', letterSpacing:'.08em', color:'#EEEAE0' }}>
              {pages.find(p=>p.id===page)?.label || 'Dashboard'}
            </span>
          </div>

          <div style={{ flex:1 }} />

          {/* Right side */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:10, color:'rgba(232,231,227,.3)' }}>
              {new Date().toLocaleDateString('ru',{day:'2-digit',month:'short',year:'numeric'})}
            </span>
            <AdminBell adminUser={adminUser} onOpenRequest={id => setBellId(id)} />
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:20, height:'calc(100vh - 54px)' }}>
          {page==='dashboard'    && <AdminDashboard showToast={showToast} onPageChange={setPage} adminUser={adminUser} />}
          {page==='requests'     && <AdminRequests adminUser={adminUser} showToast={showToast} onBadgeUpdate={loadBadge} />}
          {page==='shop'         && <AdminShop adminUser={adminUser} showToast={showToast} />}
          {page==='users'        && can(role,'manage_users')        && <AdminUsers adminUser={adminUser} showToast={showToast} />}
          {page==='news'         && can(role,'publish_news')        && <AdminNews adminUser={adminUser} showToast={showToast} />}
          {page==='depts'        && can(role,'manage_departments')  && <AdminDepts showToast={showToast} />}
          {page==='achievements' && can(role,'manage_achievements') && <AdminAchievements showToast={showToast} />}
          {page==='calendar'     && <DeadlineCalendar showToast={showToast} />}
          {!['dashboard','requests','shop','calendar'].includes(page) && !pages.find(p=>p.id===page) && (
            <div style={{ textAlign:'center', padding:'80px 20px' }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🔒</div>
              <div style={{ fontSize:28, fontFamily:'var(--font-display)', letterSpacing:'.1em', color:'var(--t1)', marginBottom:8 }}>НЕТ ДОСТУПА</div>
              <div style={{ fontSize:14, color:'var(--t3)' }}>Ваша роль <strong>{ROLES[role]}</strong> не имеет доступа к этому разделу</div>
              <button onClick={() => setPage('dashboard')} style={{ marginTop:20, padding:'10px 24px', borderRadius:8, border:'none', background:'var(--red)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>На дашборд</button>
            </div>
          )}
        </main>
      </div>

      {/* Bell modal */}
      {bellId && <BellRequestDetail requestId={bellId} onClose={() => setBellId(null)} />}

      {/* Toast */}
      {toast && (
        <div className="fade-in" style={{
          position:'fixed', bottom:20, right:20, zIndex:9999,
          background: toast.type==='error'?'#C0392B':toast.type==='success'?'#16803C':'var(--navy)',
          color:'#fff', padding:'11px 18px', borderRadius:10,
          fontSize:13, fontWeight:600, maxWidth:320,
          borderLeft:`3px solid ${toast.type==='error'?'#ef4444':toast.type==='success'?'#22c55e':'var(--red)'}`,
          boxShadow:'0 8px 24px rgba(0,0,0,.3)',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

function BellRequestDetail({ requestId, onClose }) {
  const [req, setReq] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    supabase.from('requests').select('*').eq('id', requestId).single()
      .then(({ data }) => { setReq(data); setLoading(false) })
  }, [requestId])

  const STATUS = { new:{l:'Новая',c:'#637380'},work:{l:'В работе',c:'#2563EB'},approved:{l:'Принята',c:'#16A34A'},rejected:{l:'Отклонена',c:'#DC2626'},completed:{l:'Выполнена',c:'#7C3AED'} }
  const parseJson = (v,d) => { if(!v)return d; if(Array.isArray(v))return v; try{return JSON.parse(v)}catch{return d} }
  const fmtD = d => { try{return new Date(d).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return '—'} }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.65)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
      <div className="fade-in" style={{ background:'var(--bg2)',borderRadius:14,width:'100%',maxWidth:520,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 24px 60px rgba(0,0,0,.4)',border:'1px solid var(--bd)' }}>
        <div style={{ padding:'14px 18px',background:'var(--navy)',borderBottom:'2px solid var(--red)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <span style={{ fontSize:16,fontFamily:'var(--font-display)',letterSpacing:'.1em',color:'#EEEAE0' }}>
            {req ? `#${String(req.id).padStart(5,'0')} — ДЕТАЛИ` : 'ЗАГРУЗКА'}
          </span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)',border:'none',borderRadius:6,width:28,height:28,color:'rgba(232,231,227,.7)',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
        </div>
        <div style={{ overflowY:'auto',flex:1,padding:20 }}>
          {loading ? <div style={{ textAlign:'center',padding:40,color:'var(--t3)' }}>Загрузка…</div>
          : req ? <>
              <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:14 }}>
                <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,background:req.type==='risk'?'rgba(217,119,6,.15)':'rgba(22,163,74,.15)',color:req.type==='risk'?'#d97706':'#16a34a' }}>
                  {req.type==='risk'?`⚠️ Риск${req.risk_urgency?` L${req.risk_urgency}`:''}` :'💡 Идея'}
                </span>
                <span style={{ fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:99,background:`${(STATUS[req.status]||STATUS.new).c}18`,color:(STATUS[req.status]||STATUS.new).c }}>
                  {(STATUS[req.status]||STATUS.new).l}
                </span>
              </div>
              <div style={{ fontSize:14,color:'var(--t1)',lineHeight:1.7,marginBottom:14,background:'var(--bg3)',padding:'12px 14px',borderRadius:10 }}>{req.description}</div>
              <div style={{ fontSize:12,color:'var(--t3)',marginBottom:8 }}>👤 {req.anonymous?'Аноним':req.author} · 📍 {req.location||'—'} · 🕐 {fmtD(req.date||req.created_at)}</div>
              {req.assigned_to && <div style={{ fontSize:12,color:'var(--blue)',marginBottom:8 }}>👷 {req.assigned_to}</div>}
              {req.deadline && <div style={{ fontSize:12,fontWeight:700,color:new Date(req.deadline)<new Date()?'#dc2626':'var(--t3)',marginBottom:12 }}>⏰ {fmtD(req.deadline)}</div>}
              {parseJson(req.media,[]).length>0 && <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginTop:8 }}>
                {parseJson(req.media,[]).map((m,i)=><img key={i} src={m} onClick={()=>window.open(m,'_blank')} style={{ width:72,height:72,objectFit:'cover',borderRadius:8,border:'1px solid var(--bd)',cursor:'pointer' }} />)}
              </div>}
            </> : <div style={{ textAlign:'center',padding:40,color:'var(--t3)' }}>Не найдена</div>
          }
        </div>
      </div>
    </div>
  )
}
