'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <CheckoutForm />
    </Suspense>
  )
}

function CheckoutForm() {
  const params = useSearchParams()
  const eventId = params.get('event') || ''
  const photoIds = (params.get('photos') || '').split(',').filter(Boolean)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (photoIds.length === 0) {
      setError('Nenhuma foto selecionada. Volte para a galeria e escolha as fotos.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, photo_ids: photoIds, customer: { name, email, whatsapp } })
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Erro ao gerar pagamento.')
      else setResult(data)
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <h1 className="text-2xl font-black">Pedido criado! 🎉</h1>
        <p className="text-zinc-400">Escaneie o QR Code no seu banco ou copie o código PIX abaixo para pagar.</p>
        <div className="bg-white p-4 rounded-lg break-all text-black text-xs max-w-sm">{result.pix.copiaECola}</div>
        <p className="text-sm text-zinc-500 max-w-sm">
          Assim que o pagamento for confirmado, suas fotos estarão disponíveis em{' '}
          <a href={`/entrega/${result.downloadToken}`} className="text-[#C6FF00] underline">este link</a>. Salve o link!
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-xl font-black">Finalizar pedido</h1>
        <p className="text-zinc-400 text-sm">{photoIds.length} fotos selecionadas</p>
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} required />
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="bg-zinc-900 border border-zinc-800 rounded p-3" placeholder="WhatsApp (com DDD)" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="bg-[#C6FF00] text-black font-black py-3 rounded-full disabled:opacity-50">
          {loading ? 'Gerando PIX...' : 'Gerar pagamento PIX'}
        </button>
      </form>
    </div>
  )
}
