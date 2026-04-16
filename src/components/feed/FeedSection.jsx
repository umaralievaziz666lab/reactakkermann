import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, pad, fmtDate, initials, avatarColor, STATUS_MAP, PAGE_SIZE } from '../../lib/supabase.js'
import LoadingDots from '../common/LoadingDots.jsx'
import FeedCard from './FeedCard.jsx'
import DetailModal from './DetailModal.jsx'

export default function FeedSection({ user, showToast, updateUser }) {
  const [tab, setTab] = useState('all') // all | my | assigned
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [locFilter, setLocFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortFilter, setSortFilter] = useState('new')
  const [showFilters, setShowFilters] = useState(false)
  const [depts, setDepts] = useState([])
  const [detailId, setDetailId] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    loadDepts()
    loadPosts(true)
    if (user) loadLikes()
    setupRealtime()
  }, [])

  async function loadDepts() {
    const { data } = await supabase.from('departments').select('*').order('name')
    setDepts(data || [])
  }

  async function loadLikes() {
    const { data } = await supabase.from('likes').select('post_id').eq('user_id', user.empId)
    setLikedPosts(new Set((data || []).map(l => l.post_id)))
  }

  function setupRealtime() {
    const ch = supabase.channel('feed-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        setPosts(prev => [payload.new, ...prev])
        // Sound alert for level 1 risks
        if (payload.new.risk_urgency === 1 && payload.new.type === 'risk') {
          playAlertSound()
          showToast(`🚨 НОВЫЙ РИСК УРОВЕНЬ 1: ${pad(payload.new.id)} — ${payload.new.location || ''}`)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests' }, (payload) => {
        setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }

  async function loadPosts(reset = true) {
    if (reset) {
      setLoading(true)
      setOffset(0)
      setPosts([])
    } else {
      setLoadingMore(true)
    }

    const currentOffset = reset ? 0 : offset
    const { data, error } = await supabase
      .from('requests')
      .select('id,type,description,author,author_id,location,date,created_at,status,likes,comments,media,risk_urgency,risk_event_type,anonymous,assigned_to,admin_comment,completion_media,change_log,deadline')
      .order('id', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1)

    if (!error && data) {
      setPosts(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
      setOffset(currentOffset + data.length)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  // Infinite scroll
  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollHeight - scrollTop - clientHeight < 200 && hasMore && !loadingMore) {
      loadPosts(false)
    }
  }

  async function handleLike(postId) {
    if (!user) return
    const isLiked = likedPosts.has(postId)
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.empId)
      await supabase.from('requests').update({ likes: supabase.rpc('decrement', { x: 1 }) }).eq('id', postId)
      setLikedPosts(prev => { const s = new Set(prev); s.delete(postId); return s })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max(0, (p.likes || 0) - 1) } : p))
    } else {
      await supabase.from('likes').insert({ post_id: postId, user_id: user.empId })
      // Update post likes count
      const post = posts.find(p => p.id === postId)
      const newLikes = (post?.likes || 0) + 1
      await supabase.from('requests').update({ likes: newLikes }).eq('id', postId)
      setLikedPosts(prev => new Set([...prev, postId]))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p))
    }
  }

  // Filter & sort posts
  const filteredPosts = posts.filter(p => {
    if (tab === 'my' && p.author_id !== user?.empId && p.author !== user?.name) return false
    if (tab === 'assigned' && p.assigned_to !== user?.name) return false
    if (locFilter !== 'all' && p.location !== locFilter) return false
    if (typeFilter !== 'all' && p.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!String(p.id).includes(q) && !pad(p.id).toLowerCase().includes(q) &&
          !(p.description || '').toLowerCase().includes(q) &&
          !(p.author || '').toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    if (sortFilter === 'old') return new Date(a.date || a.created_at) - new Date(b.date || b.created_at)
    if (sortFilter === 'likes') return (b.likes || 0) - (a.likes || 0)
    return 0 // 'new' — already ordered by id desc from DB
  })

  const parents = depts.filter(d => !d.parent_id)
  const children = depts.filter(d => d.parent_id)

  return (
    <div onScroll={handleScroll} style={{ minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60,
        background: 'var(--navy)',
        borderBottom: '3px solid var(--red)',
        paddingTop: 'calc(env(safe-area-inset-top, 0px))',
      }}>
        <div style={{
          textAlign: 'center', padding: '10px 16px 0',
          fontSize: 16, fontWeight: 800, letterSpacing: '.15em',
          textTransform: 'uppercase', fontFamily: "'Barlow Condensed', sans-serif",
          color: '#e8e7e3',
        }}>AKKERMANN PULSE</div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '2px solid var(--bd)', background: 'var(--navy)' }}>
          {[['all','Общая лента'], ['my','Мои заявки'], ['assigned','Назначенные']].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 4px',
              fontSize: 12, fontWeight: 700,
              color: tab === t ? '#fff' : 'rgba(232,231,227,0.6)',
              background: 'none', border: 'none',
              borderBottom: `3px solid ${tab === t ? '#f53d2d' : 'transparent'}`,
              cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
              letterSpacing: '.05em', textTransform: 'uppercase',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 55, background: 'var(--bg2)', borderBottom: '2px solid var(--bd)', padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по ID, тексту, автору…"
              style={{ width: '100%', padding: '8px 12px 8px 36px', border: '1px solid var(--bd)', borderRadius: 12, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{
            flexShrink: 0, padding: '8px 12px', borderRadius: 12,
            border: `1.5px solid ${showFilters ? 'var(--red)' : 'var(--bd)'}`,
            background: showFilters ? 'rgba(245,61,45,.1)' : 'var(--bg3)',
            color: showFilters ? 'var(--red)' : 'var(--t2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4h18M7 8h10M11 12h2M9 16h6"/></svg>
            Фильтр
          </button>
        </div>

        {showFilters && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Location chips */}
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {[['all','Все участки'], ...parents.map(p => [p.name, p.name]), ...children.map(c => [c.name, `└ ${c.name}`])].map(([val, lbl]) => (
                <button key={val} onClick={() => setLocFilter(val)} style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 3,
                  border: `1.5px solid ${locFilter === val ? 'var(--red)' : 'var(--bd)'}`,
                  background: locFilter === val ? 'rgba(245,61,45,.1)' : 'var(--bg3)',
                  color: locFilter === val ? 'var(--red)' : 'var(--t2)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>{lbl}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--t1)', fontSize: 12, outline: 'none' }}>
                <option value="all">Все типы</option>
                <option value="idea">💡 Идеи</option>
                <option value="risk">⚠️ Риски</option>
              </select>
              <select value={sortFilter} onChange={e => setSortFilter(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--t1)', fontSize: 12, outline: 'none' }}>
                <option value="new">Новые</option>
                <option value="old">Старые</option>
                <option value="likes">По лайкам</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Feed list */}
      <div style={{ padding: '8px 8px', paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))' }}>
        {loading ? (
          <LoadingDots />
        ) : filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14 }}>Пока пусто — станьте первым!</div>
          </div>
        ) : (
          filteredPosts.map(post => (
            <FeedCard
              key={post.id}
              post={post}
              user={user}
              isLiked={likedPosts.has(post.id)}
              onLike={() => handleLike(post.id)}
              onDetail={() => setDetailId(post.id)}
            />
          ))
        )}
        {loadingMore && <LoadingDots style={{ padding: '20px 0' }} />}
      </div>

      {/* Detail modal */}
      {detailId && (
        <DetailModal
          postId={detailId}
          posts={posts}
          user={user}
          onClose={() => setDetailId(null)}
          onUpdate={(updated) => setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))}
          showToast={showToast}
          updateUser={updateUser}
        />
      )}
    </div>
  )
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const beep = (t, freq, dur) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'square'; osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.3, t); gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.start(t); osc.stop(t + dur)
    }
    beep(ctx.currentTime, 880, 0.12)
    beep(ctx.currentTime + 0.15, 880, 0.12)
    beep(ctx.currentTime + 0.30, 1174, 0.25)
  } catch {}
}
