import React from 'react'

const NavIcon = ({ d, size = 22 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={d} />
  </svg>
)

export default function BottomNav({ section, onSection, onCreate, notifBadge, profileBadge }) {
  const btn = (active) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer', gap: 2,
    position: 'relative', padding: '10px 0', minHeight: 54, flex: 1,
    color: active ? '#f53d2d' : 'rgba(232,231,227,0.5)',
    transition: 'color .2s',
  })

  return (
    <nav style={{
      position: 'relative', zIndex: 60,
      background: 'var(--navy)',
      borderTop: '3px solid var(--red)',
      display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      boxShadow: '0 -4px 20px rgba(0,0,0,.2)',
      /* Safe area for iPhone home indicator */
      paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)',
    }}>
      <button style={btn(section === 'feed')} onClick={() => onSection('feed')}>
        <NavIcon d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        <NavLabel>Лента</NavLabel>
      </button>

      <button style={btn(section === 'notif')} onClick={() => onSection('notif')}>
        <NavIcon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        <NavLabel>Уведом.</NavLabel>
        {notifBadge > 0 && <Badge>{notifBadge > 9 ? '9+' : notifBadge}</Badge>}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
        <button onClick={onCreate} style={{
          width: 50, height: 50, borderRadius: 14,
          border: '2px solid rgba(255,255,255,0.15)',
          background: 'linear-gradient(135deg,#f53d2d,#c42b1c)',
          color: '#fff', fontSize: 28, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(245,61,45,.45)',
          transition: 'transform .15s',
        }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.06)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >+</button>
      </div>

      <button style={btn(section === 'news')} onClick={() => onSection('news')}>
        <NavIcon d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        <NavLabel>Новости</NavLabel>
      </button>

      <button style={btn(section === 'profile')} onClick={() => onSection('profile')}>
        <NavIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        <NavLabel>Профиль</NavLabel>
        {profileBadge && <Badge>!</Badge>}
      </button>
    </nav>
  )
}

function NavLabel({ children }) {
  return <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.05em' }}>{children}</span>
}

function Badge({ children }) {
  return (
    <span style={{
      position: 'absolute', top: 6, right: 6,
      minWidth: 16, height: 16,
      background: 'var(--red)', color: '#fff',
      borderRadius: 999, fontSize: 9, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 3px', border: '1px solid rgba(255,255,255,0.3)',
    }}>{children}</span>
  )
}
