import React, { useState, useRef, useCallback } from 'react'

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [pulling, setPulling] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const containerRef = useRef(null)
  const THRESHOLD = 70

  function handleTouchStart(e) {
    if (disabled || refreshing) return
    const scrollTop = containerRef.current?.scrollTop || 0
    if (scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
  }

  function handleTouchMove(e) {
    if (disabled || refreshing) return
    const scrollTop = containerRef.current?.scrollTop || 0
    if (scrollTop > 0) return
    const dy = e.touches[0].clientY - startYRef.current
    if (dy > 0) {
      setPulling(true)
      // Resistance effect
      setPullY(Math.min(dy * 0.5, THRESHOLD * 1.5))
    }
  }

  async function handleTouchEnd() {
    if (disabled || refreshing) return
    if (pullY >= THRESHOLD) {
      setRefreshing(true)
      setPullY(THRESHOLD)
      try { await onRefresh() } catch {}
      setRefreshing(false)
    }
    setPulling(false)
    setPullY(0)
  }

  const progress = Math.min(pullY / THRESHOLD, 1)
  const isReady = pullY >= THRESHOLD

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Pull indicator */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: pullY || (refreshing ? THRESHOLD : 0),
        transition: pulling ? 'none' : 'height .3s ease',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: Math.min(progress * 2, 1),
          transform: `scale(${0.6 + progress * 0.4})`,
          transition: pulling ? 'none' : 'all .3s ease',
        }}>
          {refreshing ? (
            <div className="anim-spin" style={{
              width: 24, height: 24, border: '2.5px solid rgba(245,61,45,.2)',
              borderTopColor: '#f53d2d', borderRadius: '50%',
            }} />
          ) : (
            <div style={{
              width: 24, height: 24, border: '2.5px solid var(--bd)',
              borderTopColor: isReady ? '#f53d2d' : 'var(--t3)',
              borderRadius: '50%',
              transform: `rotate(${progress * 360}deg)`,
              transition: pulling ? 'none' : 'transform .3s',
            }} />
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: isReady ? '#f53d2d' : 'var(--t3)' }}>
            {refreshing ? 'Обновление…' : isReady ? 'Отпустите!' : 'Потяните вниз'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          height: '100%', overflowY: 'auto', overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          transform: `translateY(${pulling || refreshing ? pullY : 0}px)`,
          transition: pulling ? 'none' : 'transform .3s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}
