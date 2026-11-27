import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  process.env.S3_ENDPOINT = 'https://conta-teste.r2.cloudflarestorage.com'
  process.env.S3_ACCESS_KEY_ID = 'chave'
  process.env.S3_SECRET_ACCESS_KEY = 'segredo'
})

describe('links assinados do storage (R2)', async () => {
  const { presignUpload, presignDownload, BUCKET_ORIGINAIS } = await import('@/lib/storage')

  it('link de upload aponta para o bucket e arquivo certos e é assinado', async () => {
    const url = new URL(await presignUpload('acheiminhaphoto-provas', 'evento/abc-preview.jpg', 'image/jpeg'))
    expect(url.host).toBe('conta-teste.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/acheiminhaphoto-provas/evento/abc-preview.jpg')
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    // o Content-Type faz parte da assinatura: o navegador não pode trocar o tipo
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type')
  })

  it('link de download é do bucket PRIVADO, expira em 1 hora e força o download', async () => {
    const url = new URL(await presignDownload('evento/abc.jpg', 'IMG_0001.jpg'))
    expect(url.pathname).toBe(`/${BUCKET_ORIGINAIS}/evento/abc.jpg`)
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600')
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="IMG_0001.jpg"')
  })

  it('remove aspas do nome do arquivo (evita quebrar o cabeçalho)', async () => {
    const url = new URL(await presignDownload('k.jpg', 'foto"malvada".jpg'))
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="fotomalvada.jpg"')
  })
})
