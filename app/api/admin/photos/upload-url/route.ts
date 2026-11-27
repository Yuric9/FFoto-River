import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { BUCKET_ORIGINAIS, BUCKET_PROVAS, presignUpload } from '@/lib/storage'

// Passo 1 do upload: gera URLs assinadas para o navegador enviar os arquivos
// direto para o Cloudflare R2. Assim as fotos grandes não passam pela
// nossa API (a Vercel limita o corpo da requisição a ~4,5 MB).
export async function POST(req: NextRequest) {
  try {
    const { event_id, filename, content_type } = await req.json()
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

    // Só aceitamos imagens; o tipo vai assinado no link e o navegador precisa repeti-lo.
    const originalType = /^image\/[a-z0-9.+-]+$/i.test(String(content_type)) ? String(content_type) : 'image/jpeg'

    const [originalUrl, previewUrl] = await Promise.all([
      presignUpload(BUCKET_ORIGINAIS, originalPath, originalType),
      presignUpload(BUCKET_PROVAS, previewPath, 'image/jpeg')
    ])

    return NextResponse.json({
      original: { path: originalPath, url: originalUrl, contentType: originalType },
      preview: { path: previewPath, url: previewUrl, contentType: 'image/jpeg' }
    })
  } catch (err) {
    console.error('Erro ao gerar URL de upload:', err)
    return NextResponse.json({ error: 'Erro ao preparar upload.' }, { status: 500 })
  }
}
