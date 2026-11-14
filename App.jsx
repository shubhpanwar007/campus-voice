import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowDown, ArrowUpRight, Camera, Check, CheckCircle2,
  ChevronDown, CircleHelp, Clock3, Filter, ImagePlus, LogIn, LogOut,
  Menu, MessageSquareText, Plus, Search, ShieldCheck, Sparkles, Upload,
  UserRound, X, Zap
} from 'lucide-react'
import { isSupabaseConfigured, PHOTO_BUCKET, supabase } from './supabase'

const CATEGORIES = ['Facilities', 'Cleanliness', 'Electricity', 'Water', 'Classroom', 'Canteen', 'Internet / Wi-Fi', 'Safety', 'Other']
const statusLabel = { pending: 'Pending', in_progress: 'In progress', resolved: 'Resolved' }

function timeAgo(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  return new Date(value).toLocaleDateString()
}

function initials(email = '') {
  return email.split('@')[0].slice(0, 2).toUpperCase() || 'CV'
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authOpen, setAuthOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [authError, setAuthError] = useState('')
  const [complaints, setComplaints] = useState([])
  const [photos, setPhotos] = useState({})
  const [loading, setLoading] = useState(false)
  const [feedError, setFeedError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Facilities')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setComplaints([])
        setPhotos({})
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadComplaints()
  }, [session])

  async function loadComplaints() {
    setLoading(true)
    setFeedError('')
    const { data, error } = await supabase
      .from('complaints')
      .select('id, title, category, description, photo_path, status, created_at, user_id')
      .order('created_at', { ascending: false })
    if (error) {
      setFeedError(error.message)
      setComplaints([])
      setLoading(false)
      return
    }
    setComplaints(data || [])
    const photoEntries = await Promise.all((data || []).filter(x => x.photo_path).map(async item => {
      const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(item.photo_path, 60 * 60)
      return [item.id, signed?.signedUrl || null]
    }))
    setPhotos(Object.fromEntries(photoEntries))
    setLoading(false)
  }

  async function handleAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    setAuthMessage('')
    const action = authMode === 'login'
      ? supabase.auth.signInWithPassword({ email: email.trim(), password })
      : supabase.auth.signUp({ email: email.trim(), password })
    const { data, error } = await action
    if (error) setAuthError(error.message)
    else if (authMode === 'signup' && !data.session) {
      setAuthMessage('Account created! Check your email and confirm your address, then come back to log in.')
    } else {
      setAuthOpen(false)
      setPassword('')
    }
    setAuthBusy(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setNotice('You have been logged out.')
  }

  async function submitComplaint(event) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    let photoPath = null
    if (photo) {
      if (!photo.type.startsWith('image/')) {
        setSubmitError('Please choose an image file.')
        setSubmitting(false)
        return
      }
      if (photo.size > 5 * 1024 * 1024) {
        setSubmitError('Image must be 5 MB or smaller.')
        setSubmitting(false)
        return
      }
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      photoPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(photoPath, photo, {
        cacheControl: '3600', upsert: false, contentType: photo.type
      })
      if (uploadError) {
        setSubmitError(`Photo upload failed: ${uploadError.message}`)
        setSubmitting(false)
        return
      }
    }
    const { error } = await supabase.from('complaints').insert({
      user_id: session.user.id,
      title: title.trim(),
      category,
      description: description.trim(),
      photo_path: photoPath
    })
    if (error) {
      setSubmitError(error.message)
      setSubmitting(false)
      return
    }
    setTitle('')
    setCategory('Facilities')
    setDescription('')
    setPhoto(null)
    setModalOpen(false)
    setNotice('Your complaint has been submitted.')
    await loadComplaints()
    setSubmitting(false)
  }

  const filtered = useMemo(() => complaints.filter(item => {
    const matchesFilter = filter === 'All' || item.status === filter
    const haystack = `${item.title} ${item.category} ${item.description}`.toLowerCase()
    return matchesFilter && haystack.includes(search.toLowerCase())
  }), [complaints, filter, search])

  const counts = useMemo(() => ({
    total: complaints.length,
    pending: complaints.filter(x => x.status === 'pending').length,
    progress: complaints.filter(x => x.status === 'in_progress').length,
    resolved: complaints.filter(x => x.status === 'resolved').length
  }), [complaints])

  if (!isSupabaseConfigured) return <SetupScreen />

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><MessageSquareText size={20}/></span><span>campus<span className="brand-accent">voice</span></span></a>
        <nav className="desktop-nav"><a className="active" href="#feed">Community feed</a><a href="#how">How it works</a></nav>
        <div className="top-actions">
          {session ? <>
            <span className="user-chip"><span className="avatar">{initials(session.user.email)}</span><span className="user-email">{session.user.email}</span></span>
            <button className="icon-btn" title="Log out" onClick={handleLogout}><LogOut size={18}/></button>
          </> : <button className="btn btn-dark btn-small" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>Log in <ArrowUpRight size={16}/></button>}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot"/> THE STUDENT-POWERED CAMPUS</div>
            <h1>Your campus.<br/><span>Your voice.</span></h1>
            <p className="hero-sub">See something that needs fixing? Speak up. Share campus issues, add a photo, and help make things better for everyone.</p>
            <div className="hero-actions">
              {session
                ? <button className="btn btn-lime" onClick={() => setModalOpen(true)}><Plus size={18}/> Report an issue</button>
                : <button className="btn btn-lime" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>Join the community <ArrowUpRight size={17}/></button>}
              <a className="text-link" href="#feed">Explore complaints <ArrowDown size={16}/></a>
            </div>
            <div className="hero-note"><ShieldCheck size={15}/> Your email stays private. Your concern gets seen.</div>
          </div>
          <div className="hero-art">
            <div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/>
            <div className="art-card art-card-main"><div className="art-card-top"><span className="mini-tag">CAMPUS UPDATE</span><span className="live-dot"/></div><div className="art-illustration"><div className="sun"/><div className="building"><div/><div/><div/><div/><div/><div/></div><div className="ground"/></div><div className="art-card-bottom"><span>Small reports.<br/><b>Real improvements.</b></span><span className="art-arrow"><ArrowUpRight size={19}/></span></div></div>
            <div className="floating-note"><span className="float-icon"><Check size={16}/></span><span><b>Community first</b><small>Every voice counts</small></span></div>
            <div className="floating-sticker">MAKE<br/>IT BETTER<span>✳</span></div>
          </div>
        </section>

        <section className="stats-row" aria-label="Complaint statistics">
          <div className="stat-intro"><span className="stat-kicker">THE NOTICEBOARD</span><b>Campus issues,<br/>out in the open.</b></div>
          <div className="stat"><span className="stat-number">{session ? counts.total : '—'}</span><span>Total reports</span></div>
          <div className="stat"><span className="stat-number">{session ? counts.pending : '—'}</span><span>Awaiting attention</span></div>
          <div className="stat"><span className="stat-number">{session ? counts.resolved : '—'}</span><span>Resolved</span></div>
        </section>

        <section className="feed-section" id="feed">
          <div className="section-heading"><div><div className="eyebrow dark-eyebrow">COMMUNITY NOTICEBOARD</div><h2>What's happening<br className="mobile-break"/> on campus?</h2></div>{session && <button className="btn btn-dark report-top" onClick={() => setModalOpen(true)}><Plus size={17}/> New complaint</button>}</div>
          <div className="feed-toolbar">
            <div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search complaints..."/></div>
            <div className="filter-wrap"><Filter size={16}/><select value={filter} onChange={e => setFilter(e.target.value)}><option value="All">All reports</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><ChevronDown size={15}/></div>
          </div>

          {!session ? <div className="locked-feed"><div className="lock-icon"><ShieldCheck size={25}/></div><h3>Join to see the noticeboard</h3><p>Sign in to view reports shared by students and add your own campus concerns.</p><button className="btn btn-dark" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>Create a free account <ArrowUpRight size={16}/></button><button className="plain-btn" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>Already have an account? Log in</button></div>
            : loading ? <div className="empty-state"><div className="spinner"/><p>Loading campus reports...</p></div>
            : feedError ? <div className="error-panel"><AlertCircle size={20}/><div><b>Couldn't load complaints</b><p>{feedError}</p><small>Check that the SQL setup has been completed in Supabase.</small></div></div>
            : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon"><MessageSquareText size={25}/></div><h3>{complaints.length ? 'No matching reports' : 'The board is clear — for now.'}</h3><p>{complaints.length ? 'Try a different search or filter.' : 'Be the first to report something that could make campus life better.'}</p>{!complaints.length && <button className="btn btn-dark" onClick={() => setModalOpen(true)}><Plus size={17}/> Report the first issue</button>}</div>
            : <div className="complaint-grid">{filtered.map(item => <article className="complaint-card" key={item.id}>
                {photos[item.id] && <div className="complaint-photo"><img src={photos[item.id]} alt="Photo attached to complaint"/></div>}
                <div className="card-content"><div className="card-meta"><span className="category-pill">{item.category}</span><span className={`status status-${item.status}`}><i/>{statusLabel[item.status] || item.status}</span></div><h3>{item.title}</h3><p className="card-description">{item.description}</p><div className="card-footer"><span className="reporter"><span className="avatar tiny">{initials('student')}</span> Student report</span><span>{timeAgo(item.created_at)}</span></div></div>
              </article>)}</div>}
        </section>

        <section className="how-section" id="how"><div className="eyebrow dark-eyebrow">SIMPLE BY DESIGN</div><h2>Raise it. Share it.<br/><span>Improve it.</span></h2><div className="how-grid"><div><span className="how-number">01</span><h3>Spot an issue</h3><p>Notice a broken fan, water problem, or anything affecting campus life.</p></div><div><span className="how-number">02</span><h3>Post a report</h3><p>Describe what's happening and attach a photo so others understand.</p></div><div><span className="how-number">03</span><h3>Stay in the loop</h3><p>Students can see reports and follow their status as they move forward.</p></div></div></section>
      </main>

      <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><MessageSquareText size={18}/></span><span>campus<span className="brand-accent">voice</span></span></a><span>Made for a better campus, together.</span><span>© {new Date().getFullYear()} CampusVoice</span></footer>

      {notice && <div className="toast"><CheckCircle2 size={18}/>{notice}<button onClick={() => setNotice('')}><X size={16}/></button></div>}

      {authOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false) }}><div className="modal auth-modal"><button className="modal-close" onClick={() => setAuthOpen(false)}><X size={19}/></button><div className="modal-icon"><LogIn size={22}/></div><div className="eyebrow dark-eyebrow">WELCOME TO CAMPUSVOICE</div><h2>{authMode === 'login' ? 'Good to have you back.' : 'Join your campus community.'}</h2><p className="modal-sub">{authMode === 'login' ? 'Log in to see the student noticeboard.' : 'Create an account with your email address.'}</p><form onSubmit={handleAuth} className="form-stack"><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={6} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"/></label>{authError && <div className="inline-error">{authError}</div>}{authMessage && <div className="inline-success">{authMessage}</div>}<button className="btn btn-lime full-btn" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Create account'} <ArrowUpRight size={17}/></button></form><div className="switch-auth">{authMode === 'login' ? "New to CampusVoice?" : 'Already registered?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); setAuthMessage('') }}>{authMode === 'login' ? 'Create an account' : 'Log in'}</button></div><div className="privacy-note"><ShieldCheck size={14}/> Your email is never shown on public complaints.</div></div></div>}

      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false) }}><div className="modal complaint-modal"><button className="modal-close" onClick={() => setModalOpen(false)}><X size={19}/></button><div className="eyebrow dark-eyebrow">MAKE YOUR VOICE HEARD</div><h2>Report a campus issue.</h2><p className="modal-sub">Give the community enough detail to understand what needs attention.</p><form onSubmit={submitComplaint} className="form-stack"><label>Complaint title<input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Water cooler near Block B isn't working"/></label><label>Category<select value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Description<textarea required minLength={10} maxLength={2000} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the issue, where it is, and when you noticed it..."/></label><label className="upload-label"><span className="upload-box"><ImagePlus size={22}/><b>{photo ? photo.name : 'Add a photo (optional)'}</b><small>{photo ? `${(photo.size / 1024 / 1024).toFixed(2)} MB` : 'JPG, PNG or WEBP · Max 5 MB'}</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setPhoto(e.target.files?.[0] || null)}/></label>{photo && <button type="button" className="remove-photo" onClick={() => setPhoto(null)}><X size={14}/> Remove photo</button>}{submitError && <div className="inline-error">{submitError}</div>}<button className="btn btn-dark full-btn" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit complaint'} <ArrowUpRight size={17}/></button></form><div className="privacy-note"><ShieldCheck size={14}/> Your email stays private. Your complaint is visible to signed-in students.</div></div></div>}
    </div>
  )
}

function SetupScreen() {
  return <div className="setup-screen"><div className="setup-card"><div className="brand"><span className="brand-mark"><MessageSquareText size={20}/></span><span>campus<span className="brand-accent">voice</span></span></div><div className="setup-icon"><Zap size={24}/></div><h1>One last connection.</h1><p>The website files are ready. Add your Supabase project URL and public anon/publishable key in the Vercel environment variables to activate login, complaints and photo uploads.</p><div className="setup-code">VITE_SUPABASE_URL<br/>VITE_SUPABASE_ANON_KEY</div><p className="setup-small">Follow the included README for the exact setup steps. Never add a service-role secret key here.</p></div></div>
}