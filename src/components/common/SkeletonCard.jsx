import React from 'react'

export default function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--bg2)', borderRadius: 12, marginBottom: 10,
      overflow: 'hidden', borderLeft: '3px solid var(--bd)',
      border: '1px solid var(--bd)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 13, width: '45%', borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 11, width: '65%', borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ width: 52, height: 20, borderRadius: 99 }} />
      </div>
      {/* Content */}
      <div style={{ padding: '4px 12px 8px' }}>
        <div className="skeleton" style={{ height: 12, width: '30%', borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 13, width: '100%', borderRadius: 4, marginBottom: 5 }} />
        <div className="skeleton" style={{ height: 13, width: '85%', borderRadius: 4, marginBottom: 5 }} />
        <div className="skeleton" style={{ height: 13, width: '60%', borderRadius: 4 }} />
      </div>
      {/* Actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 8 }}>
        <div className="skeleton" style={{ height: 28, width: 60, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 28, width: 60, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 99, marginLeft: 'auto' }} />
      </div>
    </div>
  )
}
