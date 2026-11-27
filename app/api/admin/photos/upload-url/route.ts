import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Passo 1 do upload: gera URLs assinadas para o navegador enviar os arquivos
// direto para o Supabase Storage. Assim as fotos grandes não passam pela
// nossa API (a Vercel limita o corpo da requisição a ~4,5 MB).
export async function POST(req: NextRequest) {
  try {
    const { event_id, filename } = await req.json()
    if (!event_id || !filename) {
      return NextResponse.json({ error: 'Informe o evento e o nome do arquivo.' }, { status: 400 })
    }

    const { data: event } = await supabaseAdmin.from('events').select('id').eq('id', event_id).single()
    if (!event) return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 })

    // Usamos só a extensão do nome original: o Storage não aceita alguns caracteres.
    const ext = (String(filename).match(/\.([a-zA-Z0-9]{1,5})$/)?.[1] || 'jpg').toLowerCase()
    const uid = crypto.randomUUID()
    const originalPath = `${event.id}/${uid}.${ext}`
    const previewPath = `${event.id}/${uid}-preview.jpg`

    const [orig, prev] = await Promise.all([
      supabaseAdmin.storage.from('originais').createSignedUploadUrl(originalPath),
      supabaseAdmin.storage.from('provas').createSignedUploadUrl(previewPath)
    ])
    if (orig.error || prev.error) {
      return NextResponse.json({ error: (orig.error || prev.error)!.message }, { status: 500 })
    }

    return NextResponse.json({
      original: { path: originalPath, token: orig.data.token },
      preview: { path: previewPath, token: prev.data.token }
    })
  } catch (err) {
    console.error('Erro ao gerar URL de upload:', err)
    return NextResponse.json({ error: 'Erro ao preparar upload.' }, { status: 500 })
  }
}
