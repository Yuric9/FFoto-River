// Endereço público das prévias (bucket "provas").
// No R2: o domínio público do bucket (r2.dev ou um domínio seu), por exemplo
// https://pub-xxxx.r2.dev  ou  https://fotos.seudominio.com.br
// Este arquivo pode ser usado no navegador: não tem nenhum segredo.
export function previewUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_PREVIEWS_BASE_URL || '').replace(/\/$/, '')
  return `${base}/${path}`
}
