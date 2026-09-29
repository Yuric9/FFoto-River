// Gera uma versão com marca d'água repetida, direto no navegador (canvas), sem precisar de servidor extra, biblioteca externa ou Edge Function.
export async function applyWatermark(file: File, text = 'FFOTO RIVER'): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

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
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
