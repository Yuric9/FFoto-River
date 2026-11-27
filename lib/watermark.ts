// Gera uma versão com marca d'água repetida, direto no navegador (canvas), sem precisar de servidor extra, biblioteca externa ou Edge Function.
// A prévia também é reduzida (lado maior com até `maxSize` px): fica leve para a galeria
// e não serve como substituta da foto original em alta resolução.
export async function applyWatermark(file: File, text = 'ACHEI MINHA PHOTO', maxSize = 1600): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  drawWatermark(ctx, canvas.width, canvas.height, text)

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82))
}

// Desenha o texto repetido em diagonal, em "tijolinhos", cobrindo a foto inteira.
// O espaçamento é calculado pela LARGURA REAL do texto: com um passo fixo
// (ex.: 1/3 da largura da foto), as repetições se encostavam e se misturavam.
export function drawWatermark(ctx: CanvasRenderingContext2D, width: number, height: number, text: string) {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 14))
  ctx.save()
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)' // contorno: aparece também em fotos claras
  ctx.lineWidth = Math.max(1, fontSize / 18)

  // gira em torno do centro e desenha numa área do tamanho da diagonal,
  // para os cantos também ficarem cobertos depois da rotação
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 8)
  const stepX = ctx.measureText(text).width + fontSize * 2.5
  const stepY = fontSize * 4
  const half = Math.hypot(width, height) / 2

  let row = 0
  for (let y = -half; y <= half; y += stepY, row++) {
    const offset = row % 2 ? stepX / 2 : 0 // linhas alternadas deslocadas
    for (let x = -half - stepX + offset; x <= half + stepX; x += stepX) {
      ctx.strokeText(text, x, y)
      ctx.fillText(text, x, y)
    }
  }
  ctx.restore()
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src = url
  })
}
