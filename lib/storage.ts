import 'server-only'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Armazenamento das fotos no Cloudflare R2 (compatível com o padrão S3).
// Funciona também com AWS S3, Backblaze B2 etc.: basta trocar S3_ENDPOINT.
//
// Dois buckets:
// - originais (PRIVADO): fotos em alta, só saem por link assinado depois do pagamento
// - provas (PÚBLICO): prévias pequenas com marca d'água, exibidas na galeria

export const BUCKET_ORIGINAIS = process.env.S3_BUCKET_ORIGINAIS || 'acheiminhaphoto-originais'
export const BUCKET_PROVAS = process.env.S3_BUCKET_PROVAS || 'acheiminhaphoto-provas'

let client: S3Client | null = null
function s3() {
  if (client) return client
  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('Armazenamento não configurado: defina S3_ENDPOINT, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.')
  }
  client = new S3Client({
    region: 'auto', // o R2 não usa regiões; "auto" é o valor indicado pela Cloudflare
    endpoint: S3_ENDPOINT,
    // Endereço no formato servidor/bucket/arquivo (em vez de bucket.servidor):
    // funciona igual no R2, Backblaze, MinIO etc.
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
  })
  return client
}

// Link para o NAVEGADOR enviar um arquivo direto para o bucket (método PUT).
// O navegador precisa mandar o mesmo Content-Type usado aqui.
// "signableHeaders" coloca o Content-Type dentro da assinatura: sem isso, quem tivesse
// o link poderia enviar qualquer tipo de arquivo (ex.: um HTML no bucket público).
export function presignUpload(bucket: string, key: string, contentType: string, expiresInSeconds = 600) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: expiresInSeconds,
    signableHeaders: new Set(['content-type'])
  })
}

// Link temporário para baixar uma foto original (bucket privado).
// "attachment" faz o navegador baixar o arquivo em vez de só abrir.
export function presignDownload(key: string, filename: string, expiresInSeconds = 60 * 60) {
  const safeName = filename.replace(/["\\\r\n]/g, '')
  return getSignedUrl(s3(), new GetObjectCommand({
    Bucket: BUCKET_ORIGINAIS,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`
  }), { expiresIn: expiresInSeconds })
}
