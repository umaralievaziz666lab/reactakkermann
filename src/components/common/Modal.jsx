import React, { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 440, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.65)', zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: 0,
      }}
    >
      <div
        className="slide-up"
        style={{
          background: 'var(--bg2)',
          borderRadius: '16px 16px 0 0',
          width: '100%', maxWidth,
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,.35)',
          borderTop: '3px solid var(--red)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '2px solid var(--bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--navy)', flexShrink: 0,
        }}>
          <span style={{
            fontSize: 15, fontWeight: 800, color: '#fff',
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.05em',
          }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, color: 'rgba(232,231,227,0.7)', cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 16 }}>
          {children}
        </div>

        {footer}
      </div>
    </div>
  )
}
