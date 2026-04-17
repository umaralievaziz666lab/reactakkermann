import React, { useState, useEffect, useRef, useCallback } from 'react'

export default function ImageGallery({ media, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastOffset, setLastOffset] = useState({ x: 0, y: 0 })
  const lastTapRef = useRef(0)
  const pinchRef = useRef(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    // Reset zoom on slide change
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setLastOffset({ x: 0, y: 0 })
  }, [current])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current])

  function prev() { if (current > 0) setCurrent(c => c - 1) }
  function next() { if (current < media.length - 1) setCurrent(c => c + 1) }

  // Double tap to zoom
  function handleTap(e) {
    const now = Date.now()
    const gap = now - lastTapRef.current
    lastTapRef.current = now
    if (gap < 300) {
      // Double tap
      if (scale > 1) {
        setScale(1)
        setOffset({ x: 0, y: 0 })
        setLastOffset({ x: 0, y: 0 })
      } else {
        setScale(2.5)
      }
    }
  }

  // Touch handlers for drag when zoomed
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = Math.sqrt(dx*dx + dy*dy)
      return
    }
    if (scale > 1) {
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX - lastOffset.x, y: e.touches[0].clientY - lastOffset.y })
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx*dx + dy*dy)
      const newScale = Math.max(1, Math.min(4, scale * (dist / pinchRef.current)))
      setScale(newScale)
      pinchRef.current = dist
      return
    }
    if (isDragging && scale > 1) {
      const newX = e.touches[0].clientX - dragStart.x
      const newY = e.touches[0].clientY - dragStart.y
      setOffset({ x: newX, y: newY })
    }
  }

  function handleTouchEnd() {
    setIsDragging(false)
    setLastOffset(offset)
    pinchRef.current = null
    if (scale <= 1) {
      setOffset({ x: 0, y: 0 })
      setLastOffset({ x: 0, y: 0 })
    }
  }

  const m = media[current]
  const isVid = m?.includes('.mp4') || m?.includes('.mov') || m?.startsWith('data:video')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.97)',
      zIndex: 500, display: 'flex', flexDirection: 'column',
      userSelect: 'none',
    }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: 'calc(env(safe-area-inset-top,0px) + 12px) 16px 12px',
        background: 'linear-gradient(rgba(0,0,0,.6),transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
          {current + 1} / {media.length}
        </div>
        {scale > 1 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.5)', background: 'rgba(255,255,255,.1)', padding: '3px 8px', borderRadius: 20 }}>
            {Math.round(scale * 100)}%
          </div>
        )}
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,.15)', border: 'none',
          color: '#fff', fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>×</button>
      </div>

      {/* Main image */}
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: scale > 1 ? 'grab' : 'default' }}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isVid ? (
          <video src={m} controls autoPlay playsInline
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 4 }} />
        ) : (
          <img src={m} alt=""
            style={{
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain', borderRadius: 4,
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform .2s ease',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Bottom thumbnails */}
      {media.length > 1 && (
        <div style={{
          padding: '12px 16px calc(env(safe-area-inset-bottom,0px) + 12px)',
          background: 'linear-gradient(transparent,rgba(0,0,0,.6))',
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {media.map((m2, i) => (
            <div key={i} onClick={() => setCurrent(i)} style={{
              width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
              border: `2px solid ${i === current ? '#f53d2d' : 'transparent'}`,
              opacity: i === current ? 1 : 0.5, cursor: 'pointer', transition: '.2s', flexShrink: 0,
            }}>
              <img src={m2} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      {/* Prev/Next arrows */}
      {media.length > 1 && (
        <>
          {current > 0 && (
            <button onClick={prev} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,.15)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)', zIndex: 10,
            }}>‹</button>
          )}
          {current < media.length - 1 && (
            <button onClick={next} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,.15)', border: 'none',
              color: '#fff', fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)', zIndex: 10,
            }}>›</button>
          )}
        </>
      )}

      {/* Hint */}
      {scale === 1 && !isVid && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center', pointerEvents: 'none',
        }}>
          Двойное нажатие для зума · Щипок для масштаба
        </div>
      )}
    </div>
  )
}
