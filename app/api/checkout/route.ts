import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, calcTotal } from '@/lib/supabase'
import { createPixCharge } from '@/lib/payments'

export async function POST(req: NextRequest) {
  try {
    const { event_id, photo_ids, customer } = await req.json()

    if (!event_id || !Array.isArray(photo_ids) || photo_ids.length === 0) {
      return NextResponse.json({ error: 'Selecione ao menos uma foto.' }, { status: 400 })
    }
    if (!customer?.name || !customer?.email || !customer?.whatsapp) {
      return NextResponse.json({ error: 'Preencha nome, e-mail e WhatsApp.' }, { status: 400 })
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events').select('*').eq('id', event_id).single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
    }

    const total = calcTotal(photo_ids.length, Number(event.price_unit), Number(event.price_pack), Number(event.pack_min_qty))

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        event_id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_whatsapp: customer.whatsapp,
        photo_count: photo_ids.length,
        total_amount: total,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('Erro ao criar pedido:', orderError)
      return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 })
    }

    const price = photo_ids.length >= event.pack_min_qty ? event.price_pack : event.price_unit
    const items = photo_ids.map((pid: string) => ({ order_id: order.id, photo_id: pid, price_paid: price }))

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(items)
    if (itemsError) {
      console.error('Erro ao registrar itens do pedido:', itemsError)
      return NextResponse.json({ error: 'Não foi possível registrar as fotos do pedido.' }, { status: 500 })
    }

    const pix = await createPixCharge(order.id, total, customer.name)
    await supabaseAdmin.from('orders').update({ pix_txid: pix.txid, pix_qrcode: pix.copiaECola }).eq('id', order.id)

    return NextResponse.json({ orderId: order.id, downloadToken: order.download_token, pix })
  } catch (err) {
    console.error('Erro no checkout:', err)
    return NextResponse.json({ error: 'Erro interno ao processar o checkout.' }, { status: 500 })
  }
}
