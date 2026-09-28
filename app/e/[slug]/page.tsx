import { supabase, supabaseAdmin } from '@/lib/supabase'
import GalleryClient from './gallery-client'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const { data: event } = await supabase.from('events').select('*').eq('slug', params.slug).single()
  if (!event) return <div className="p-10">Evento não encontrado</div>

  let { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', event.id)
    .eq('is_available', true)

  // Seed local-only para o evento de teste. Remover antes de produção.
  if (process.env.NODE_ENV !== 'production' && event.slug === 'evento-teste-ffoto-river' && !photos?.length) {
    await supabaseAdmin.from('photos').insert({
      event_id: event.id,
      original_path: '/test-photo.svg',
      preview_path: '/test-photo.svg',
      filename: 'test-photo.svg',
      is_available: true
    })

    const result = await supabase
      .from('photos')
      .select('*')
      .eq('event_id', event.id)
      .eq('is_available', true)

    photos = result.data
  }

  return <GalleryClient event={event} photos={photos || []} />
}
