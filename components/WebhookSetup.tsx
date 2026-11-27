'use client'
import { useState } from 'react'

// Botão do painel admin para cadastrar/conferir o webhook PIX na EFI.
export default function WebhookSetup() {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function call(method: 'GET' | 'POST') {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/efi/webhook', { method })
      const data = await res.json()
      setMsg(res.ok ? `Webhook: ${data.webhookUrl}` : `Erro: ${data.error}`)
    } catch {
      setMsg('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded p-4 max-w-2xl mb-6">
      <h2 className="font-bold mb-1">Webhook PIX (EFI)</h2>
      <p className="text-zinc-400 text-sm mb-3">Faça isso uma vez depois de publicar o site, para a EFI avisar quando um PIX for pago.</p>
      <div className="flex gap-3 flex-wrap">
        <button disabled={loading} onClick={() => call('POST')} className="bg-[#C6FF00] text-black font-bold px-4 py-2 rounded-full text-sm disabled:opacity-50">
          Cadastrar webhook
        </button>
        <button disabled={loading} onClick={() => call('GET')} className="border border-zinc-700 px-4 py-2 rounded-full text-sm disabled:opacity-50">
          Ver webhook atual
        </button>
      </div>
      {msg && <p className="text-sm mt-3 break-all text-zinc-300">{msg}</p>}
    </div>
  )
}
