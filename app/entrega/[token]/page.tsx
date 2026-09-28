import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function DeliveryPage({ params }: { params: { token: string } }) {
  const { data: order } = await supabaseAdmin.from('orders').select('*, order_items(*, photos(*))').eq('download_token', params.token).single()
  if (!order) return <div className="min-h-screen flex items-center justify-center p-10 text-center">Pedido não encontrado. Confira o link recebido.</div>
  if (order.status !== 'paid') return <div className="min-h-screen flex flex-col items-center justify-center p-10 text-center gap-2"><h1 className="text-xl font-black">Aguardando pagamento</h1><p className="text-zinc-400 max-w-sm">Assim que recebermos a confirmação do PIX, suas fotos aparecem aqui automaticamente. Atualize a página em alguns instantes.</p></div>
  const items: any[] = order.order_items || []
  const links = await Promise.all(items.map(async (item: any) => {
    const { data } = await supabaseAdmin.storage.from('originais').createSignedUrl(item.photos.original_path, 60 * 60)
    return { filename: item.photos.filename, url: data?.signedUrl }
  }))
  return <div className="min-h-screen p-6"><h1 className="text-2xl font-black mb-2">Suas fotos, {order.customer_name} 🎉</h1><p className="text-zinc-400 mb-6">{links.length} fotos em alta resolução. Os links expiram em 1 hora.</p><div className="grid gap-3 max-w-md">{links.map((l, i) => <a key={i} href={l.url} download className="bg-[#C6FF00] text-black font-bold px-4 py-3 rounded text-center">Baixar {l.filename}</a>)}</div></div>
}
