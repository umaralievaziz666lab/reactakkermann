import React from 'react'

export default function Toast({ msg, type = 'info' }) {
  const bg = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : 'rgba(0,0,0,.8)'
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%',
      transform: 'translateX(-50%)',
      background: bg, color: '#fff',
      padding: '10px 20px', borderRadius: 20,
      fontSize: 13, fontWeight: 600,
      zIndex: 999, pointerEvents: 'none',
      animation: 'fadeInOut 2.5s ease',
      whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 40px)',
      textAlign: 'center',
    }}>
      {msg}
    </div>
  )
}
