'use client'
import { useState } from 'react'
import { calcTotal } from '@/lib/pricing'

export default function GalleryClient({ event, photos }: any) {
  const [cart, setCart] = useState<string[]>([])
  const toggle = (id: string) => setCart(prev => prev.includes(id) ? prev.filter(i=>i!==id) : [...prev, id])
  const total = calcTotal(cart.length, Number(event.price_unit), Number(event.price_pack), Number(event.pack_min_qty))

  return (
    <>
      <header className="sticky top-0 z-10 bg-[#0A0A0A]/90 backdrop-blur p-4 flex justify-between items-center border-b border-zinc-800">
        <h1 className="font-black tracking-widest">FFOTO RIVER • {event.title}</h1>
        <div className="text-sm">{cart.length} fotos</div>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 p-1">
        {photos.map((p: any) => (
          <div key={p.id} className="relative aspect-[3/4] bg-zinc-900 overflow-hidden group">
            <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/provas/${p.preview_path}`} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="rotate-[-30deg] border-2 border-white/20 text-white/30 font-black p-2">PROVA - FFOTO RIVER</span>
            </div>
            <button onClick={()=>toggle(p.id)} className={`absolute bottom-2 right-2 rounded-full px-3 py-1 text-sm font-bold ${cart.includes(p.id) ? 'bg-[#C6FF00] text-black' : 'bg-white text-black'}`}>
              {cart.includes(p.id) ? '✓' : '+'}
            </button>
          </div>
        ))}
      </div>
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 flex justify-between items-center">
          <div>
            <div className="font-bold">{cart.length} fotos • R$ {total.toFixed(2)}</div>
            {cart.length >= event.pack_min_qty && <div className="text-xs text-[#C6FF00]">Pacote ativado! R$ {event.price_pack}/foto</div>}
          </div>
          <a href={`/checkout?event=${event.id}&photos=${cart.join(',')}`} className="bg-[#C6FF00] text-black px-6 py-3 rounded-full font-black">FINALIZAR</a>
        </div>
      )}
    </>
  )
}
