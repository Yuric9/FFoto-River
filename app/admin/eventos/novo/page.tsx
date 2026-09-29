'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NovoEventoPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [priceUnit, setPriceUnit] = useState('10')
  const [pricePack, setPricePack] = useState('8')
  const [packMinQty, setPackMinQty] = useState('10')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, date, location, price_unit: priceUnit, price_pack: pricePack, pack_min_qty: packMinQty })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar evento.'); return }
      router.push(`/admin/eventos/${data.event.id}/fotos`)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-black mb-6">Novo evento</h1>
      <form onSubmit={handleSubmit} className="max-w-md flex flex-col gap-4">
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="Título (ex: Corrida do Rio 2026)"
          value={title} onChange={e => { setTitle(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')) }} required />
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="Slug (ex: corrida-do-rio-2026)"
          value={slug} onChange={e => setSlug(e.target.value)} required />
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="Local (opcional)" value={location} onChange={e => setLocation(e.target.value)} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-zinc-500">Preço unidade (R$)</label>
            <input className="bg-zinc-900 border border-zinc-800 rounded p-3 w-full" type="number" step="0.01" value={priceUnit} onChange={e => setPriceUnit(e.target.value)} /></div>
          <div><label className="text-xs text-zinc-500">Preço pacote (R$)</label>
            <input className="bg-zinc-900 border border-zinc-800 rounded p-3 w-full" type="number" step="0.01" value={pricePack} onChange={e => setPricePack(e.target.value)} /></div>
          <div><label className="text-xs text-zinc-500">Mín. p/ pacote</label>
            <input className="bg-zinc-900 border border-zinc-800 rounded p-3 w-full" type="number" value={packMinQty} onChange={e => setPackMinQty(e.target.value)} /></div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="bg-[#C6FF00] text-black font-black py-3 rounded-full disabled:opacity-50">
          {loading ? 'Criando...' : 'Criar evento e adicionar fotos'}
        </button>
      </form>
    </div>
  )
}
