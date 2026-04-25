import React, { useEffect, useState } from 'react'

export default function SplashScreen() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200)
    const t2 = setTimeout(() => setPhase(2), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--navy)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0,
    }}>
      {/* Декоративная сетка */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(232,50,31,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(232,50,31,.04) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Красная полоса */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4,
        background: 'linear-gradient(180deg, transparent, var(--red), transparent)',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'opacity .6s',
      }} />

      <div style={{
        textAlign: 'center', position: 'relative', zIndex: 1,
        transform: phase >= 1 ? 'translateY(0)' : 'translateY(20px)',
        opacity: phase >= 1 ? 1 : 0,
        transition: 'all .6s cubic-bezier(.32,.72,0,1)',
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 58, fontFamily: 'var(--font-display)',
          letterSpacing: '.18em', color: '#EEEAE0',
          lineHeight: 1, marginBottom: 2,
        }}>
          AKKERMANN
        </div>
        <div style={{
          fontSize: 18, fontFamily: 'var(--font-display)',
          letterSpacing: '.55em', color: 'var(--red)',
          marginBottom: 32,
        }}>
          PULSE
        </div>

        {/* Loading dots */}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', opacity: phase >= 2 ? 1 : 0, transition: 'opacity .4s .2s' }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--red)',
              animation: 'dotBounce 1.2s ease infinite',
              animationDelay: `${i * .15}s`,
            }} />
          ))}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 28,
        fontSize: 11, fontFamily: 'var(--font-display)',
        letterSpacing: '.14em', color: 'rgba(255,255,255,.18)',
        opacity: phase >= 2 ? 1 : 0, transition: 'opacity .4s .4s',
      }}>
        SISTEMA BEZOPASNOSTI
      </div>
    </div>
  )
}
