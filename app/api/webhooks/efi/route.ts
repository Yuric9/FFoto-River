import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Webhook de PIX da EFI Pay.
//
// Proteção: a URL cadastrada na EFI precisa ter o segredo, por exemplo
//   https://seusite.com/api/webhooks/efi?hmac=SEU_EFI_WEBHOOK_SECRET&ignorar=
// O "&ignorar=" é o truque indicado pela EFI: ela acrescenta "/pix" no fim da URL,
// e assim o "/pix" vira valor do parâmetro "ignorar" em vez de estragar o segredo.
//
// Mesmo com o segredo, o pedido só é marcado como pago se o valor recebido bater
// com o total do pedido e se ele ainda estiver pendente.
// TODO (PIX real): consultar GET /v2/cob/{txid} na EFI para confirmar o pagamento.

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
      .select('id, status, total_amount')
      .eq('pix_txid', pix.txid)
      .single()

    if (!order) {
      console.warn('Webhook EFI: pedido não encontrado para txid', pix.txid)
      continue
    }
    if (order.status !== 'pending') continue // já processado: ignora repetição

    if (Number(pix.valor).toFixed(2) !== Number(order.total_amount).toFixed(2)) {
      console.error('Webhook EFI: valor diferente do pedido', { txid: pix.txid, recebido: pix.valor, esperado: order.total_amount })
      continue
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'pending')
    if (error) {
      console.error('Webhook EFI: falha ao atualizar pedido', error)
      return NextResponse.json({ error: 'Falha ao atualizar pedido' }, { status: 500 })
    }
  }

  // A EFI só precisa de um 200 para saber que recebemos.
  return NextResponse.json({ ok: true })
}
