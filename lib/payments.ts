// EFI PAY - Integração PIX
// Docs: https://dev.efipay.com.br/docs/api-pix/cobrancas-imediatas

export async function createPixCharge(orderId: string, amount: number, customerName: string) {
  // A EFI exige txid com 26 a 35 letras/números: o UUID do pedido sem os hífens tem 32.
  const txid = orderId.replace(/-/g, '')

  // TODO: implementar com o certificado da EFI
  // 1. Autenticar (POST /oauth/token)
  // 2. PUT /v2/cob/{txid} com valor e chave PIX
  // 3. GET /v2/loc/{id}/qrcode para o QR Code e o copia e cola

  // Trava de segurança: o PIX de mentira nunca pode ir para produção,
  // senão o cliente "paga" um código que não existe. Para testar um deploy
  // de prévia mesmo assim, defina ALLOW_PIX_MOCK=true de propósito.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PIX_MOCK !== 'true') {
    throw new Error('Integração PIX ainda não implementada. Configure a EFI antes de publicar.')
  }

  // MOCK para desenvolvimento
  return {
    txid,
    qrcode: `00020126580014BR.GOV.BCB.PIX...${amount}`,
    copiaECola: `00020126580014BR.GOV.BCB.PIX...${amount}`,
    valor: amount
  }
}
