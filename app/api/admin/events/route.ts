import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { title, slug, date, location, price_unit, price_pack, pack_min_qty } = await req.json()

    if (!title || !slug || !date) {
      return NextResponse.json({ error: 'Preencha título, slug e data.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        title,
        slug: String(slug).toLowerCase().trim().replace(/\s+/g, '-'),
        date,
        location: location || null,
        price_unit: Number(price_unit) || 0,
        price_pack: Number(price_pack) || 0,
        pack_min_qty: Number(pack_min_qty) || 1,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe um evento com esse slug.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ event: data })
  } catch (err) {
    console.error('Erro ao criar evento:', err)
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 400 })
  }
}
