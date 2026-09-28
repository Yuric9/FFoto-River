import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ATENÇÃO: sem validação de origem (mTLS/segredo) ainda — qualquer um pode
// chamar essa URL e marcar um pedido como pago. Resolver antes de ir pra produção.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const txid = body?.pix?.[0]?.txid
    if (!txid) return NextResponse.json({ error: 'txid ausente' }, { status: 400 })
    const { error } = await supabaseAdmin.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('pix_txid', txid)
    if (error) return NextResponse.json({ error: 'Falha ao atualizar pedido' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro no webhook EFI:', err)
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
}
