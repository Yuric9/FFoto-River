import { supabase } from '@/lib/supabase'
import GalleryClient from './gallery-client'

export const dynamic = 'force-dynamic'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const { data: event } = await supabase.from('events').select('*').eq('slug', params.slug).single()
  if (!event) return <div className="p-10">Evento não encontrado</div>

  const { data: photos } = await supabase
    .from('photos')
    .select('id, preview_path, filename')
    .eq('event_id', event.id)
    .eq('is_available', true)
    .order('created_at', { ascending: true })

  return <GalleryClient event={event} photos={photos || []} />
}
