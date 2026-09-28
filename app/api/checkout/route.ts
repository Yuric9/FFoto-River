import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, calcTotal } from '@/lib/supabase'
import { createPixCharge } from '@/lib/payments'

export async function POST(req: NextRequest) {
  const { event_id, photo_ids, customer } = await req.json()
  const { data: event } = await supabaseAdmin.from('events').select('*').eq('id', event_id).single()
  const total = calcTotal(photo_ids.length, Number(event.price_unit), Number(event.price_pack), Number(event.pack_min_qty))
  
  const { data: order } = await supabaseAdmin.from('orders').insert({
    event_id,
    customer_name: customer.name,
    customer_email: customer.email,
    customer_whatsapp: customer.whatsapp,
    photo_count: photo_ids.length,
    total_amount: total,
    status: 'pending'
  }).select().single()

  for (const pid of photo_ids) {
    const price = photo_ids.length >= event.pack_min_qty ? event.price_pack : event.price_unit
    await supabaseAdmin.from('order_items').insert({ order_id: order.id, photo_id: pid, price_paid: price })
  }

  const pix = await createPixCharge(order.id, total, customer.name)
  await supabaseAdmin.from('orders').update({ pix_txid: pix.txid, pix_qrcode: pix.copiaECola }).eq('id', order.id)

  return NextResponse.json({ orderId: order.id, downloadToken: order.download_token, pix })
}