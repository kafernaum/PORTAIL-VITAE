'use client'
import { useState, useRef, useCallback } from 'react'
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB

/**
 * FileDrop — drag & drop + button file uploader with chunked upload + progress bar.
 *
 * Props:
 *   - token           (string)   Admin Bearer token
 *   - accept          (string)   "image/*" or "video/*" or comma-list of mimes/extensions
 *   - kind            (string)   Label for UX ("image" or "vidéo")
 *   - maxSizeMB       (number)   Soft client cap (default 500)
 *   - currentUrl      (string)   If set & starts with /api/files/, show a Delete button
 *                                so the admin can remove an existing uploaded file from disk.
 *   - onUploaded      (fn)       Callback({url, thumbnailUrl, filename, originalName, mimeType, size}) on success
 *   - onDeleted       (fn)       Callback() after user deletes the current uploaded file
 */
export default function FileDrop({
  token,
  accept = 'image/*',
  kind = 'fichier',
  maxSizeMB = 500,
  currentUrl,
  onUploaded,
  onDeleted,
}) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // { url, originalName }
  const [deleting, setDeleting] = useState(false)

  const reset = () => {
    setUploading(false); setProgress(0); setError(null)
  }

  const isUploadedFile = typeof currentUrl === 'string' && currentUrl.startsWith('/api/files/')

  async function deleteCurrentFile() {
    if (!currentUrl) return
    const filename = currentUrl.replace(/^\/api\/files\//, '')
    if (!filename || !/^[A-Za-z0-9_.-]+$/.test(filename)) {
      toast.error('Nom de fichier invalide'); return
    }
    if (!window.confirm(`Supprimer définitivement ce ${kind === 'vidéo' ? 'fichier vidéo' : 'fichier image'} du serveur ?`)) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/files/${filename}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `Suppression échouée (${r.status})`)
      toast.success(d.posterDeleted ? 'Fichier + poster supprimés du serveur' : 'Fichier supprimé du serveur')
      setDone(null); setError(null)
      onDeleted?.()
    } catch (e) {
      toast.error(e.message || 'Erreur de suppression')
    } finally {
      setDeleting(false)
    }
  }

  const upload = useCallback(async (file) => {
    if (!file) return
    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `Fichier trop volumineux (max ${maxSizeMB} Mo)`
      setError(msg); toast.error(msg); return
    }
    reset()
    setUploading(true)
    setDone(null)
    try {
      // 1) init
      const initRes = await fetch('/api/uploads/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename: file.name, fileSize: file.size, mimeType: file.type }),
      })
      const initData = await initRes.json().catch(() => ({}))
      if (!initRes.ok) throw new Error(initData.error || `Init failed (${initRes.status})`)
      const { uploadId, totalChunks, chunkSize } = initData

      // 2) chunks sequentially
      let lastResult = null
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const blob = file.slice(start, end)
        const fd = new FormData()
        fd.append('uploadId', uploadId)
        fd.append('chunkIndex', String(i))
        fd.append('chunk', blob, file.name)
        const r = await fetch('/api/uploads/chunk', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `Chunk ${i + 1}/${totalChunks} échoué`)
        lastResult = d
        const pct = Math.round(((i + 1) / totalChunks) * 100)
        setProgress(pct)
      }

      if (!lastResult || lastResult.status !== 'completed' || !lastResult.url) {
        throw new Error("Upload terminé sans confirmation de l'assemblage.")
      }
      setUploading(false)
      setDone({ url: lastResult.url, originalName: lastResult.originalName || file.name })
      toast.success(`${kind === 'vidéo' ? 'Vidéo' : 'Image'} uploadée`)
      onUploaded?.(lastResult)
    } catch (e) {
      const msg = e?.message || 'Échec de l\'upload'
      setError(msg); toast.error(msg); setUploading(false)
    }
  }, [token, kind, maxSizeMB, onUploaded])

  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }
  const onSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) upload(f)
    // Reset input so selecting the same file again triggers upload
    e.target.value = ''
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`rounded-md border-2 border-dashed p-4 transition ${
        isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={onSelect} className="hidden" />

      {/* Existing uploaded file: show banner with delete option */}
      {isUploadedFile && !uploading && !done && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background p-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span className="truncate text-xs font-mono">{currentUrl.replace('/api/files/', '')}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={deleteCurrentFile}
            disabled={deleting}
            className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Suppression…' : 'Supprimer le fichier'}
          </Button>
        </div>
      )}

      {!uploading && !done && !error && (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm text-foreground">
            {isUploadedFile ? `Remplacer par un nouveau ${kind} :` : `Glissez-déposez votre ${kind} ici`}
          </div>
          <div className="text-xs text-muted-foreground">ou</div>
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            Choisir un fichier
          </Button>
          <div className="text-[11px] text-muted-foreground">Max {maxSizeMB} Mo</div>
        </div>
      )}

      {uploading && (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Upload en cours… {progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {done && !uploading && (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span className="truncate">{done.originalName}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={done.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Aperçu
            </a>
            <Button size="sm" variant="ghost" onClick={() => { setDone(null); reset() }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {error && !uploading && (
        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
