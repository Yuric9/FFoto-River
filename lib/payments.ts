// EFI PAY - Integração PIX
// Docs: https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas

export async function createPixCharge(orderId: string, amount: number, customerName: string) {
  // 1. Autenticar na EFI
  // 2. POST /v2/cob com valor e txid = orderId
  // Retorna { qrcode, pixCopiaECola, txid }
  // TODO: implementar com axios + certificado da EFI

  // MOCK para desenvolvimento
  return {
    txid: orderId,
    qrcode: `00020126580014BR.GOV.BCB.PIX...${amount}`,
    copiaECola: `00020126580014BR.GOV.BCB.PIX...${amount}`,
    valor: amount
  }
}