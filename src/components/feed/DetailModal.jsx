import React, { useState, useEffect, useRef } from 'react'
import { supabase, pad, fmtDate, initials, avatarColor, STATUS_MAP } from '../../lib/supabase.js'
import { notifyUser } from '../../lib/telegram.js'

export default function DetailModal({ postId, posts, user, onClose, onUpdate, showToast, updateUser }) {
  const [post, setPost] = useState(posts?.find(p => p.id === postId) || null)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [mentionList, setMentionList] = useState([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [completionFiles, setCompletionFiles] = useState([])
  const [completionPreviews, setCompletionPreviews] = useState([])
  const [uploadingReport, setUploadingReport] = useState(false)
  const inputRef = useRef(null)
  const mentionRef = useRef(null)

  useEffect(() => {
    if (!post && postId) loadPost()
    loadComments()
    loadUsers()
  }, [postId])

  async function loadPost() {
    const { data } = await supabase.from('requests').select('*').eq('id', postId).single()
    if (data) setPost(data)
  }

  async function loadComments() {
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })
    setComments(data || [])
    if (data) await supabase.from('requests').update({ comments: data.length }).eq('id', postId)
  }

  async function loadUsers() {
    const { data } = await supabase.from('users').select('id,name,department').order('name').limit(100)
    setAllUsers(data || [])
  }

  // ── COMMENT WITH @MENTION ──────────────────────────────────────────────────
  function handleCommentInput(e) {
    const val = e.target.value
    setCommentText(val)

    // Detect @mention
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1) {
      const query = val.slice(lastAt + 1).toLowerCase()
      if (query.length >= 0 && !query.includes(' ')) {
        const matches = allUsers.filter(u =>
          u.name.toLowerCase().includes(query) && u.id !== user?.empId
        ).slice(0, 5)
        setMentionList(matches)
        setMentionQuery(query)
      } else {
        setMentionList([])
      }
    } else {
      setMentionList([])
    }
  }

  function insertMention(name) {
    const lastAt = commentText.lastIndexOf('@')
    const newText = commentText.slice(0, lastAt) + `@${name} `
    setCommentText(newText)
    setMentionList([])
    inputRef.current?.focus()
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
      // 🔔 Уведомить автора поста
      if (post?.author_id && post.author_id !== user.empId) {
        await notifyUser(
          supabase, post.author_id,
          '💬 Новый комментарий',
          `${user.name}: ${commentText.trim().slice(0, 80)}`,
          'comment'
        )
      }

      // 🔔 Уведомить упомянутых пользователей
      const mentions = [...commentText.matchAll(/@([^\s@]+)/g)].map(m => m[1])
      for (const mentionName of mentions) {
        const mentionedUser = allUsers.find(u => u.name === mentionName)
        if (mentionedUser && mentionedUser.id !== user.empId) {
          await notifyUser(
            supabase, mentionedUser.id,
            `💬 Вас упомянули в комментарии`,
            `${user.name}: ${commentText.trim().slice(0, 80)}`,
            'comment'
          )
        }
      }

      setCommentText('')
      setMentionList([])
      loadComments()
    }
    setSubmitting(false)
  }

  // ── COMPLETION REPORT ──────────────────────────────────────────────────────
  function handleReportFiles(e) {
    const newFiles = Array.from(e.target.files).slice(0, 5)
    setCompletionFiles(newFiles)
    const newPreviews = []
    for (const f of newFiles) {
      const reader = new FileReader()
      reader.onload = ev => setCompletionPreviews(prev => [...prev, ev.target.result])
      reader.readAsDataURL(f)
    }
  }

  async function submitReport() {
    if (!completionFiles.length) { showToast('Прикрепите фото', 'error'); return }
    setUploadingReport(true)
    try {
      const urls = []
      for (const f of completionFiles) {
        const ext = f.name.split('.').pop()
        const path = `reports/${postId}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('media').upload(path, f, { upsert: true })
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
          urls.push(publicUrl)
        }
      }

      await supabase.from('requests').update({
        completion_media: urls,
        status: 'completed',
      }).eq('id', postId)

      setPost(prev => ({ ...prev, completion_media: urls, status: 'completed' }))
      if (onUpdate) onUpdate({ ...post, completion_media: urls, status: 'completed' })

      // 🔔 Уведомить автора что выполнено
      if (post?.author_id) {
        await notifyUser(
          supabase, post.author_id,
          '✅ Заявка выполнена!',
          `${pad(postId)} — ${(post?.description || '').slice(0, 80)}`,
          'status_update'
        )
      }

      // 🔔 Уведомить менеджеров
      const { data: managers } = await supabase.from('users').select('id').in('role', ['admin', 'manager'])
      for (const m of managers || []) {
        if (m.id !== user.empId) {
          await notifyUser(
            supabase, m.id,
            '✅ Заявка выполнена',
            `${pad(postId)} закрыта исполнителем ${user.name}`,
            'status_update'
          )
        }
      }

      setCompletionFiles([])
      setCompletionPreviews([])
      showToast('✅ Отчёт отправлен! Статус → Выполнена')
    } catch (err) {
      showToast('Ошибка: ' + err.message, 'error')
    }
    setUploadingReport(false)
  }

  if (!post) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#fff', fontSize:14 }}>Загрузка…</div>
    </div>
  )

  const media = parseJson(post.media, [])
  const completionMedia = parseJson(post.completion_media, [])
  const changelog = parseJson(post.change_log, [])
  const st = STATUS_MAP[post.status] || STATUS_MAP.new
  const isAssigned = post.assigned_to === user?.name
  const isAuthor = post.author_id === user?.empId || post.author === user?.name

  // Highlight @mentions in comment text
  function renderCommentText(text) {
    const parts = text.split(/(@\w[\w\s]*\w|\w)/g)
    return text.split(/(@[^\s]+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        const name = part.slice(1)
        const isMe = name === user?.name
        return (
          <span key={i} style={{ color: isMe ? '#f53d2d' : '#3b82f6', fontWeight: 700, background: isMe ? 'rgba(245,61,45,.08)' : 'rgba(59,130,246,.08)', borderRadius: 4, padding: '0 3px' }}>
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div className="slide-up" style={{ background:'var(--bg2)', borderRadius:'16px 16px 0 0', width:'100%', maxWidth:520, maxHeight:'92vh', display:'flex', flexDirection:'column', borderTop:'3px solid var(--red)', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'14px 16px', borderBottom:'2px solid var(--bd)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--navy)', flexShrink:0 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'#fff', fontFamily:"'Barlow Condensed',sans-serif" }}>
            {pad(postId)} — ДЕТАЛИ
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'rgba(232,231,227,0.7)', cursor:'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:'auto', flex:1 }}>
          <div style={{ padding:'14px 16px' }}>

            {/* Author */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background: post.anonymous ? '#6b7280' : avatarColor(post.author), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16, flexShrink:0 }}>
                {post.anonymous ? '?' : initials(post.author)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, color:'var(--t1)', fontSize:15 }}>{post.anonymous ? '🎭 Аноним' : post.author}</div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>📍 {post.location||'—'} · {fmtDate(post.date||post.created_at)}</div>
              </div>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, background:`${st.color}18`, color:st.color }}>{st.label}</span>
            </div>

            {/* Type + urgency */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:999, background:post.type==='risk'?'rgba(239,68,68,.1)':'rgba(34,197,94,.1)', color:post.type==='risk'?'#dc2626':'#16a34a' }}>
                {post.type==='risk'?'⚠️ Риск':'💡 Идея'}
              </span>
              {post.type==='risk' && post.risk_urgency && (
                <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:999, background:['','rgba(239,68,68,.15)','rgba(245,158,11,.15)','rgba(34,197,94,.15)'][post.risk_urgency], color:['','#dc2626','#d97706','#16a34a'][post.risk_urgency] }}>
                  {['','🔴 Уровень 1','🟡 Уровень 2','🟢 Уровень 3'][post.risk_urgency]}
                </span>
              )}
            </div>

            {/* Description */}
            <div style={{ fontSize:14, color:'var(--t1)', lineHeight:1.7, marginBottom:14 }}>{post.description}</div>

            {/* Media */}
            {media.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', marginBottom:8 }}>📎 Медиафайлы</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {media.map((m,i) => (
                    <img key={i} src={m} onClick={() => window.open(m,'_blank')}
                      style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid var(--bd)', cursor:'pointer' }} loading="lazy" />
                  ))}
                </div>
              </div>
            )}

            {/* Admin comment */}
            {post.admin_comment && (
              <div style={{ background:'rgba(245,61,45,.05)', border:'1px solid rgba(245,61,45,.2)', borderRadius:10, padding:'10px 12px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--red)', textTransform:'uppercase', marginBottom:4 }}>💬 Комментарий администратора</div>
                <div style={{ fontSize:13, color:'var(--t2)' }}>{post.admin_comment}</div>
              </div>
            )}

            {/* Assigned + deadline */}
            {post.assigned_to && (
              <div style={{ fontSize:12, color:'var(--t3)', marginBottom:8 }}>
                👷 Исполнитель: <strong style={{ color:'var(--t1)' }}>{post.assigned_to}</strong>
              </div>
            )}
            {post.deadline && (
              <div style={{ fontSize:12, fontWeight:700, color:new Date(post.deadline)<new Date()?'#dc2626':'var(--t3)', marginBottom:14 }}>
                ⏰ Дедлайн: {fmtDate(post.deadline)}{new Date(post.deadline)<new Date()?' — ПРОСРОЧЕНО!':''}
              </div>
            )}

            {/* ── COMPLETION REPORT (for assigned user) ── */}
            {isAssigned && post.status !== 'completed' && (
              <div style={{ background:'rgba(34,197,94,.05)', border:'1px solid rgba(34,197,94,.2)', borderRadius:12, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
                  📸 Отчёт о выполнении
                </div>

                {completionPreviews.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    {completionPreviews.map((src,i) => (
                      <div key={i} style={{ position:'relative' }}>
                        <img src={src} style={{ width:64, height:64, objectFit:'cover', borderRadius:8, border:'1px solid rgba(34,197,94,.3)' }} />
                        <button onClick={() => {
                          setCompletionFiles(prev => prev.filter((_,idx)=>idx!==i))
                          setCompletionPreviews(prev => prev.filter((_,idx)=>idx!==i))
                        }} style={{ position:'absolute', top:-5, right:-5, width:16, height:16, borderRadius:'50%', background:'#ef4444', border:'none', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  <label style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, border:'1.5px dashed rgba(34,197,94,.5)', background:'transparent', color:'#16a34a', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    📎 Прикрепить фото
                    <input type="file" accept="image/*,video/*" multiple onChange={handleReportFiles} style={{ display:'none' }} />
                  </label>
                  <button onClick={submitReport} disabled={!completionFiles.length || uploadingReport}
                    style={{ flex:1, padding:9, borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity:(!completionFiles.length||uploadingReport)?.5:1 }}>
                    {uploadingReport ? '⏳ Загрузка…' : '✅ Отправить отчёт'}
                  </button>
                </div>
              </div>
            )}

            {/* Completion media (if exists) */}
            {completionMedia.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#16a34a', textTransform:'uppercase', marginBottom:8 }}>✅ Отчёт о выполнении</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {completionMedia.map((m,i) => (
                    <img key={i} src={m} onClick={() => window.open(m,'_blank')}
                      style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid rgba(34,197,94,.3)', cursor:'pointer' }} loading="lazy" />
                  ))}
                </div>
              </div>
            )}

            {/* Change log */}
            {changelog.length > 0 && (
              <div>
                <button onClick={() => setShowLogs(!showLogs)} style={{ width:'100%', padding:'8px', borderRadius:4, border:'1px solid var(--bd)', background:'var(--bg3)', color:'var(--t2)', fontSize:12, fontWeight:700, cursor:'pointer', marginBottom:showLogs?8:0 }}>
                  📋 История изменений ({changelog.length}) {showLogs?'▲':'▼'}
                </button>
                {showLogs && changelog.map((log,i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--bg3)' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--acc)', flexShrink:0, marginTop:4 }} />
                    <div>
                      <div style={{ fontSize:13, color:'var(--t1)', fontWeight:600 }}>{log.action}</div>
                      <div style={{ fontSize:11, color:'var(--t3)' }}>{log.by} · {fmtDate(log.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div style={{ borderTop:'2px solid var(--bd)' }}>
            <div style={{ padding:'8px 12px', background:'var(--bg3)', fontSize:12, fontWeight:700, color:'var(--t2)', textTransform:'uppercase', letterSpacing:'.05em' }}>
              💬 Комментарии ({comments.length})
            </div>
            <div style={{ padding:'8px 12px', minHeight:50 }}>
              {comments.length === 0 ? (
                <div style={{ textAlign:'center', padding:'16px 0', color:'var(--t4)', fontSize:12 }}>Будьте первым! 👋</div>
              ) : comments.map(c => (
                <CommentItem key={c.id} comment={c} currentUser={user} renderText={renderCommentText} />
              ))}
            </div>
          </div>
        </div>

        {/* Comment input with @mention */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid var(--bd)', flexShrink:0, position:'relative' }}>
          {/* Mention dropdown */}
          {mentionList.length > 0 && (
            <div style={{ position:'absolute', bottom:'100%', left:12, right:12, background:'var(--bg2)', border:'1px solid var(--bd)', borderRadius:10, boxShadow:'0 -4px 20px rgba(0,0,0,.15)', overflow:'hidden', zIndex:10 }}>
              {mentionList.map(u => (
                <div key={u.id} onClick={() => insertMention(u.name)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer', transition:'.1s' }}
                  onMouseOver={e => e.currentTarget.style.background='var(--bg3)'}
                  onMouseOut={e => e.currentTarget.style.background=''}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:avatarColor(u.name), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {initials(u.name)}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--t1)' }}>{u.name}</div>
                    <div style={{ fontSize:11, color:'var(--t3)' }}>{u.department}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleComment} style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, position:'relative' }}>
              <input ref={inputRef} value={commentText} onChange={handleCommentInput}
                placeholder="Комментарий… (@имя для упоминания)"
                style={{ width:'100%', padding:'10px 12px', border:'1.5px solid var(--bd)', borderRadius:10, background:'var(--bg3)', color:'var(--t1)', fontSize:13, outline:'none', fontFamily:'inherit' }}
                disabled={!user}
                onFocus={e => e.target.style.borderColor='var(--red)'}
                onBlur={e => e.target.style.borderColor='var(--bd)'}
              />
              {commentText && (
                <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:10, color:'var(--t4)' }}>
                  {commentText.length}/500
                </div>
              )}
            </div>
            <button type="submit" disabled={submitting || !commentText.trim()}
              style={{ padding:'10px 16px', borderRadius:10, border:'none', background:'var(--red)', color:'#fff', fontSize:16, fontWeight:800, cursor:'pointer', opacity:(submitting||!commentText.trim())?.5:1, transition:'.2s', flexShrink:0 }}>
              ↑
            </button>
          </form>

          {commentText.includes('@') && (
            <div style={{ fontSize:10, color:'var(--t4)', marginTop:4 }}>
              💡 Напечатайте @имя чтобы упомянуть коллегу — им придёт уведомление
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentItem({ comment, currentUser, renderText }) {
  const isMe = comment.user_id === currentUser?.empId || comment.author === currentUser?.name
  return (
    <div style={{ display:'flex', gap:10, marginBottom:12, flexDirection: isMe ? 'row-reverse' : 'row' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:avatarColor(comment.author), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:11, flexShrink:0 }}>
        {initials(comment.author)}
      </div>
      <div style={{ flex:1, maxWidth:'80%' }}>
        <div style={{ background: isMe ? 'rgba(245,61,45,.08)' : 'var(--bg3)', borderRadius: isMe ? '12px 0 12px 12px' : '0 12px 12px 12px', padding:'8px 12px', border:`1px solid ${isMe?'rgba(245,61,45,.2)':'var(--bd)'}` }}>
          <div style={{ fontSize:11, fontWeight:700, color: isMe ? 'var(--red)' : 'var(--t2)', marginBottom:3 }}>
            {isMe ? 'Вы' : comment.author}
          </div>
          <div style={{ fontSize:13, color:'var(--t1)', lineHeight:1.5 }}>
            {renderText(comment.text)}
          </div>
        </div>
        <div style={{ fontSize:10, color:'var(--t4)', marginTop:3, textAlign: isMe ? 'right' : 'left' }}>
          {fmtDate(comment.created_at)}
        </div>
      </div>
    </div>
  )
}

function parseJson(val, def) {
  if (!val) return def
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return def }
}
