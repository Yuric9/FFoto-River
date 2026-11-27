'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  downloadToken: string
  copiaECola: string
  qrcodeImage?: string | null
  simulado?: boolean
}

const INTERVALO_MS = 4000
const DESISTIR_APOS_MS = 20 * 60 * 1000 // para de consultar depois de 20 minutos

// Mostra o QR Code / copia e cola e fica consultando o status do pedido.
// Quando o pagamento é confirmado, leva o cliente para a página de entrega.
export default function PixPayment({ downloadToken, copiaECola, qrcodeImage, simulado }: Props) {
  const router = useRouter()
  const [copiado, setCopiado] = useState(false)
  const [esperando, setEsperando] = useState(true)

  useEffect(() => {
    const inicio = Date.now()
    let ativo = true

    async function verificar() {
      if (!ativo) return
      if (Date.now() - inicio > DESISTIR_APOS_MS) { setEsperando(false); return }
      try {
        const res = await fetch(`/api/orders/${downloadToken}/status`, { cache: 'no-store' })
        const data = await res.json()
        if (data.status === 'paid') {
          router.replace(`/entrega/${downloadToken}`)
          router.refresh()
          return
        }
      } catch { /* sem internet: tenta de novo no próximo ciclo */ }
      setTimeout(verificar, INTERVALO_MS)
    }

    const t = setTimeout(verificar, INTERVALO_MS)
    return () => { ativo = false; clearTimeout(t) }
  }, [downloadToken, router])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(copiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch { /* navegador sem permissão: o código continua visível para copiar à mão */ }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      {simulado && (
        <p className="text-xs bg-yellow-400/10 border border-yellow-400/30 text-yellow-200 rounded px-3 py-2">
          Modo de teste: este PIX é simulado e não pode ser pago.
        </p>
      )}
      {qrcodeImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrcodeImage} alt="QR Code PIX" className="w-56 h-56 bg-white p-2 rounded-lg" />
      )}
      <div className="bg-white p-3 rounded-lg break-all text-black text-xs w-full max-h-28 overflow-auto">{copiaECola}</div>
      <button onClick={copiar} className="bg-[#C6FF00] text-black font-black py-3 rounded-full w-full">
        {copiado ? 'Código copiado ✓' : 'Copiar código PIX'}
      </button>
      {esperando ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#C6FF00] animate-pulse" />
          Aguardando pagamento... a página atualiza sozinha.
        </p>
      ) : (
        <button onClick={() => router.refresh()} className="text-sm text-zinc-400 underline">
          Já paguei: verificar de novo
        </button>
      )}
    </div>
  )
}
