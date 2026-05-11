'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'
import { ArrowRight, ExternalLink, PlayCircle, Library, Shield, Clock, Scale, LineChart, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { toEmbedUrl, isDirectVideo } from '@/lib/video-utils'

const PAGE_SIZE = 4

export default function HomePage() {
  const [config, setConfig] = useState(null)
  const [videos, setVideos] = useState([])
  const [links, setLinks] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/config').then((r) => r.json()),
      fetch('/api/videos').then((r) => r.json()),
      fetch('/api/links').then((r) => r.json()),
    ])
      .then(([c, v, l]) => {
        setConfig(c)
        setVideos(Array.isArray(v) ? v : [])
        setLinks(Array.isArray(l) ? l : [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [query, activeCategory])

  const categories = useMemo(() => {
    const set = new Set()
    videos.forEach((v) => v.category && set.add(v.category))
    return Array.from(set).sort()
  }, [videos])

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return videos.filter((v) => {
      const matchesQuery =
        !q ||
        (v.title || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q) ||
        (v.category || '').toLowerCase().includes(q)
      const matchesCat = activeCategory === 'all' || v.category === activeCategory
      return matchesQuery && matchesCat
    })
  }, [videos, query, activeCategory])

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE))
  const currentVideos = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredVideos.slice(start, start + PAGE_SIZE)
  }, [filteredVideos, page])

  const heroBg = config?.heroBackground || ''
  const heroTitle = config?.heroTitle || 'Théorie Vitaliste des Finances Publiques'
  const heroSubtitle = config?.heroSubtitle || ''
  const introText = config?.introText || ''
  const brandName = config?.brandName || 'Vitae Publica'
  const brandTagline = config?.brandTagline || 'Portail Multimédia Institutionnel'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight">{brandName}</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{brandTagline}</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#videotheque" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-block px-3 py-2">Vidéothèque</a>
            <a href="#ecosysteme" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-block px-3 py-2">Écosystème</a>
            <ThemeToggle />
            <Link href="/admin">
              <Button variant="outline" size="sm" className="gap-2">
                <Shield className="h-3.5 w-3.5" /> Admin
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: heroBg ? `url(${heroBg})` : 'none' }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/95" />
        <div className="container relative py-24 sm:py-32 md:py-40">
          <Badge variant="secondary" className="mb-6 border-white/20 bg-white/10 text-white backdrop-blur">
            <Clock className="mr-1.5 h-3 w-3" /> Paradigme temps-de-vie
          </Badge>
          <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {heroTitle}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-white/85 sm:text-xl">
            {heroSubtitle}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="#videotheque">
              <Button size="lg" className="gap-2">
                <PlayCircle className="h-5 w-5" /> Explorer la vidéothèque
              </Button>
            </a>
            <a href="#ecosysteme">
              <Button size="lg" variant="outline" className="gap-2 border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">
                <Library className="h-5 w-5" /> Accéder à l'écosystème
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Intro */}
      {introText && (
        <section className="border-b border-border/60 bg-muted/30">
          <div className="container py-14">
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <LineChart className="h-3.5 w-3.5" /> Fondements
              </div>
              <p className="text-pretty text-lg leading-relaxed text-foreground/90 sm:text-xl">
                {introText}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Vidéothèque */}
      <section id="videotheque" className="container py-20">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Section I</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Vidéothèque & Applications</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Sessions pédagogiques et démonstrations applicatives — quatre vidéos par page pour une lecture concentrée.
            </p>
          </div>
          <div className="hidden text-sm text-muted-foreground sm:block">
            {filteredVideos.length} session{filteredVideos.length > 1 ? 's' : ''} • Page {page} / {totalPages}
          </div>
        </div>

        {/* Search + Category filter */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans la vidéothèque..."
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activeCategory === 'all'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                Toutes ({videos.length})
              </button>
              {categories.map((c) => {
                const count = videos.filter((v) => v.category === c).length
                const active = activeCategory === c
                return (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }`}
                  >
                    {c} ({count})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-lg border border-border bg-muted" />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            {videos.length === 0 ? 'Aucune vidéo publiée pour le moment.' : 'Aucun résultat ne correspond à votre recherche.'}
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              {currentVideos.map((v) => (
                <Card key={v.id} className="overflow-hidden transition hover:shadow-lg">
                  <div className="aspect-video w-full bg-black">
                    {isDirectVideo(v.url) ? (
                      <video controls className="h-full w-full" src={v.url} poster={v.posterUrl || undefined} preload="metadata" />
                    ) : (
                      <iframe
                        src={toEmbedUrl(v.url)}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={v.title}
                      />
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-snug">{v.title}</CardTitle>
                      {v.category && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider">
                          {v.category}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {v.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Précédent
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={page === i + 1 ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setPage(i + 1)}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Écosystème */}
      <section id="ecosysteme" className="border-t border-border/60 bg-muted/30">
        <div className="container py-20">
          <div className="mb-10">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Section II</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Écosystème d'applications</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Accédez aux outils et publications dérivés de la théorie. Chaque lien s'ouvre dans un nouvel onglet : ce portail reste votre hub permanent.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {links.map((l) => {
              const Icon = LucideIcons[l.icon] || ExternalLink
              return (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition hover:border-primary/50 hover:shadow-md"
                >
                  {/* Image / illustration top */}
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-background">
                    {l.imageUrl ? (
                      <img
                        src={l.imageUrl}
                        alt={l.label}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/15 text-primary">
                          <Icon className="h-7 w-7" />
                        </div>
                      </div>
                    )}
                    <ExternalLink className="absolute right-3 top-3 h-4 w-4 rounded-md bg-background/80 p-0.5 text-muted-foreground backdrop-blur" />
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <div className="text-base font-semibold leading-snug">{l.label}</div>
                    </div>
                    {l.description && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                        {l.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-primary opacity-0 transition group-hover:opacity-100">
                      Ouvrir <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </a>
              )
            })}
            {links.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                Aucun lien publié.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {brandName} — Portail institutionnel.
          </div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            portail.vitae-publica.tech
          </div>
        </div>
      </footer>
    </div>
  )
}
