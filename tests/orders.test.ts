import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Dublês (mocks) do banco e da EFI -----------------------------------
// Não falamos com o Supabase nem com a EFI de verdade: substituímos as funções
// e conferimos se o código chama o que deveria.
const updateCalls: any[] = []
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: () => ({
      update: (values: any) => {
        const filtros: any[] = []
        const chain: any = {
          eq: (col: string, val: any) => {
            filtros.push([col, val])
            if (filtros.length === 2) { updateCalls.push({ values, filtros }); return Promise.resolve({ error: null }) }
            return chain
          }
        }
        return chain
      }
    })
  }
}))

const pix = { simulado: false, status: { pago: false, status: 'ATIVA', valorPago: null as number | null } }
vi.mock('@/lib/payments', () => ({
  isPixSimulado: () => pix.simulado,
  getPixStatus: vi.fn(async () => pix.status)
}))

import { syncOrderPayment } from '@/lib/orders'
import { getPixStatus } from '@/lib/payments'

const pedido = { id: 'pedido-1', status: 'pending', total_amount: '96.00', pix_txid: 'abc123' }

beforeEach(() => {
  updateCalls.length = 0
  pix.simulado = false
  pix.status = { pago: false, status: 'ATIVA', valorPago: null }
  vi.mocked(getPixStatus).mockClear()
})

describe('syncOrderPayment (modo real)', () => {
  it('PIX ainda não pago: continua pendente e não altera o banco', async () => {
    expect(await syncOrderPayment(pedido)).toBe('pending')
    expect(updateCalls).toHaveLength(0)
  })

  it('PIX pago com o valor certo: marca como pago', async () => {
    pix.status = { pago: true, status: 'CONCLUIDA', valorPago: 96 }
    expect(await syncOrderPayment(pedido)).toBe('paid')
    expect(updateCalls[0].values.status).toBe('paid')
    // só atualiza se ainda estiver pendente (evita marcar duas vezes)
    expect(updateCalls[0].filtros).toContainEqual(['status', 'pending'])
  })

  it('PIX pago com valor diferente: NÃO libera as fotos', async () => {
    pix.status = { pago: true, status: 'CONCLUIDA', valorPago: 1 }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await syncOrderPayment(pedido)).toBe('pending')
    expect(updateCalls).toHaveLength(0)
  })

  it('ignora o valor enviado pelo webhook: quem manda é a consulta na EFI', async () => {
    // alguém manda um webhook dizendo que pagou 96, mas a EFI diz que não foi pago
    expect(await syncOrderPayment(pedido, '96.00')).toBe('pending')
    expect(getPixStatus).toHaveBeenCalledWith('abc123')
  })

  it('pedido que já foi pago não consulta a EFI de novo', async () => {
    expect(await syncOrderPayment({ ...pedido, status: 'paid' })).toBe('paid')
    expect(getPixStatus).not.toHaveBeenCalled()
  })
})

describe('syncOrderPayment (modo simulado)', () => {
  beforeEach(() => { pix.simulado = true })

  it('sem valor informado (consulta da página), continua pendente', async () => {
    expect(await syncOrderPayment(pedido)).toBe('pending')
  })

  it('com o valor certo vindo do webhook de teste, marca como pago', async () => {
    expect(await syncOrderPayment(pedido, '96.00')).toBe('paid')
  })
})
