import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Passo 2 do upload: depois que o navegador enviou os arquivos para o Storage,
// registramos a foto no banco.
export async function POST(req: NextRequest) {
  try {
    const { event_id, filename, original_path, preview_path } = await req.json()

    if (!event_id || !filename || !original_path || !preview_path) {
      return NextResponse.json({ error: 'Dados incompletos no upload.' }, { status: 400 })
    }
    // Os caminhos precisam estar dentro da pasta do próprio evento.
    const prefix = `${event_id}/`
    if (!String(original_path).startsWith(prefix) || !String(preview_path).startsWith(prefix)) {
      return NextResponse.json({ error: 'Caminho de arquivo inválido.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('photos')
      .insert({ event_id, filename, original_path, preview_path, is_available: true })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ photo: data })
  } catch (err) {
    console.error('Erro ao registrar foto:', err)
    return NextResponse.json({ error: 'Erro ao registrar foto.' }, { status: 500 })
  }
}
