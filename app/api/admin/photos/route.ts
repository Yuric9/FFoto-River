import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const eventId = form.get('event_id') as string
    const filename = form.get('filename') as string
    const original = form.get('original') as File
    const preview = form.get('preview') as File

    if (!eventId || !filename || !original || !preview) {
      return NextResponse.json({ error: 'Dados incompletos no upload.' }, { status: 400 })
    }

    const uid = crypto.randomUUID()
    const originalPath = `${eventId}/${uid}-${filename}`
    const previewPath = `${eventId}/${uid}-preview.jpg`

    const { error: upErr1 } = await supabaseAdmin.storage
      .from('originais')
      .upload(originalPath, original, { contentType: original.type, upsert: false })
    if (upErr1) return NextResponse.json({ error: `Falha ao subir original: ${upErr1.message}` }, { status: 500 })

    const { error: upErr2 } = await supabaseAdmin.storage
      .from('provas')
      .upload(previewPath, preview, { contentType: 'image/jpeg', upsert: false })
    if (upErr2) return NextResponse.json({ error: `Falha ao subir prévia: ${upErr2.message}` }, { status: 500 })

    const { data, error } = await supabaseAdmin
      .from('photos')
      .insert({ event_id: eventId, filename, original_path: originalPath, preview_path: previewPath, is_available: true })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ photo: data })
  } catch (err) {
    console.error('Erro no upload de foto:', err)
    return NextResponse.json({ error: 'Erro ao processar upload.' }, { status: 500 })
  }
}
