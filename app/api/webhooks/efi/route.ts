import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncOrderPayment } from '@/lib/orders'

// Webhook de PIX da EFI Pay.
//
// Proteção: a URL cadastrada na EFI precisa ter o segredo, por exemplo
//   https://seusite.com/api/webhooks/efi?hmac=SEU_EFI_WEBHOOK_SECRET&ignorar=
// O "&ignorar=" é o truque indicado pela EFI: ela acrescenta "/pix" no fim da URL,
// e assim o "/pix" vira valor do parâmetro "ignorar" em vez de estragar o segredo.
//
// Mesmo com o segredo, não confiamos no conteúdo recebido: para cada txid,
// consultamos a cobrança direto na EFI (syncOrderPayment) antes de liberar as fotos.

function secretIsValid(received: string | null) {
  const expected = process.env.EFI_WEBHOOK_SECRET
  if (!expected || !received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!secretIsValid(req.nextUrl.searchParams.get('hmac'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // A EFI pode mandar vários pagamentos na mesma chamada.
  const pagamentos: any[] = Array.isArray(body?.pix) ? body.pix : []
  if (pagamentos.length === 0) {
    return NextResponse.json({ error: 'Nenhum pagamento no payload' }, { status: 400 })
  }

  for (const pix of pagamentos) {
    if (!pix?.txid) continue

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_amount, pix_txid')
      .eq('pix_txid', pix.txid)
      .single()

    if (!order) {
      console.warn('Webhook EFI: pedido não encontrado para txid', pix.txid)
      continue
    }

    try {
      await syncOrderPayment(order, pix.valor)
    } catch (err) {
      console.error('Webhook EFI: erro ao confirmar pagamento', err)
      // 500 faz a EFI tentar de novo mais tarde
      return NextResponse.json({ error: 'Falha ao confirmar pagamento' }, { status: 500 })
    }
  }

  // A EFI só precisa de um 200 para saber que recebemos.
  return NextResponse.json({ ok: true })
}
