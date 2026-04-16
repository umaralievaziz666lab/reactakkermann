import React, { useState, useEffect } from 'react'
import { supabase, lvlInfo, LEVELS, fmtDate, pad } from '../../lib/supabase.js'
import Avatar from '../common/Avatar.jsx'
import LoadingDots from '../common/LoadingDots.jsx'

export default function ProfileSection({ user, updateUser, isDark, toggleDark, onLogout, showToast, clearProfileBadge }) {
  const [leaderboard, setLeaderboard] = useState([])
  const [tasks, setTasks] = useState([])
  const [achievements, setAchievements] = useState([])
  const [myPosts, setMyPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stats') // stats | leaderboard | achievements | training
  const [showReferral, setShowReferral] = useState(false)

  useEffect(() => {
    clearProfileBadge()
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadLeaderboard(), loadAchievements(), loadMyPosts()])
    setLoading(false)
  }

  async function loadLeaderboard() {
    const { data } = await supabase.from('users').select('id,name,department,points,profile_pic').order('points', { ascending: false }).limit(20)
    setLeaderboard(data || [])
  }

  async function loadAchievements() {
    const { data } = await supabase.from('achievements').select('*').order('target')
    setAchievements(data || [])
  }

  async function loadMyPosts() {
    if (!user) return
    const { data } = await supabase.from('requests').select('id,type,status,likes,date').or(`author_id.eq.${user.empId},author.eq.${user.name}`).order('id', { ascending: false }).limit(100)
    setMyPosts(data || [])
  }

  async function handleTrainingComplete(answers) {
    const correct = answers.tq1 === 'idea' && answers.tq2 === 'profile'
    if (!correct) { showToast('Неверные ответы, попробуйте ещё раз', 'error'); return }
    await supabase.from('users').update({ is_trained: true, points: (user.points || 0) + 40 }).eq('id', user.empId)
    updateUser({ isTrained: true, points: (user.points || 0) + 40 })
    showToast('🎓 Тренинг пройден! +40 ТОП')
  }

  const lv = lvlInfo(user?.points || 0)
  const nextLv = LEVELS[LEVELS.findIndex(l => l.cls === lv.cls) + 1]
  const progress = nextLv ? Math.round(((user?.points - lv.min) / (lv.max - lv.min)) * 100) : 100
  const myRank = leaderboard.findIndex(u => u.id === user?.empId) + 1

  const ideas = myPosts.filter(p => p.type === 'idea').length
  const risks = myPosts.filter(p => p.type === 'risk').length
  const totalLikes = myPosts.reduce((s, p) => s + (p.likes || 0), 0)
  const completed = myPosts.filter(p => p.status === 'completed').length

  return (
    <div style={{ paddingBottom: 'calc(74px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Profile Header */}
      <div style={{ background: 'var(--navy)', borderBottom: '3px solid var(--red)', padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Avatar name={user?.name} src={user?.profilePic} size={72} />
            {user?.isTrained && (
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="11" height="11" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#e8e7e3' }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(232,231,227,0.6)', marginTop: 2 }}>{user?.department}</div>
            <div style={{ marginTop: 6 }}>
              <span className={`level-badge ${lv.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                {lv.label}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f53d2d' }}>{user?.points || 0}</div>
            <div style={{ fontSize: 10, color: 'rgba(232,231,227,0.5)', textTransform: 'uppercase' }}>ТОП</div>
            {myRank > 0 && <div style={{ fontSize: 11, color: 'rgba(232,231,227,0.5)', marginTop: 2 }}>#{myRank} рейтинг</div>}
          </div>
        </div>

        {/* Progress bar */}
        {nextLv && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(232,231,227,0.5)', marginBottom: 4 }}>
              <span>{lv.label}</span>
              <span>{nextLv.label}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: 'linear-gradient(90deg,#f53d2d,#c42b1c)', transition: 'width .5s' }} />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(232,231,227,0.4)', marginTop: 3, textAlign: 'center' }}>
              {nextLv.min - (user?.points || 0)} ТОП до следующего уровня
            </div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '12px 12px 0' }}>
        {[
          { label: 'Идей', value: ideas, icon: '💡' },
          { label: 'Рисков', value: risks, icon: '⚠️' },
          { label: 'Лайков', value: totalLikes, icon: '❤️' },
          { label: 'Решено', value: completed, icon: '✅' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 4, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', padding: '12px 12px 0', gap: 6 }}>
        {[['stats','⚙️ Профиль'], ['leaderboard','🏆 Рейтинг'], ['achievements','🏅 Достижения'], ['training','🎓 Тренинг']].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 3,
            border: `1.5px solid ${tab === t ? 'var(--red)' : 'var(--bd)'}`,
            background: tab === t ? 'rgba(245,61,45,.1)' : 'var(--bg3)',
            color: tab === t ? 'var(--red)' : 'var(--t2)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: 12 }}>
        {loading ? <LoadingDots /> : (
          <>
            {tab === 'stats' && <StatsTab user={user} isDark={isDark} toggleDark={toggleDark} onLogout={onLogout} showReferral={() => setShowReferral(true)} showToast={showToast} updateUser={updateUser} />}
            {tab === 'leaderboard' && <LeaderboardTab leaderboard={leaderboard} user={user} />}
            {tab === 'achievements' && <AchievementsTab achievements={achievements} user={user} myPosts={myPosts} />}
            {tab === 'training' && <TrainingTab user={user} onComplete={handleTrainingComplete} />}
          </>
        )}
      </div>

      {showReferral && <ReferralModal user={user} onClose={() => setShowReferral(false)} showToast={showToast} />}
    </div>
  )
}

function StatsTab({ user, isDark, toggleDark, onLogout, showReferral, showToast, updateUser }) {
  const [editMode, setEditMode] = useState(false)
  const [phone, setPhone] = useState(user?.phone || '')
  const [email, setEmail] = useState(user?.email || '')

  async function saveProfile() {
    await supabase.from('users').update({ phone, email }).eq('id', user.empId)
    updateUser({ phone, email })
    setEditMode(false)
    showToast('Профиль обновлён')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Profile info */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase' }}>Контактные данные</span>
          <button onClick={() => setEditMode(!editMode)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--acc)', fontWeight: 700, cursor: 'pointer' }}>
            {editMode ? 'Отмена' : '✏️ Изменить'}
          </button>
        </div>
        <div style={{ padding: 14 }}>
          <InfoRow label="Табельный номер" value={user?.empId} />
          <InfoRow label="ФИО" value={user?.name} />
          <InfoRow label="Участок" value={user?.department} />
          {editMode ? (
            <>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Телефон</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--bg3)', color: 'var(--t1)', fontSize: 13, outline: 'none' }} />
              </div>
              <button onClick={saveProfile} style={{ width: '100%', padding: 9, borderRadius: 4, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сохранить</button>
            </>
          ) : (
            <>
              <InfoRow label="Телефон" value={user?.phone || '—'} />
              <InfoRow label="Email" value={user?.email || '—'} />
              <InfoRow label="Telegram" value={user?.telegramUsername ? `@${user.telegramUsername}` : '—'} />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {[
        { label: '🎁 Реферальная программа', action: showReferral },
        { label: isDark ? '☀️ Светлая тема' : '🌙 Тёмная тема', action: toggleDark },
        { label: '🚪 Выйти', action: onLogout, danger: true },
      ].map(({ label, action, danger }) => (
        <button key={label} onClick={action} style={{
          width: '100%', padding: '13px 16px', borderRadius: 4,
          border: `1px solid ${danger ? '#fecaca' : 'var(--bd)'}`,
          background: danger ? '#fef2f2' : 'var(--bg2)',
          color: danger ? '#ef4444' : 'var(--t1)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
        }}>{label}</button>
      ))}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--bg3)' }}>
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{value}</span>
    </div>
  )
}

function LeaderboardTab({ leaderboard, user }) {
  const rankStyle = (rank) => {
    if (rank === 0) return { background: 'rgba(251,191,36,.15)', borderColor: 'rgba(251,191,36,.4)' }
    if (rank === 1) return { background: 'rgba(156,163,175,.12)', borderColor: 'rgba(156,163,175,.35)' }
    if (rank === 2) return { background: 'rgba(249,115,22,.12)', borderColor: 'rgba(249,115,22,.3)' }
    return {}
  }
  const medals = ['🥇','🥈','🥉']

  return (
    <div>
      {leaderboard.map((u, i) => {
        const isMe = u.id === user?.empId
        const lv = lvlInfo(u.points || 0)
        return (
          <div key={u.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 4, border: '1px solid var(--bd)',
            marginBottom: 6, background: 'var(--bg3)',
            borderLeft: isMe ? '3px solid var(--red)' : '3px solid var(--bd)',
            ...rankStyle(i),
          }}>
            <div style={{ fontSize: i < 3 ? 22 : 14, fontWeight: 700, color: 'var(--t3)', width: 28, textAlign: 'center' }}>
              {i < 3 ? medals[i] : `#${i+1}`}
            </div>
            <Avatar name={u.name} src={u.profile_pic} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? 'var(--red)' : 'var(--t1)' }}>{u.name} {isMe && '(Вы)'}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>{u.department} · <span className={`level-badge ${lv.cls}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999 }}>{lv.label}</span></div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>{u.points || 0}</div>
          </div>
        )
      })}
    </div>
  )
}

function AchievementsTab({ achievements, user, myPosts }) {
  const completed = user?.completedAchievements || []
  const myLikes = myPosts.reduce((s, p) => s + (p.likes || 0), 0)

  function getProgress(ach) {
    const target = ach.target || 1
    let val = 0
    if (ach.target_type === 'posts') val = myPosts.length
    if (ach.target_type === 'ideas') val = myPosts.filter(p => p.type === 'idea').length
    if (ach.target_type === 'risks') val = myPosts.filter(p => p.type === 'risk').length
    if (ach.target_type === 'likes') val = myLikes
    if (ach.target_type === 'points') val = user?.points || 0
    return Math.min(100, Math.round((val / target) * 100))
  }

  return (
    <div>
      {achievements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t3)' }}>Достижения загружаются…</div>
      ) : achievements.map(ach => {
        const done = completed.includes(ach.id)
        const prog = done ? 100 : getProgress(ach)
        return (
          <div key={ach.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 4, border: '1px solid var(--bd)',
            marginBottom: 7, background: 'var(--bg3)',
            opacity: done ? 1 : 0.8,
          }}>
            <div style={{ fontSize: 28, width: 36, textAlign: 'center' }}>{done ? (ach.icon || '🏅') : '🔒'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: done ? 'var(--t1)' : 'var(--t3)' }}>{ach.title}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)' }}>+{ach.points} ТОП</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 5 }}>{ach.description}</div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--bd)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${prog}%`, borderRadius: 999, background: done ? '#22c55e' : 'linear-gradient(90deg,#f53d2d,#c42b1c)', transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>{done ? '✅ Выполнено' : `${prog}%`}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TrainingTab({ user, onComplete }) {
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  if (user?.isTrained) return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>Тренинг пройден!</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 6 }}>Вы успешно прошли обучение по системе безопасности</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 4, padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>📚 Инструкция по системе</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
          <p><strong>💡 Идея</strong> — предложение по улучшению рабочих процессов, условий труда или безопасности.</p>
          <p><strong>⚠️ Риск</strong> — обнаруженная опасность или нарушение требований безопасности.</p>
          <p>За каждую публикацию начисляются баллы <strong>ТОП</strong>. Копите баллы и повышайте уровень!</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 4, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>📝 Тест</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--t1)', marginBottom: 8 }}>1. Какой тип заявки для предложения улучшений?</div>
          {['risk','idea'].map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', cursor: 'pointer', marginBottom: 6 }}>
              <input type="radio" name="tq1" value={v} checked={answers.tq1 === v} onChange={() => setAnswers(a => ({ ...a, tq1: v }))} />
              {v === 'risk' ? '⚠️ Риск' : '💡 Идея'}
            </label>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--t1)', marginBottom: 8 }}>2. Где посмотреть баллы и уровень?</div>
          {['feed','profile'].map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)', cursor: 'pointer', marginBottom: 6 }}>
              <input type="radio" name="tq2" value={v} checked={answers.tq2 === v} onChange={() => setAnswers(a => ({ ...a, tq2: v }))} />
              {v === 'feed' ? '📋 Лента' : '👤 Профиль'}
            </label>
          ))}
        </div>

        <button
          onClick={() => { setSubmitted(true); onComplete(answers) }}
          disabled={!answers.tq1 || !answers.tq2}
          style={{
            width: '100%', padding: 11, borderRadius: 4, border: 'none',
            background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            opacity: (!answers.tq1 || !answers.tq2) ? .5 : 1,
          }}
        >Завершить тест +40 ТОП</button>
      </div>
    </div>
  )
}

function ReferralModal({ user, onClose, showToast }) {
  const refCode = `REF_${user?.empId}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(refCode)
      showToast('Код скопирован!')
    } catch {
      const el = document.createElement('textarea')
      el.value = refCode; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
      showToast('Код скопирован!')
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div className="slide-up" style={{ background: 'var(--bg2)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 440, padding: 24, borderTop: '3px solid var(--red)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎁</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)' }}>Пригласи коллегу — получи ТОП!</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 6 }}>За каждого коллегу по твоему коду — <strong style={{ color: 'var(--acc)' }}>50 ТОП</strong></div>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>Твой реферальный код</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, fontSize: 20, fontWeight: 800, color: 'var(--acc)', fontFamily: 'monospace', letterSpacing: '.1em' }}>{refCode}</div>
            <button onClick={copy} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--red)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Копировать</button>
          </div>
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: 12, borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg3)', color: 'var(--t2)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Закрыть</button>
      </div>
    </div>
  )
}
