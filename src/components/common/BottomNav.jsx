import React from 'react'

export default function BottomNav({ section, onSection, onCreate, notifBadge, profileBadge }) {
  const ITEMS = [
    { id:'feed',    icon:FeedIcon,    label:'Лента' },
    { id:'notif',   icon:BellIcon,    label:'Уведом.', badge:notifBadge },
    { id:'_create', icon:null,        label:'' },
    { id:'news',    icon:NewsIcon,    label:'Новости' },
    { id:'profile', icon:ProfileIcon, label:'Профиль', badge:profileBadge },
  ]

  return (
    <nav style={{
      position: 'relative', zIndex: 60,
      background: 'var(--navy)',
      borderTop: '2px solid var(--red)',
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      paddingBottom: 'max(env(safe-area-inset-bottom,0px), 4px)',
    }}>
      {ITEMS.map(({ id, icon:Icon, label, badge }) => {
        if (id === '_create') return (
          <div key="_create" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
            <button onClick={onCreate} style={{
              width: 52, height: 52, borderRadius: 15,
              background: 'linear-gradient(135deg, var(--red), var(--red2))',
              border: '2.5px solid rgba(255,255,255,.15)',
              color: '#fff', fontSize: 26, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(232,50,31,.45)',
              transition: 'transform .15s, box-shadow .15s',
              lineHeight: 1,
              marginTop: -8,
            }}
              onMouseOver={e => { e.currentTarget.style.transform='scale(1.07)'; e.currentTarget.style.boxShadow='0 6px 22px rgba(232,50,31,.55)' }}
              onMouseOut={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 4px 16px rgba(232,50,31,.45)' }}
            >+</button>
          </div>
        )
        const isActive = section === id
        return (
          <button key={id} onClick={() => onSection(id)} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '10px 0', minHeight: 56,
            background: 'none', border: 'none', cursor: 'pointer',
            color: isActive ? 'var(--red)' : 'rgba(232,231,227,.38)',
            transition: 'color .2s',
            position: 'relative',
          }}>
            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 2.5, borderRadius: '0 0 3px 3px',
                background: 'var(--red)',
              }} />
            )}
            <Icon size={22} active={isActive} />
            <span style={{
              fontSize: 9.5, fontFamily: 'var(--font-display)',
              letterSpacing: '.06em', textTransform: 'uppercase',
              fontWeight: 400,
            }}>{label}</span>
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: 'calc(50% - 20px)',
                minWidth: 17, height: 17, padding: '0 4px',
                background: 'var(--red)', color: '#fff',
                borderRadius: 99, fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid var(--navy)',
              }}>{badge > 9 ? '9+' : badge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

const FeedIcon = ({ size, active }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active?2.2:1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h7"/>
  </svg>
)
const BellIcon = ({ size, active }) => (
  <svg width={size} height={size} fill={active?"currentColor":"none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active?0:1.8}>
    {active
      ? <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
      : <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    }
  </svg>
)
const NewsIcon = ({ size, active }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active?2.2:1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2"/>
  </svg>
)
const ProfileIcon = ({ size, active }) => (
  <svg width={size} height={size} fill={active?"currentColor":"none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active?0:1.8}>
    {active
      ? <path fillRule="evenodd" d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 8a7 7 0 0114 0H5z" clipRule="evenodd"/>
      : <><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></>
    }
  </svg>
)
