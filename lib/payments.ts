import 'server-only'
import { efiRequest, isEfiConfigured } from './efi'

// Pagamentos PIX (EFI Pay) — cobrança imediata.
// Docs: https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas
//
// Sem as credenciais da EFI no .env, entra o MODO SIMULADO (só para desenvolvimento).

export type PixCharge = {
  txid: string
  copiaECola: string
  qrcodeImage: string | null // imagem PNG em data URL, pronta para <img src>
  valor: number
  simulado: boolean
}

export type PixStatus = {
  pago: boolean
  status: string        // ATIVA, CONCLUIDA, REMOVIDA_PELO_USUARIO_RECEBEDOR, REMOVIDA_PELO_PSP
  valorPago: number | null
}

const EXPIRACAO_SEGUNDOS = 60 * 60 // o QR Code vale por 1 hora

export function isPixSimulado() {
  return !isEfiConfigured()
}

function assertSimuladoPermitido() {
  // Trava de segurança: o PIX de mentira nunca pode ir para produção,
  // senão o cliente "paga" um código que não existe. Para testar um deploy
  // de prévia mesmo assim, defina ALLOW_PIX_MOCK=true de propósito.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PIX_MOCK !== 'true') {
    throw new Error('PIX não configurado: defina as variáveis EFI_* antes de publicar.')
  }
}

// A EFI exige txid com 26 a 35 letras/números: o UUID do pedido sem os hífens tem 32.
export function txidFromOrderId(orderId: string) {
  return orderId.replace(/-/g, '')
}

export async function createPixCharge(orderId: string, amount: number): Promise<PixCharge> {
  const txid = txidFromOrderId(orderId)
  const valor = amount.toFixed(2) // a EFI quer o valor como texto: "24.90"

  if (isPixSimulado()) {
    assertSimuladoPermitido()
    const fake = `00020126580014BR.GOV.BCB.PIX-SIMULADO-${txid}-${valor}`
    return { txid, copiaECola: fake, qrcodeImage: null, valor: amount, simulado: true }
  }

  // 1. Cria a cobrança com o txid definido por nós (PUT é idempotente: repetir não duplica)
  const cob = await efiRequest('PUT', `/v2/cob/${txid}`, {
    body: {
      calendario: { expiracao: EXPIRACAO_SEGUNDOS },
      valor: { original: valor },
      chave: process.env.EFI_PIX_KEY,
      solicitacaoPagador: 'Fotos FFoto River'
    }
  })

  // 2. Busca o QR Code (imagem + copia e cola) pela "location" da cobrança
  let qrcodeImage: string | null = null
  let copiaECola: string = cob.pixCopiaECola || ''
  if (cob.loc?.id) {
    const qr = await efiRequest('GET', `/v2/loc/${cob.loc.id}/qrcode`)
    qrcodeImage = qr.imagemQrcode || null
    copiaECola = copiaECola || qr.qrcode
  }
  if (!copiaECola) throw new Error('EFI não retornou o código PIX da cobrança.')

  return { txid, copiaECola, qrcodeImage, valor: amount, simulado: false }
}

// Consulta a cobrança direto na EFI. É a fonte da verdade sobre o pagamento:
// não confiamos só no que chega pelo webhook.
export async function getPixStatus(txid: string): Promise<PixStatus> {
  if (isPixSimulado()) {
    return { pago: false, status: 'SIMULADO', valorPago: null }
  }
  const cob = await efiRequest('GET', `/v2/cob/${txid}`)
  const pagamentos: any[] = Array.isArray(cob.pix) ? cob.pix : []
  const valorPago = pagamentos.length
    ? pagamentos.reduce((soma, p) => soma + Number(p.valor || 0), 0)
    : null
  return { pago: cob.status === 'CONCLUIDA', status: cob.status, valorPago }
}

// Cadastra (ou troca) a URL do webhook da chave PIX na EFI.
// "x-skip-mtls-checking" é necessário em hospedagens como a Vercel, que não
// conseguem validar o certificado da EFI; por isso protegemos a URL com o segredo.
export async function registerPixWebhook(webhookUrl: string) {
  return efiRequest('PUT', `/v2/webhook/${encodeURIComponent(process.env.EFI_PIX_KEY!)}`, {
    body: { webhookUrl },
    headers: { 'x-skip-mtls-checking': 'true' }
  })
}

export async function getPixWebhook() {
  return efiRequest('GET', `/v2/webhook/${encodeURIComponent(process.env.EFI_PIX_KEY!)}`)
}
