// GitHub Contents API client for the private `trainer-data` repo.
// Same approach as SkyLog's githubBackup.js, but one file per record.

const API = 'https://api.github.com'

export function isConfigured(cfg) {
  return Boolean(cfg?.owner && cfg?.repo && cfg?.token)
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

const encodePath = p => p.split('/').map(encodeURIComponent).join('/')

async function request(cfg, method, path, body) {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodePath(path)}` +
    (method === 'GET' ? `?ref=${encodeURIComponent(cfg.branch || 'main')}` : '')
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { ...headers(cfg.token), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 404 && method === 'GET') return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const e = new Error(err.message || `GitHub error ${res.status}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

/** → { sha, text } or null when the file doesn't exist. */
export async function getFile(cfg, path) {
  const file = await request(cfg, 'GET', path)
  if (!file || Array.isArray(file)) return null
  return { sha: file.sha, text: fromBase64(file.content || '') }
}

/** → [{ name, path, sha, type }] or [] when the folder doesn't exist. */
export async function listDir(cfg, path) {
  const items = await request(cfg, 'GET', path)
  return Array.isArray(items) ? items : []
}

/** Create or overwrite a file. Looks up the current sha first; retries once on a race. */
export async function writeFile(cfg, path, text, message, attempt = 0) {
  const existing = await request(cfg, 'GET', path)
  if (existing && !Array.isArray(existing) && fromBase64(existing.content || '') === text) return existing.sha
  try {
    const res = await request(cfg, 'PUT', path, {
      message,
      content: toBase64(text),
      branch: cfg.branch || 'main',
      ...(existing?.sha ? { sha: existing.sha } : {}),
    })
    return res.content.sha
  } catch (e) {
    if ((e.status === 409 || e.status === 422) && attempt === 0) return writeFile(cfg, path, text, message, 1)
    throw e
  }
}

/** Checks the token can read and write the repo. */
export async function testConnection(cfg) {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(cfg.token), cache: 'no-store' })
  if (res.status === 404) throw new Error('Repo not found — check owner/name, and that the token has access to it.')
  if (res.status === 401) throw new Error('Token rejected — it may be expired or mistyped.')
  if (!res.ok) throw new Error(`GitHub error ${res.status}`)
  const repo = await res.json()
  if (repo.permissions && !repo.permissions.push) throw new Error('Token can read but not write. Give it "Contents: Read and write".')
  return { private: repo.private, defaultBranch: repo.default_branch }
}
