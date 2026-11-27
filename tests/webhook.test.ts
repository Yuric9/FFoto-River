import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const pedidos: Record<string, any> = {
  txid_ok: { id: 'p1', status: 'pending', total_amount: 96, pix_txid: 'txid_ok' }
}
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_col: string, txid: string) => ({
          single: async () => ({ data: pedidos[txid] ?? null })
        })
      })
    })
  }
}))

const syncOrderPayment = vi.fn(async (..._args: any[]) => 'paid')
vi.mock('@/lib/orders', () => ({ syncOrderPayment: (...args: any[]) => syncOrderPayment(...args) }))

import { POST } from '@/app/api/webhooks/efi/route'

const SEGREDO = 'a'.repeat(64)
function chamar(query: string, body: unknown) {
  return POST(new NextRequest(`http://localhost/api/webhooks/efi${query}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }
  }))
}
const payload = { pix: [{ txid: 'txid_ok', valor: '96.00' }] }

beforeEach(() => {
  process.env.EFI_WEBHOOK_SECRET = SEGREDO
  syncOrderPayment.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('webhook EFI', () => {
  it('sem segredo responde 401 e não toca em nenhum pedido', async () => {
    const res = await chamar('', payload)
    expect(res.status).toBe(401)
    expect(syncOrderPayment).not.toHaveBeenCalled()
  })

  it('com segredo errado responde 401', async () => {
    const res = await chamar('?hmac=errado', payload)
    expect(res.status).toBe(401)
  })

  it('se EFI_WEBHOOK_SECRET não estiver configurado, recusa tudo', async () => {
    delete process.env.EFI_WEBHOOK_SECRET
    const res = await chamar('?hmac=', payload)
    expect(res.status).toBe(401)
  })

  it('com o segredo certo, confirma o pedido consultando a EFI', async () => {
    const res = await chamar(`?hmac=${SEGREDO}&ignorar=/pix`, payload)
    expect(res.status).toBe(200)
    expect(syncOrderPayment).toHaveBeenCalledWith(pedidos.txid_ok, '96.00')
  })

  it('txid desconhecido é ignorado sem erro', async () => {
    const res = await chamar(`?hmac=${SEGREDO}`, { pix: [{ txid: 'nao_existe', valor: '1.00' }] })
    expect(res.status).toBe(200)
    expect(syncOrderPayment).not.toHaveBeenCalled()
  })

  it('payload sem pagamentos responde 400', async () => {
    const res = await chamar(`?hmac=${SEGREDO}`, {})
    expect(res.status).toBe(400)
  })

  it('se a confirmação falhar, responde 500 para a EFI tentar de novo', async () => {
    syncOrderPayment.mockRejectedValueOnce(new Error('EFI fora do ar'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await chamar(`?hmac=${SEGREDO}`, payload)
    expect(res.status).toBe(500)
  })
})
