import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { syncOrderPayment } from '@/lib/orders'

export const dynamic = 'force-dynamic'

// A página do cliente chama esta rota a cada poucos segundos enquanto espera o PIX.
// Se o pedido ainda está pendente, consultamos a EFI: assim o pagamento é
// confirmado mesmo se o webhook atrasar ou falhar (por exemplo, rodando no seu
// computador, onde a EFI não consegue chamar o webhook).
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, pix_txid')
    .eq('download_token', params.token)
    .single()

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  try {
    const status = await syncOrderPayment(order)
    return NextResponse.json({ status })
  } catch (err) {
    console.error('Erro ao consultar pagamento:', err)
    return NextResponse.json({ status: order.status })
  }
}
