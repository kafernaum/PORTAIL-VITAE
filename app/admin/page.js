'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Lock, LogOut, Plus, Trash2, Save, Video as VideoIcon, Link as LinkIcon, Settings, ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeToggle } from '@/components/theme-toggle'

function useToken() {
  const [token, setToken] = useState(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(window.localStorage.getItem('vp_token'))
    }
  }, [])
  const save = (t) => {
    setToken(t)
    if (typeof window !== 'undefined') window.localStorage.setItem('vp_token', t)
  }
  const clear = () => {
    setToken(null)
    if (typeof window !== 'undefined') window.localStorage.removeItem('vp_token')
  }
  return { token, save, clear }
}

function api(path, opts = {}, token) {
  return fetch(`/api/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
    return data
  })
}

export default function AdminPage() {
  const { token, save, clear } = useToken()
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      }).then((r) => r.json())
      if (res.token) {
        save(res.token)
        toast.success('Connexion réussie')
      } else {
        toast.error(res.error || 'Échec de connexion')
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle>Administration Vitea Publica</CardTitle>
            <CardDescription>Accès réservé. Saisissez le mot de passe administrateur.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Mot de passe</Label>
                <Input id="pw" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
              <div className="text-center">
                <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
                  ← Retour au portail
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Dashboard token={token} onLogout={clear} />
}

function Dashboard({ token, onLogout }) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Portail
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <div className="text-sm font-semibold">Administration Vitea Publica</div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={onLogout} className="gap-2">
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-10">
        <Tabs defaultValue="videos" className="space-y-6">
          <TabsList>
            <TabsTrigger value="videos" className="gap-2"><VideoIcon className="h-4 w-4" /> Vidéos</TabsTrigger>
            <TabsTrigger value="links" className="gap-2"><LinkIcon className="h-4 w-4" /> Liens & Écosystème</TabsTrigger>
            <TabsTrigger value="config" className="gap-2"><Settings className="h-4 w-4" /> Interface</TabsTrigger>
          </TabsList>
          <TabsContent value="videos"><VideosManager token={token} /></TabsContent>
          <TabsContent value="links"><LinksManager token={token} /></TabsContent>
          <TabsContent value="config"><ConfigManager token={token} /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function VideosManager({ token }) {
  const [videos, setVideos] = useState([])
  const [editing, setEditing] = useState(null)
  const blank = { title: '', description: '', url: '', order: 1 }
  const [form, setForm] = useState(blank)

  async function load() {
    try {
      const data = await api('videos', {}, token)
      setVideos(data)
    } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  async function save() {
    try {
      if (!form.title || !form.url) return toast.error('Titre et URL requis')
      const payload = { ...form, order: Number(form.order) || 1 }
      if (editing) {
        await api(`videos/${editing}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
        toast.success('Vidéo mise à jour')
      } else {
        await api('videos', { method: 'POST', body: JSON.stringify(payload) }, token)
        toast.success('Vidéo ajoutée')
      }
      setForm(blank); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }

  async function remove(id) {
    if (!confirm('Supprimer cette vidéo ?')) return
    try {
      await api(`videos/${id}`, { method: 'DELETE' }, token)
      toast.success('Supprimée'); load()
    } catch (e) { toast.error(e.message) }
  }

  function edit(v) {
    setEditing(v.id)
    setForm({ title: v.title, description: v.description, url: v.url, order: v.order })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? 'Modifier la vidéo' : 'Ajouter une vidéo'}</CardTitle>
          <CardDescription>URL YouTube, Vimeo, iframe embed ou fichier .mp4</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="space-y-1"><Label>URL / Embed</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-1"><Label>Ordre d'affichage</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> {editing ? 'Enregistrer' : 'Ajouter'}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(blank) }}>Annuler</Button>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Vidéos publiées ({videos.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {videos.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucune vidéo.</div>}
          {videos.map((v) => (
            <div key={v.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">#{v.order}</span><div className="truncate font-medium">{v.title}</div></div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{v.url}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(v)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function LinksManager({ token }) {
  const [links, setLinks] = useState([])
  const [editing, setEditing] = useState(null)
  const blank = { label: '', url: '', icon: 'ExternalLink', order: 1 }
  const [form, setForm] = useState(blank)

  async function load() {
    try { setLinks(await api('links', {}, token)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() }, [])

  async function save() {
    try {
      if (!form.label || !form.url) return toast.error('Label et URL requis')
      const payload = { ...form, order: Number(form.order) || 1 }
      if (editing) {
        await api(`links/${editing}`, { method: 'PUT', body: JSON.stringify(payload) }, token)
        toast.success('Lien mis à jour')
      } else {
        await api('links', { method: 'POST', body: JSON.stringify(payload) }, token)
        toast.success('Lien ajouté')
      }
      setForm(blank); setEditing(null); load()
    } catch (e) { toast.error(e.message) }
  }
  async function remove(id) {
    if (!confirm('Supprimer ce lien ?')) return
    try { await api(`links/${id}`, { method: 'DELETE' }, token); toast.success('Supprimé'); load() } catch (e) { toast.error(e.message) }
  }
  function edit(l) { setEditing(l.id); setForm({ label: l.label, url: l.url, icon: l.icon, order: l.order }) }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? 'Modifier le lien' : 'Ajouter un lien'}</CardTitle>
          <CardDescription>Nom de l'icône Lucide (ex: LineChart, BookOpen, Calculator, GraduationCap, Library, FileText)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div className="space-y-1"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
          <div className="space-y-1"><Label>Icône (Lucide)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
          <div className="space-y-1"><Label>Ordre</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} /></div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> {editing ? 'Enregistrer' : 'Ajouter'}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(blank) }}>Annuler</Button>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Liens publiés ({links.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {links.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Aucun lien.</div>}
          {links.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">#{l.order}</span><div className="truncate font-medium">{l.label}</div><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{l.icon}</span></div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{l.url}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(l)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ConfigManager({ token }) {
  const [cfg, setCfg] = useState(null)
  async function load() { try { setCfg(await api('config', {}, token)) } catch (e) { toast.error(e.message) } }
  useEffect(() => { load() }, [])
  async function save() {
    try {
      await api('config', { method: 'PUT', body: JSON.stringify(cfg) }, token)
      toast.success('Interface mise à jour')
    } catch (e) { toast.error(e.message) }
  }
  if (!cfg) return <div className="text-sm text-muted-foreground">Chargement...</div>
  const set = (k, v) => setCfg({ ...cfg, [k]: v })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuration de l'interface publique</CardTitle>
        <CardDescription>Personnalisez l'identité du portail sans toucher au code source.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1"><Label>Nom de la marque</Label><Input value={cfg.brandName || ''} onChange={(e) => set('brandName', e.target.value)} /></div>
          <div className="space-y-1"><Label>Tagline</Label><Input value={cfg.brandTagline || ''} onChange={(e) => set('brandTagline', e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label>Titre du Hero</Label><Input value={cfg.heroTitle || ''} onChange={(e) => set('heroTitle', e.target.value)} /></div>
        <div className="space-y-1"><Label>Sous-titre du Hero</Label><Textarea rows={2} value={cfg.heroSubtitle || ''} onChange={(e) => set('heroSubtitle', e.target.value)} /></div>
        <div className="space-y-1"><Label>Image de fond du Hero (URL)</Label><Input value={cfg.heroBackground || ''} onChange={(e) => set('heroBackground', e.target.value)} /></div>
        {cfg.heroBackground && (
          <div className="overflow-hidden rounded-md border border-border">
            <img src={cfg.heroBackground} alt="Aperçu" className="h-40 w-full object-cover" />
          </div>
        )}
        <div className="space-y-1"><Label>Texte d'introduction</Label><Textarea rows={4} value={cfg.introText || ''} onChange={(e) => set('introText', e.target.value)} /></div>
        <div className="pt-2"><Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Enregistrer</Button></div>
      </CardContent>
    </Card>
  )
}
