import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calcTotal } from '@/lib/pricing'
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
      .from('events').select('*').eq('id', event_id).eq('is_active', true).single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
    }

    // Remove IDs repetidos e confere se todas as fotos são deste evento e estão à venda.
    // Sem isso, daria para comprar fotos de outro evento (ou já retiradas) por este preço.
    const uniqueIds = Array.from(new Set(photo_ids.map(String)))
    const { data: validPhotos, error: photosError } = await supabaseAdmin
      .from('photos')
      .select('id')
      .eq('event_id', event.id)
      .eq('is_available', true)
      .in('id', uniqueIds)

    if (photosError || !validPhotos || validPhotos.length !== uniqueIds.length) {
      return NextResponse.json({ error: 'Algumas fotos selecionadas não estão mais disponíveis.' }, { status: 400 })
    }

    const qtd = uniqueIds.length
    const total = calcTotal(qtd, Number(event.price_unit), Number(event.price_pack), Number(event.pack_min_qty))
    const price = qtd >= Number(event.pack_min_qty) ? Number(event.price_pack) : Number(event.price_unit)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        event_id: event.id,
        customer_name: String(customer.name).trim(),
        customer_email: String(customer.email).trim().toLowerCase(),
        customer_whatsapp: String(customer.whatsapp).trim(),
        photo_count: qtd,
        total_amount: total,
        status: 'pending'
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('Erro ao criar pedido:', orderError)
      return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 500 })
    }

    const items = uniqueIds.map(pid => ({ order_id: order.id, photo_id: pid, price_paid: price }))
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(items)
    if (itemsError) {
      console.error('Erro ao registrar itens do pedido:', itemsError)
      await supabaseAdmin.from('orders').delete().eq('id', order.id)
      return NextResponse.json({ error: 'Não foi possível registrar as fotos do pedido.' }, { status: 500 })
    }

    let pix
    try {
      pix = await createPixCharge(order.id, total)
    } catch (err) {
      console.error('Erro ao gerar PIX:', err)
      await supabaseAdmin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      return NextResponse.json({ error: 'Não foi possível gerar o PIX agora. Tente novamente em instantes.' }, { status: 502 })
    }
    await supabaseAdmin.from('orders').update({ pix_txid: pix.txid, pix_qrcode: pix.copiaECola }).eq('id', order.id)

    return NextResponse.json({ orderId: order.id, downloadToken: order.download_token, pix })
  } catch (err) {
    console.error('Erro no checkout:', err)
    return NextResponse.json({ error: 'Erro interno ao processar o checkout.' }, { status: 500 })
  }
}
