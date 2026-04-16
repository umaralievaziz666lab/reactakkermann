import React from 'react'

export default function LoadingDots({ style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '60px 20px', ...style }}>
      <div className="dot-bounce" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }} />
      <div className="dot-bounce-2" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }} />
      <div className="dot-bounce-3" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)' }} />
    </div>
  )
}
