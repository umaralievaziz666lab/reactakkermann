import React from 'react'
import { initials, avatarColor } from '../../lib/supabase.js'

export default function Avatar({ name, src, size = 36, onClick }) {
  const style = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: 700, fontSize: size * 0.33,
    flexShrink: 0, cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
  }

  if (src) {
    return <img src={src} alt={name} style={{ ...style, objectFit: 'cover' }} onClick={onClick} />
  }

  return (
    <div style={{ ...style, background: avatarColor(name || '') }} onClick={onClick}>
      {initials(name)}
    </div>
  )
}
