// Gera uma versão com marca d'água repetida, direto no navegador (canvas), sem precisar de servidor extra, biblioteca externa ou Edge Function.
// A prévia também é reduzida (lado maior com até `maxSize` px): fica leve para a galeria
// e não serve como substituta da foto original em alta resolução.
export async function applyWatermark(file: File, text = 'FFOTO RIVER', maxSize = 1600): Promise<Blob> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.globalAlpha = 0.25
  ctx.fillStyle = '#ffffff'
  ctx.font = `${Math.round(canvas.width / 18)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(-Math.PI / 8)
  ctx.translate(-canvas.width / 2, -canvas.height / 2)

  const stepX = canvas.width / 3
  const stepY = canvas.height / 5
  for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
    for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
      ctx.fillText(text, x, y)
    }
  }
  ctx.restore()

  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.82))
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
