import 'server-only'
import https from 'https'
import fs from 'fs'

// Cliente HTTP da API PIX da EFI Pay.
// Docs: https://dev.efipay.com.br/docs/api-pix/credenciais
//
// A EFI usa mTLS: além do client_id/secret, toda requisição precisa apresentar
// o certificado da sua aplicação. Por isso usamos o módulo `https` do Node,
// que aceita certificado de cliente (o `fetch` comum não aceita).

const BASE_URL = process.env.EFI_SANDBOX === 'true'
  ? 'https://pix-h.api.efipay.com.br' // homologação (sandbox)
  : 'https://pix.api.efipay.com.br'   // produção

export function isEfiConfigured() {
  return Boolean(
    process.env.EFI_CLIENT_ID &&
    process.env.EFI_CLIENT_SECRET &&
    process.env.EFI_PIX_KEY &&
    (process.env.EFI_CERTIFICATE_BASE64 || process.env.EFI_CERTIFICATE_PATH)
  )
}

// O certificado pode vir de dois jeitos:
// - EFI_CERTIFICATE_BASE64: o arquivo .p12 em base64 (ideal na Vercel, que não tem arquivos locais)
// - EFI_CERTIFICATE_PATH: caminho para o .p12 ou para o .pem (certificado + chave no mesmo arquivo)
let agent: https.Agent | null = null
function getAgent() {
  if (agent) return agent
  const passphrase = process.env.EFI_CERTIFICATE_PASSPHRASE || ''
  const b64 = process.env.EFI_CERTIFICATE_BASE64
  const path = process.env.EFI_CERTIFICATE_PATH

  if (b64) {
    agent = new https.Agent({ pfx: Buffer.from(b64, 'base64'), passphrase })
  } else if (path) {
    const data = fs.readFileSync(path)
    agent = path.toLowerCase().endsWith('.p12')
      ? new https.Agent({ pfx: data, passphrase })
      : new https.Agent({ cert: data, key: data })
  } else {
    throw new Error('Certificado da EFI não configurado (EFI_CERTIFICATE_BASE64 ou EFI_CERTIFICATE_PATH).')
  }
  return agent
}

type EfiResponse = { status: number; data: any }

function rawRequest(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}): Promise<EfiResponse> {
  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body)
  return new Promise((resolve, reject) => {
    const req = https.request(BASE_URL + path, {
      method,
      agent: getAgent(),
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload).toString() } : {}),
        ...opts.headers
      }
    }, res => {
      let text = ''
      res.on('data', chunk => (text += chunk))
      res.on('end', () => {
        let data: any = text
        try { data = text ? JSON.parse(text) : null } catch { /* resposta não é JSON */ }
        resolve({ status: res.statusCode || 0, data })
      })
    })
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao falar com a EFI')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

// O token de acesso vale por um tempo (normalmente 1 hora). Guardamos em memória
// para não pedir um novo a cada cobrança.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value

  const basic = Buffer.from(`${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`).toString('base64')
  const res = await rawRequest('POST', '/oauth/token', {
    body: { grant_type: 'client_credentials' },
    headers: { Authorization: `Basic ${basic}` }
  })
  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`EFI: falha na autenticação (HTTP ${res.status})`)
  }
  const ttl = Number(res.data.expires_in || 3600)
  cachedToken = { value: res.data.access_token, expiresAt: Date.now() + (ttl - 60) * 1000 }
  return cachedToken.value
}

// Requisição autenticada. Lança erro com a mensagem da EFI quando algo dá errado.
export async function efiRequest(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const token = await getAccessToken()
  const res = await rawRequest(method, path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } })
  if (res.status < 200 || res.status >= 300) {
    const detail = res.data?.mensagem || res.data?.detail || res.data?.title || JSON.stringify(res.data)
    throw new Error(`EFI ${method} ${path}: HTTP ${res.status} - ${detail}`)
  }
  return res.data
}
