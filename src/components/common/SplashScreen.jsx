import React from 'react'

export default function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 8,
          background: 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          boxShadow: '0 8px 24px rgba(245,61,45,.5)',
        }}>🚀</div>
        <div style={{
          fontSize: 18, fontWeight: 800, letterSpacing: '.12em',
          fontFamily: "'Barlow Condensed', sans-serif",
          textTransform: 'uppercase', color: 'var(--t1)',
        }}>AKKERMANN PULSE</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <div className="anim-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#f53d2d' }} />
          <div className="anim-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#c42b1c', animationDelay: '.15s' }} />
          <div className="anim-bounce" style={{ width: 8, height: 8, borderRadius: '50%', background: '#f53d2d', animationDelay: '.3s' }} />
        </div>
      </div>
    </div>
  )
}
