const API_BASE = '/api'
const TOKEN_KEY = 'tickstream:token'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | undefined,
    readonly body: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
  listeners.forEach((listener) => listener())
}

export function onTokenChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function apiUrl(path: string): string {
  return `${API_BASE}/${path.replace(/^\//, '')}`
}

export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/** Returns the raw response so callers can branch on 402 (payment required). */
export async function apiRaw(path: string, options: Options = {}): Promise<Response> {
  return fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers: {
      ...authHeaders(),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })
}

export async function parseError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`
  return new ApiError(response.status, message, typeof body.code === 'string' ? body.code : undefined, body)
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const response = await apiRaw(path, options)
  if (!response.ok) {
    const error = await parseError(response)
    if (error.status === 401 && getToken()) setToken(null)
    throw error
  }
  return (await response.json()) as T
}

export function thumbnailUrl(videoId: string): string {
  return apiUrl(`videos/${videoId}/thumbnail`)
}

/** Upload with progress. Uses XHR because fetch cannot report upload progress. */
export function uploadSource(videoId: string, file: File, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', apiUrl(`videos/${videoId}/source`))
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      let message = `Upload failed (${xhr.status})`
      try {
        const parsed = JSON.parse(xhr.responseText) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        // keep the generic message
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(file)
  })
}
