import React, { useState } from 'react'
import { pad, fmtDate, initials, avatarColor, STATUS_MAP } from '../../lib/supabase.js'
import Avatar from '../common/Avatar.jsx'

export default function FeedCard({ post, user, isLiked, onLike, onDetail }) {
  const media = parseMedia(post.media)
  const comments = parseMedia(post.comments)
  const st = STATUS_MAP[post.status] || STATUS_MAP.new

  return (
    <div style={{
      background: 'var(--bg2)',
      border: '1px solid var(--bd)',
      borderLeft: '3px solid var(--red)',
      borderRadius: 4,
      marginBottom: 8,
      overflow: 'hidden',
      transition: 'box-shadow .2s',
    }}>
      {/* Card header */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={post.anonymous ? '?' : post.author} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
              {post.anonymous ? 'Аноним' : post.author || '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              📍 {post.location || '—'} · {fmtDate(post.date || post.created_at)}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
          background: post.type === 'risk' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
          color: post.type === 'risk' ? '#dc2626' : '#059669',
        }}>
          {post.type === 'risk' ? '⚠️ Риск' : '💡 Идея'}
        </span>
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div style={{ cursor: 'pointer', overflow: 'hidden' }} onClick={onDetail}>
          <MediaGrid media={media} />
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '8px 12px 4px', cursor: 'pointer' }} onClick={onDetail}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--acc)', fontFamily: 'monospace' }}>{pad(post.id)}</span>
          {post.type === 'risk' && post.risk_urgency && (
            <UrgencyBadge level={post.risk_urgency} />
          )}
        </div>
        <div style={{
          fontSize: 13, color: 'var(--t2)', lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {post.description}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'var(--bg2)',
      }}>
        {/* Like */}
        <button onClick={onLike} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: isLiked ? '#f53d2d' : 'var(--t3)',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 13, fontWeight: 600, padding: 0,
        }}>
          <span style={{ fontSize: 16 }}>{isLiked ? '❤️' : '🤍'}</span>
          {post.likes || 0}
        </button>

        {/* Comments */}
        <button onClick={onDetail} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--t3)',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 13, fontWeight: 600, padding: 0,
        }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          {Array.isArray(comments) ? comments.length : (post.comments || 0)}
        </button>

        {/* Status */}
        <span style={{
          marginLeft: 'auto', padding: '3px 10px', borderRadius: 3,
          fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
          background: `${st.color}18`, color: st.color,
        }}>{st.label}</span>
      </div>
    </div>
  )
}

function MediaGrid({ media }) {
  if (media.length === 1) {
    const isVid = media[0].includes('.mp4') || media[0].includes('.mov') || media[0].startsWith('data:video')
    if (isVid) return <video src={media[0]} style={{ maxHeight: 240, width: '100%', objectFit: 'cover', background: '#000', display: 'block' }} controls playsInline onClick={e => e.stopPropagation()} />
    return <img src={media[0]} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} loading="lazy" />
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--bd)' }}>
      {media.slice(0, 4).map((m, i) => (
        <div key={i} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}>
          <img src={m} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          {i === 3 && media.length > 4 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>
              +{media.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function UrgencyBadge({ level }) {
  const cfg = {
    1: { bg: 'rgba(239,68,68,.15)', color: '#dc2626', label: '🔴 Уровень 1' },
    2: { bg: 'rgba(245,158,11,.15)', color: '#d97706', label: '🟡 Уровень 2' },
    3: { bg: 'rgba(16,185,129,.15)', color: '#059669', label: '🟢 Уровень 3' },
  }[level] || {}
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  )
}

function parseMedia(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
