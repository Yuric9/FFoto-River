import { supabase } from '@/lib/supabase'
import GalleryClient from './gallery-client'

export default async function EventPage({ params }: { params: { slug: string } }) {
  const { data: event } = await supabase.from('events').select('*').eq('slug', params.slug).single()
  if(!event) return <div className="p-10">Evento não encontrado</div>
  const { data: photos } = await supabase.from('photos').select('*').eq('event_id', event.id).eq('is_available', true)
  return <GalleryClient event={event} photos={photos || []} />
}