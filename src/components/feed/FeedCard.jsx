import React, { useState } from 'react'
import { pad, fmtDate, initials, avatarColor, STATUS_MAP } from '../../lib/supabase.js'

export default function FeedCard({ post, user, isLiked, onLike, onDetail }) {
  const [imgError, setImgError] = useState(false)
  const media = parseMedia(post.media)
  const comments = parseMedia(post.comments)
  const st = STATUS_MAP[post.status] || STATUS_MAP.new

  const cardClass = post.type === 'idea'
    ? 'feed-card idea'
    : post.risk_urgency === 1
      ? 'feed-card risk-1'
      : post.risk_urgency === 2
        ? 'feed-card risk-2'
        : 'feed-card risk-3'

  const urgencyClass = post.risk_urgency === 1 ? 'urgency-1' : ''

  return (
    <div className={`${cardClass} ${urgencyClass}`} style={{ paddingLeft: 3 }}>
      {/* Urgent banner for level 1 */}
      {post.type === 'risk' && post.risk_urgency === 1 && (
        <div className="anim-pulse" style={{
          background: 'linear-gradient(90deg, #dc2626, #ef4444)',
          padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 13 }}>🚨</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif" }}>
            КРИТИЧЕСКИЙ РИСК — ТРЕБУЕТ НЕМЕДЛЕННОГО ВНИМАНИЯ
          </span>
        </div>
      )}

      {/* Card header */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: post.anonymous ? '#6b7280' : avatarColor(post.author),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13,
            border: '2px solid var(--bg)',
            boxShadow: '0 1px 4px rgba(0,0,0,.15)',
          }}>
            {post.anonymous ? '?' : initials(post.author)}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post.anonymous ? '🎭 Аноним' : (post.author || '—')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>📍</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.location || '—'}</span>
              <span>·</span>
              <span style={{ flexShrink: 0 }}>{fmtDate(post.date || post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Type badge */}
        <div style={{ flexShrink: 0 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
            background: post.type === 'risk' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
            color: post.type === 'risk' ? '#dc2626' : '#16a34a',
            border: `1px solid ${post.type === 'risk' ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.04em',
          }}>
            {post.type === 'risk' ? '⚠️ РИСК' : '💡 ИДЕЯ'}
          </span>
        </div>
      </div>

      {/* Media */}
      {media.length > 0 && (
        <div onClick={onDetail} style={{ cursor: 'pointer', overflow: 'hidden', margin: '0 0 0 3px' }}>
          <MediaGrid media={media} />
        </div>
      )}

      {/* Content */}
      <div onClick={onDetail} style={{ padding: '8px 12px 4px', cursor: 'pointer' }}>
        {/* Tags row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--acc)', fontFamily: 'monospace', background: 'rgba(245,61,45,.08)', padding: '1px 6px', borderRadius: 4 }}>
            {pad(post.id)}
          </span>
          {post.type === 'risk' && post.risk_urgency && <UrgencyBadge level={post.risk_urgency} />}
          {post.assigned_to && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(59,130,246,.1)', color: '#3b82f6' }}>
              👤 {post.assigned_to}
            </span>
          )}
        </div>

        {/* Description */}
        <div style={{
          fontSize: 13, color: 'var(--t2)', lineHeight: 1.6,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {post.description}
        </div>
      </div>

      {/* Actions bar */}
      <div style={{
        padding: '8px 12px', marginTop: 4,
        borderTop: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {/* Like button */}
        <button onClick={onLike} style={{
          background: isLiked ? 'rgba(245,61,45,.1)' : 'none',
          border: `1px solid ${isLiked ? 'rgba(245,61,45,.3)' : 'transparent'}`,
          borderRadius: 8, cursor: 'pointer',
          color: isLiked ? '#f53d2d' : 'var(--t3)',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 700, padding: '4px 10px',
          transition: 'all .2s',
        }}>
          <span style={{ fontSize: 15, transition: 'transform .2s', transform: isLiked ? 'scale(1.2)' : 'scale(1)' }}>
            {isLiked ? '❤️' : '🤍'}
          </span>
          {post.likes || 0}
        </button>

        {/* Comments button */}
        <button onClick={onDetail} style={{
          background: 'none', border: '1px solid transparent', borderRadius: 8,
          cursor: 'pointer', color: 'var(--t3)',
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 700, padding: '4px 10px',
          transition: 'all .2s',
        }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          {Array.isArray(comments) ? comments.length : (post.comments || 0)}
        </button>

        {/* Status pill */}
        <div style={{ marginLeft: 'auto' }}>
          <span className={`status-${post.status || 'new'}`} style={{
            padding: '3px 10px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
          }}>
            {st.label}
          </span>
        </div>
      </div>
    </div>
  )
}

function MediaGrid({ media }) {
  if (media.length === 1) {
    const isVid = media[0].includes('.mp4') || media[0].includes('.mov') || media[0].startsWith('data:video')
    if (isVid) return (
      <video src={media[0]} style={{ maxHeight: 260, width: '100%', objectFit: 'cover', background: '#000', display: 'block' }}
        controls playsInline onClick={e => e.stopPropagation()} />
    )
    return <img src={media[0]} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} loading="lazy" />
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: media.length === 2 ? '1fr 1fr' : media.length === 3 ? '2fr 1fr' : '1fr 1fr', gap: 2, background: 'var(--bd)' }}>
      {media.slice(0, 4).map((m, i) => {
        if (media.length === 3 && i === 0) {
          return (
            <div key={i} style={{ gridRow: 'span 2', position: 'relative', overflow: 'hidden' }}>
              <img src={m} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
            </div>
          )
        }
        return (
          <div key={i} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden' }}>
            <img src={m} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
            {i === 3 && media.length > 4 && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 800 }}>
                +{media.length - 4}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UrgencyBadge({ level }) {
  const cfg = {
    1: { bg: 'rgba(239,68,68,.15)', color: '#dc2626', label: '🔴 Уровень 1', border: 'rgba(239,68,68,.3)' },
    2: { bg: 'rgba(245,158,11,.15)', color: '#d97706', label: '🟡 Уровень 2', border: 'rgba(245,158,11,.3)' },
    3: { bg: 'rgba(34,197,94,.15)', color: '#16a34a', label: '🟢 Уровень 3', border: 'rgba(34,197,94,.3)' },
  }[level] || {}
  return (
    <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '.04em' }}>
      {cfg.label}
    </span>
  )
}

function parseMedia(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}
