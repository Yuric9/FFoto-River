import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseAdmin.from('events').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })
  return NextResponse.json({ event: data })
}
