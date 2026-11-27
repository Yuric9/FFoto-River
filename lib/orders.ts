import 'server-only'
import { supabaseAdmin } from './supabase-admin'
import { getPixStatus, isPixSimulado } from './payments'

type PendingOrder = {
  id: string
  status: string
  total_amount: number | string
  pix_txid: string | null
}

const mesmoValor = (a: number | string, b: number | string) =>
  Number(a).toFixed(2) === Number(b).toFixed(2)

/**
 * Confere na EFI se o pedido foi pago e, se foi, marca como "paid".
 * Usado pelo webhook e pela página do cliente (que consulta de tempos em tempos).
 *
 * `valorInformado` só é usado no MODO SIMULADO (desenvolvimento), em que não existe
 * cobrança real para consultar: aí confiamos no valor enviado ao webhook de teste.
 *
 * Retorna o status final do pedido.
 */
export async function syncOrderPayment(order: PendingOrder, valorInformado?: number | string): Promise<string> {
  if (order.status !== 'pending' || !order.pix_txid) return order.status

  let valorPago: number | string | null = null
  if (isPixSimulado()) {
    if (valorInformado === undefined) return 'pending'
    valorPago = valorInformado
  } else {
    const pix = await getPixStatus(order.pix_txid)
    if (!pix.pago) return 'pending'
    valorPago = pix.valorPago
  }

  if (valorPago === null || !mesmoValor(valorPago, order.total_amount)) {
    console.error('Pagamento com valor diferente do pedido', { order: order.id, valorPago, esperado: order.total_amount })
    return 'pending'
  }

  // ".eq('status', 'pending')" evita marcar duas vezes se o webhook e a página
  // confirmarem ao mesmo tempo.
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'pending')
  if (error) throw new Error(`Falha ao atualizar pedido: ${error.message}`)

  return 'paid'
}
