export function toEmbedUrl(input) {
  if (!input) return ''
  const url = String(input).trim()
  // YouTube
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  if (m) return `https://www.youtube.com/embed/${m[1]}`
  // Vimeo
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (m) return `https://player.vimeo.com/video/${m[1]}`
  // Already an embed or iframe src
  return url
}

export function isDirectVideo(url) {
  if (!url) return false
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url)
}
