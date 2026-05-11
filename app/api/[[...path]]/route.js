import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'fs'
import { createReadStream } from 'fs'
import path from 'path'
import { getDb } from '@/lib/mongo'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vitea2025'
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const TMP_DIR = path.join(UPLOAD_DIR, '.tmp')
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB (videos)
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mov', 'm4v', 'ogg']

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4',
  ogg: 'video/ogg',
}

async function ensureDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.mkdir(TMP_DIR, { recursive: true })
}

function safeExt(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '')
  return ALLOWED_EXT.includes(ext) ? ext : null
}

function json(data, init = {}) {
  return NextResponse.json(data, init)
}

function isAuth(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token && token === ADMIN_PASSWORD
}

async function ensureDefaults(db) {
  const cfg = await db.collection('page_config').findOne({ _id: 'main' })
  if (!cfg) {
    await db.collection('page_config').insertOne({
      _id: 'main',
      heroTitle: 'Théorie Vitaliste des Finances Publiques',
      heroSubtitle: "L'impôt comme transfert de temps de vie humain — un nouveau paradigme pour le droit public et la finance.",
      heroBackground: 'https://images.unsplash.com/photo-1664725391940-e596199671b9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwxfHxjbGFzc2ljYWwlMjBwaWxsYXJzfGVufDB8fHxibHVlfDE3Nzg1MDU1MTF8MA&ixlib=rb-4.1.0&q=85',
      introText: "Le portail Vitae Publica fédère les recherches, les vidéos pédagogiques et les applications opérationnelles fondées sur le paradigme vitaliste : penser l'impôt, la dette publique et la dépense étatique comme des flux de temps de vie humain.",
      brandName: 'Vitae Publica',
      brandTagline: 'Portail Multimédia Institutionnel',
      updatedAt: new Date().toISOString(),
    })
  }
  const vidCount = await db.collection('videos').countDocuments({})
  if (vidCount === 0) {
    await db.collection('videos').insertMany([
      {
        id: uuidv4(),
        title: "Introduction à la Théorie Vitaliste",
        description: "Fondements épistémologiques : pourquoi mesurer l'impôt en heures de vie plutôt qu'en unités monétaires révèle la nature profonde de la contrainte fiscale.",
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        category: 'Théorie',
        order: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "L'impôt comme transfert de temps",
        description: "Démonstration analytique du passage de la valeur monétaire au quantum de temps de vie, et de ses implications constitutionnelles.",
        url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        category: 'Théorie',
        order: 2,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Dette publique et générations futures",
        description: "Comment l'approche vitaliste recompose la lecture de la soutenabilité de la dette en termes d'années-vies engagées.",
        url: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
        category: 'Dette publique',
        order: 3,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Applications pratiques de la théorie",
        description: "Présentation des outils analytiques opérationnels dérivés du paradigme : analyseur de dette, calculateur d'impact vitaliste, manuels techniques.",
        url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
        category: 'Applications',
        order: 4,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Réforme fiscale et indicateurs vitalistes",
        description: "Proposer une refonte des indicateurs publics fondée sur l'unité temps-de-vie : méthodologie et études de cas comparées.",
        url: 'https://www.youtube.com/watch?v=hT_nvWreIhg',
        category: 'Réforme',
        order: 5,
        createdAt: new Date().toISOString(),
      },
    ])
  }
  const linkCount = await db.collection('links').countDocuments({})
  if (linkCount === 0) {
    await db.collection('links').insertMany([
      { id: uuidv4(), label: "Analyseur de dette publique", url: 'https://example.org/analyseur-dette', icon: 'LineChart', order: 1 },
      { id: uuidv4(), label: "Manuels techniques", url: 'https://example.org/manuels', icon: 'BookOpen', order: 2 },
      { id: uuidv4(), label: "Calculateur Vitaliste", url: 'https://example.org/calculateur', icon: 'Calculator', order: 3 },
      { id: uuidv4(), label: "Publications académiques", url: 'https://example.org/publications', icon: 'GraduationCap', order: 4 },
    ])
  }
}

export async function GET(request, { params }) {
  try {
    const path_ = (params?.path || []).join('/')

    // ----- File serving (public, no DB, no auth) -----
    const fileMatch = path_.match(/^files\/([A-Za-z0-9_.-]+)$/)
    if (fileMatch) {
      const fname = fileMatch[1]
      const fullPath = path.join(UPLOAD_DIR, fname)
      const resolved = path.resolve(fullPath)
      const allowed = path.resolve(UPLOAD_DIR)
      if (!resolved.startsWith(allowed)) {
        return json({ error: 'Invalid path' }, { status: 400 })
      }
      try {
        const stat = await fs.stat(resolved)
        const ext = fname.split('.').pop().toLowerCase()
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
        const buf = await fs.readFile(resolved)
        return new NextResponse(buf, {
          headers: {
            'Content-Type': mime,
            'Content-Length': String(stat.size),
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      } catch {
        return json({ error: 'File not found' }, { status: 404 })
      }
    }

    const db = await getDb()
    await ensureDefaults(db)

    if (path_ === '' || path_ === 'health') {
      return json({ ok: true, service: 'vitae-publica' })
    }

    if (path_ === 'config') {
      const cfg = await db.collection('page_config').findOne({ _id: 'main' })
      return json(cfg || {})
    }

    if (path_ === 'videos') {
      const videos = await db.collection('videos').find({}, { projection: { _id: 0 } }).sort({ order: 1 }).toArray()
      return json(videos)
    }

    if (path_ === 'links') {
      const links = await db.collection('links').find({}, { projection: { _id: 0 } }).sort({ order: 1 }).toArray()
      return json(links)
    }

    return json({ error: 'Not found', path: path_ }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const path_ = (params?.path || []).join('/')
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    // ---------- Upload : chunk reception (multipart, auth required) ----------
    if (path_ === 'uploads/chunk') {
      if (!isAuth(request)) return json({ error: 'Unauthorized' }, { status: 401 })
      await ensureDirs()
      const form = await request.formData()
      const uploadId = String(form.get('uploadId') || '')
      const chunkIndex = parseInt(String(form.get('chunkIndex') || ''), 10)
      const chunk = form.get('chunk')
      if (!uploadId || Number.isNaN(chunkIndex) || !chunk || typeof chunk === 'string') {
        return json({ error: 'Bad chunk payload' }, { status: 400 })
      }
      if (!/^[A-Za-z0-9-]+$/.test(uploadId)) {
        return json({ error: 'Bad uploadId' }, { status: 400 })
      }
      const metaPath = path.join(TMP_DIR, `${uploadId}.json`)
      let meta
      try {
        meta = JSON.parse(await fs.readFile(metaPath, 'utf8'))
      } catch {
        return json({ error: 'Unknown upload session' }, { status: 404 })
      }
      if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
        return json({ error: 'Chunk index out of range' }, { status: 400 })
      }
      const chunkPath = path.join(TMP_DIR, `${uploadId}.chunk${chunkIndex}`)
      const buf = Buffer.from(await chunk.arrayBuffer())
      await fs.writeFile(chunkPath, buf)
      // count uploaded chunks
      const entries = await fs.readdir(TMP_DIR)
      const received = entries.filter((n) => n.startsWith(`${uploadId}.chunk`)).length
      if (received >= meta.totalChunks) {
        // assemble
        const finalName = `${uploadId}.${meta.ext}`
        const finalPath = path.join(UPLOAD_DIR, finalName)
        const out = await fs.open(finalPath, 'w')
        try {
          for (let i = 0; i < meta.totalChunks; i++) {
            const cp = path.join(TMP_DIR, `${uploadId}.chunk${i}`)
            const data = await fs.readFile(cp)
            await out.write(data)
          }
        } finally {
          await out.close()
        }
        // cleanup
        for (let i = 0; i < meta.totalChunks; i++) {
          await fs.unlink(path.join(TMP_DIR, `${uploadId}.chunk${i}`)).catch(() => {})
        }
        await fs.unlink(metaPath).catch(() => {})
        const url = `/api/files/${finalName}`
        return json({
          status: 'completed',
          url,
          filename: finalName,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
          size: meta.fileSize,
        })
      }
      return json({
        status: 'in-progress',
        received,
        totalChunks: meta.totalChunks,
        progress: Math.round((received / meta.totalChunks) * 100),
      })
    }

    // ---------- All other POST = JSON ----------
    const db = await getDb()
    const body = isMultipart ? {} : await request.json().catch(() => ({}))

    if (path_ === 'auth/login') {
      if (body.password === ADMIN_PASSWORD) {
        return json({ ok: true, token: ADMIN_PASSWORD })
      }
      return json({ ok: false, error: 'Mot de passe invalide' }, { status: 401 })
    }

    if (!isAuth(request)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Upload : initialize a chunked upload session
    if (path_ === 'uploads/init') {
      await ensureDirs()
      const originalName = String(body.filename || '')
      const fileSize = Number(body.fileSize || 0)
      const mimeType = String(body.mimeType || '')
      const ext = safeExt(originalName)
      if (!ext) return json({ error: "Type de fichier non autorisé" }, { status: 400 })
      if (!fileSize || fileSize > MAX_FILE_SIZE) {
        return json({ error: `Fichier trop volumineux (max ${Math.round(MAX_FILE_SIZE/1024/1024)} Mo)` }, { status: 400 })
      }
      const uploadId = uuidv4()
      const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE))
      const meta = { uploadId, originalName, fileSize, mimeType, ext, totalChunks, createdAt: Date.now() }
      await fs.writeFile(path.join(TMP_DIR, `${uploadId}.json`), JSON.stringify(meta))
      return json({ uploadId, totalChunks, chunkSize: CHUNK_SIZE })
    }

    if (path_ === 'videos') {
      const doc = {
        id: uuidv4(),
        title: body.title || 'Sans titre',
        description: body.description || '',
        url: body.url || '',
        category: body.category || '',
        order: typeof body.order === 'number' ? body.order : 999,
        createdAt: new Date().toISOString(),
      }
      await db.collection('videos').insertOne(doc)
      delete doc._id
      return json(doc)
    }

    if (path_ === 'videos/reorder') {
      const items = Array.isArray(body.items) ? body.items : []
      const ops = items
        .filter((x) => x && x.id)
        .map((x) => ({
          updateOne: { filter: { id: x.id }, update: { $set: { order: Number(x.order) || 0 } } },
        }))
      if (ops.length) await db.collection('videos').bulkWrite(ops)
      return json({ ok: true, updated: ops.length })
    }

    if (path_ === 'links/reorder') {
      const items = Array.isArray(body.items) ? body.items : []
      const ops = items
        .filter((x) => x && x.id)
        .map((x) => ({
          updateOne: { filter: { id: x.id }, update: { $set: { order: Number(x.order) || 0 } } },
        }))
      if (ops.length) await db.collection('links').bulkWrite(ops)
      return json({ ok: true, updated: ops.length })
    }

    if (path_ === 'links') {
      const doc = {
        id: uuidv4(),
        label: body.label || 'Lien',
        url: body.url || '#',
        icon: body.icon || 'ExternalLink',
        imageUrl: body.imageUrl || '',
        description: body.description || '',
        order: typeof body.order === 'number' ? body.order : 999,
      }
      await db.collection('links').insertOne(doc)
      delete doc._id
      return json(doc)
    }

    return json({ error: 'Not found', path: path_ }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    if (!isAuth(request)) return json({ error: 'Unauthorized' }, { status: 401 })
    const db = await getDb()
    const path_ = (params?.path || []).join('/')
    const body = await request.json().catch(() => ({}))

    if (path_ === 'config') {
      const update = {
        heroTitle: body.heroTitle,
        heroSubtitle: body.heroSubtitle,
        heroBackground: body.heroBackground,
        introText: body.introText,
        brandName: body.brandName,
        brandTagline: body.brandTagline,
        updatedAt: new Date().toISOString(),
      }
      Object.keys(update).forEach((k) => update[k] === undefined && delete update[k])
      await db.collection('page_config').updateOne({ _id: 'main' }, { $set: update }, { upsert: true })
      const cfg = await db.collection('page_config').findOne({ _id: 'main' })
      return json(cfg)
    }

    const m = path_.match(/^videos\/(.+)$/)
    if (m) {
      const id = m[1]
      const update = {}
      ;['title', 'description', 'url', 'category', 'order'].forEach((k) => {
        if (body[k] !== undefined) update[k] = body[k]
      })
      await db.collection('videos').updateOne({ id }, { $set: update })
      const doc = await db.collection('videos').findOne({ id }, { projection: { _id: 0 } })
      return json(doc)
    }

    const ml = path_.match(/^links\/(.+)$/)
    if (ml) {
      const id = ml[1]
      const update = {}
      ;['label', 'url', 'icon', 'imageUrl', 'description', 'order'].forEach((k) => {
        if (body[k] !== undefined) update[k] = body[k]
      })
      await db.collection('links').updateOne({ id }, { $set: update })
      const doc = await db.collection('links').findOne({ id }, { projection: { _id: 0 } })
      return json(doc)
    }

    return json({ error: 'Not found', path: path_ }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isAuth(request)) return json({ error: 'Unauthorized' }, { status: 401 })
    const db = await getDb()
    const path_ = (params?.path || []).join('/')

    const m = path_.match(/^videos\/(.+)$/)
    if (m) {
      await db.collection('videos').deleteOne({ id: m[1] })
      return json({ ok: true })
    }
    const ml = path_.match(/^links\/(.+)$/)
    if (ml) {
      await db.collection('links').deleteOne({ id: ml[1] })
      return json({ ok: true })
    }
    return json({ error: 'Not found', path: path_ }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}
