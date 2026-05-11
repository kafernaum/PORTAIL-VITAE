import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vitea2025'

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
      introText: "Le portail Vitea Publica fédère les recherches, les vidéos pédagogiques et les applications opérationnelles fondées sur le paradigme vitaliste : penser l'impôt, la dette publique et la dépense étatique comme des flux de temps de vie humain.",
      brandName: 'Vitea Publica',
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
        order: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "L'impôt comme transfert de temps",
        description: "Démonstration analytique du passage de la valeur monétaire au quantum de temps de vie, et de ses implications constitutionnelles.",
        url: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        order: 2,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Dette publique et générations futures",
        description: "Comment l'approche vitaliste recompose la lecture de la soutenabilité de la dette en termes d'années-vies engagées.",
        url: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
        order: 3,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Applications pratiques de la théorie",
        description: "Présentation des outils analytiques opérationnels dérivés du paradigme : analyseur de dette, calculateur d'impact vitaliste, manuels techniques.",
        url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
        order: 4,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        title: "Réforme fiscale et indicateurs vitalistes",
        description: "Proposer une refonte des indicateurs publics fondée sur l'unité temps-de-vie : méthodologie et études de cas comparées.",
        url: 'https://www.youtube.com/watch?v=hT_nvWreIhg',
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
    const db = await getDb()
    await ensureDefaults(db)
    const path = (params?.path || []).join('/')

    if (path === '' || path === 'health') {
      return json({ ok: true, service: 'vitea-publica' })
    }

    if (path === 'config') {
      const cfg = await db.collection('page_config').findOne({ _id: 'main' })
      return json(cfg || {})
    }

    if (path === 'videos') {
      const videos = await db.collection('videos').find({}, { projection: { _id: 0 } }).sort({ order: 1 }).toArray()
      return json(videos)
    }

    if (path === 'links') {
      const links = await db.collection('links').find({}, { projection: { _id: 0 } }).sort({ order: 1 }).toArray()
      return json(links)
    }

    return json({ error: 'Not found', path }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const db = await getDb()
    const path = (params?.path || []).join('/')
    const body = await request.json().catch(() => ({}))

    if (path === 'auth/login') {
      if (body.password === ADMIN_PASSWORD) {
        return json({ ok: true, token: ADMIN_PASSWORD })
      }
      return json({ ok: false, error: 'Mot de passe invalide' }, { status: 401 })
    }

    if (!isAuth(request)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (path === 'videos') {
      const doc = {
        id: uuidv4(),
        title: body.title || 'Sans titre',
        description: body.description || '',
        url: body.url || '',
        order: typeof body.order === 'number' ? body.order : 999,
        createdAt: new Date().toISOString(),
      }
      await db.collection('videos').insertOne(doc)
      return json(doc)
    }

    if (path === 'links') {
      const doc = {
        id: uuidv4(),
        label: body.label || 'Lien',
        url: body.url || '#',
        icon: body.icon || 'ExternalLink',
        order: typeof body.order === 'number' ? body.order : 999,
      }
      await db.collection('links').insertOne(doc)
      return json(doc)
    }

    return json({ error: 'Not found', path }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    if (!isAuth(request)) return json({ error: 'Unauthorized' }, { status: 401 })
    const db = await getDb()
    const path = (params?.path || []).join('/')
    const body = await request.json().catch(() => ({}))

    if (path === 'config') {
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

    const m = path.match(/^videos\/(.+)$/)
    if (m) {
      const id = m[1]
      const update = {}
      ;['title', 'description', 'url', 'order'].forEach((k) => {
        if (body[k] !== undefined) update[k] = body[k]
      })
      await db.collection('videos').updateOne({ id }, { $set: update })
      const doc = await db.collection('videos').findOne({ id }, { projection: { _id: 0 } })
      return json(doc)
    }

    const ml = path.match(/^links\/(.+)$/)
    if (ml) {
      const id = ml[1]
      const update = {}
      ;['label', 'url', 'icon', 'order'].forEach((k) => {
        if (body[k] !== undefined) update[k] = body[k]
      })
      await db.collection('links').updateOne({ id }, { $set: update })
      const doc = await db.collection('links').findOne({ id }, { projection: { _id: 0 } })
      return json(doc)
    }

    return json({ error: 'Not found', path }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isAuth(request)) return json({ error: 'Unauthorized' }, { status: 401 })
    const db = await getDb()
    const path = (params?.path || []).join('/')

    const m = path.match(/^videos\/(.+)$/)
    if (m) {
      await db.collection('videos').deleteOne({ id: m[1] })
      return json({ ok: true })
    }
    const ml = path.match(/^links\/(.+)$/)
    if (ml) {
      await db.collection('links').deleteOne({ id: ml[1] })
      return json({ ok: true })
    }
    return json({ error: 'Not found', path }, { status: 404 })
  } catch (e) {
    return json({ error: e.message }, { status: 500 })
  }
}
