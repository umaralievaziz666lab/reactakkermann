import React, { useState, useEffect, useRef } from 'react'
import { supabase, pad, fmtDate, initials, avatarColor, STATUS_MAP, POINTS } from '../../lib/supabase.js'
import Avatar from '../common/Avatar.jsx'

export default function DetailModal({ postId, posts, user, onClose, onUpdate, showToast, updateUser }) {
  const [post, setPost] = useState(posts.find(p => p.id === postId) || null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!post && postId) loadPost()
    loadComments()
  }, [postId])

  async function loadPost() {
    const { data } = await supabase.from('requests').select('*').eq('id', postId).single()
    if (data) setPost(data)
  }

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments(data || [])
    // Also update count on post
    if (data) {
      await supabase.from('requests').update({ comments: data.length }).eq('id', postId)
    }
  }

  async function handleComment(e) {
    e.preventDefault()
    if (!commentText.trim() || !user || submitting) return
    setSubmitting(true)
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.empId,
      author: user.name,
      text: commentText.trim(),
    })
    if (!error) {
      setCommentText('')
      loadComments()
      // Points for comment
      if (post && post.author_id && post.author_id !== user.empId) {
        await pushNotif(post.author_id, '💬 Новый комментарий', `${user.name}: ${commentText.trim().slice(0, 60)}`, postId, 'comment')
      }
    }
    setSubmitting(false)
  }

  async function pushNotif(userId, title, message, postId, type) {
    await supabase.from('notifications').insert({ user_id: userId, title, message, post_id: postId, type, read: false, date: new Date().toISOString() })
  }

  if (!post) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#fff' }}>Загрузка…</div>
    </div>
  )

  const media = parseJson(post.media, [])
  const completionMedia = parseJson(post.completion_media, [])
  const changelog = parseJson(post.change_log, [])
  const st = STATUS_MAP[post.status] || STATUS_MAP.new
  const isAssigned = post.assigned_to === user?.name
  const isAuthor = post.author_id === user?.empId || post.author === user?.name

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div className="slide-up" style={{
        background: 'var(--bg2)', borderRadius: '16px 16px 0 0',
        width: '100%', maxWidth: 500, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        borderTop: '3px solid var(--red)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '2px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--navy)', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Barlow Condensed', sans-serif" }}>ДЕТАЛИ ЗАЯВКИ</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'rgba(232,231,227,0.7)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '14px 16px' }}>
            {/* Author info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Avatar name={post.anonymous ? '?' : post.author} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--t1)', fontSize: 15 }}>{post.anonymous ? 'Аноним 🎭' : post.author}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>📍 {post.location || '—'} · {fmtDate(post.date || post.created_at)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: `${st.color}18`, color: st.color }}>{st.label}</span>
            </div>

            {/* Type + urgency */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: post.type === 'risk' ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)', color: post.type === 'risk' ? '#dc2626' : '#059669' }}>
                {post.type === 'risk' ? '⚠️ Риск' : '💡 Идея'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc)', fontFamily: 'monospace' }}>{pad(post.id)}</span>
              {post.type === 'risk' && post.risk_urgency && (
                <UrgBadge level={post.risk_urgency} />
              )}
            </div>

            {/* Description */}
            <div style={{ fontSize: 14, color: 'var(--t1)', lineHeight: 1.7, marginBottom: 14 }}>
              {post.description}
            </div>

            {/* Media */}
            {media.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 8 }}>Медиафайлы</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {media.map((m, i) => {
                    const isVid = m.includes('.mp4') || m.includes('.mov') || m.startsWith('data:video')
                    return isVid
                      ? <video key={i} src={m} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} controls />
                      : <img key={i} src={m} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)', cursor: 'pointer' }} loading="lazy" />
                  })}
                </div>
              </div>
            )}

            {/* Admin comment */}
            {post.admin_comment && (
              <div style={{ background: 'rgba(245,61,45,.05)', border: '1px solid rgba(245,61,45,.2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 4 }}>💬 Комментарий администратора</div>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>{post.admin_comment}</div>
              </div>
            )}

            {/* Assigned to */}
            {post.assigned_to && (
              <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
                👤 Назначено: <strong style={{ color: 'var(--t1)' }}>{post.assigned_to}</strong>
              </div>
            )}

            {/* Deadline */}
            {post.deadline && (
              <div style={{ fontSize: 12, color: new Date(post.deadline) < new Date() ? '#dc2626' : 'var(--t3)', marginBottom: 14 }}>
                ⏰ Дедлайн: <strong>{fmtDate(post.deadline)}</strong>
              </div>
            )}

            {/* Completion media */}
            {completionMedia.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: 8 }}>✅ Отчёт о выполнении</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {completionMedia.map((m, i) => <img key={i} src={m} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--bd)' }} loading="lazy" />)}
                </div>
              </div>
            )}

            {/* Change log */}
            {changelog.length > 0 && (
              <div>
                <button onClick={() => setShowLogs(!showLogs)} style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--t2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: showLogs ? 8 : 0 }}>
                  📋 История изменений ({changelog.length})
                </button>
                {showLogs && changelog.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--bg3)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--acc)', flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600 }}>{log.action}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{log.by} · {fmtDate(log.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments section */}
          <div style={{ borderTop: '2px solid var(--bd)' }}>
            <div style={{ padding: '8px 12px', background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Комментарии ({comments.length})
            </div>
            <div style={{ padding: '8px 12px', minHeight: 50 }}>
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t4)', fontSize: 12 }}>Будьте первым!</div>
              ) : comments.map(c => (
                <CommentItem key={c.id} comment={c} />
              ))}
            </div>
          </div>
        </div>

        {/* Comment input */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--bd)', flexShrink: 0 }}>
          <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Напишите комментарий…"
              style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              disabled={!user}
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              style={{ padding: '9px 16px', borderRadius: 4, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: submitting ? .6 : 1 }}
            >↑</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
      <Avatar name={comment.author} size={30} />
      <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: '0 10px 10px 10px', padding: '8px 12px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{comment.author}</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{comment.text}</div>
        <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 4 }}>{fmtDate(comment.created_at)}</div>
      </div>
    </div>
  )
}

function UrgBadge({ level }) {
  const cfg = {
    1: { bg: 'rgba(239,68,68,.15)', color: '#dc2626', label: '🔴 Уровень 1' },
    2: { bg: 'rgba(245,158,11,.15)', color: '#d97706', label: '🟡 Уровень 2' },
    3: { bg: 'rgba(16,185,129,.15)', color: '#059669', label: '🟢 Уровень 3' },
  }[level] || {}
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
}

function parseJson(val, def) {
  if (!val) return def
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return def }
}
