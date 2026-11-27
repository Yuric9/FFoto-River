import { NextResponse } from 'next/server'
import { getPixWebhook, isPixSimulado, registerPixWebhook } from '@/lib/payments'

export const dynamic = 'force-dynamic'

// Rota protegida pelo login do /admin (middleware.ts).

// GET: mostra qual URL de webhook está cadastrada na EFI (sem revelar o segredo)
export async function GET() {
  if (isPixSimulado()) return NextResponse.json({ error: 'EFI não configurada (modo simulado).' }, { status: 400 })
  try {
    const data = await getPixWebhook()
    const url = String(data.webhookUrl || '').replace(/hmac=[^&]+/, 'hmac=***')
    return NextResponse.json({ webhookUrl: url, criacao: data.criacao })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}

// POST: cadastra (ou atualiza) o webhook usando SITE_URL + EFI_WEBHOOK_SECRET
export async function POST() {
  if (isPixSimulado()) return NextResponse.json({ error: 'EFI não configurada (modo simulado).' }, { status: 400 })

  const site = (process.env.SITE_URL || '').replace(/\/$/, '')
  const secret = process.env.EFI_WEBHOOK_SECRET
  if (!site.startsWith('https://')) {
    return NextResponse.json({ error: 'Defina SITE_URL com https:// (a EFI só aceita webhook em HTTPS).' }, { status: 400 })
  }
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: 'Defina EFI_WEBHOOK_SECRET com pelo menos 32 caracteres.' }, { status: 400 })
  }

  // "&ignorar=": a EFI acrescenta "/pix" no fim da URL; assim ele vira valor desse parâmetro.
  const webhookUrl = `${site}/api/webhooks/efi?hmac=${encodeURIComponent(secret)}&ignorar=`
  try {
    await registerPixWebhook(webhookUrl)
    return NextResponse.json({ ok: true, webhookUrl: webhookUrl.replace(/hmac=[^&]+/, 'hmac=***') })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }
}
