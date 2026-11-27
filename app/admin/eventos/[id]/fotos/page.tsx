'use client'
import { useEffect, useState } from 'react'
import { applyWatermark } from '@/lib/watermark'
import { supabase } from '@/lib/supabase'

type Status = 'pendente' | 'enviando' | 'ok' | 'erro'

export default function UploadFotosPage({ params }: { params: { id: string } }) {
  const [eventTitle, setEventTitle] = useState('')
  const [files, setFiles] = useState<{ file: File; status: Status; error?: string }[]>([])

  useEffect(() => {
    fetch(`/api/admin/events/${params.id}`).then(r => r.json()).then(d => setEventTitle(d.event?.title || ''))
  }, [params.id])

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []).map(file => ({ file, status: 'pendente' as Status }))
    setFiles(prev => [...prev, ...selected])
  }

  async function uploadAll() {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'ok') continue
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'enviando' } : f))
      try {
        const file = files[i].file
        const preview = await applyWatermark(file)

        // 1. Pede ao servidor URLs assinadas para enviar os arquivos
        const res1 = await fetch('/api/admin/photos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: params.id, filename: file.name })
        })
        const urls = await res1.json()
        if (!res1.ok) throw new Error(urls.error || 'Falha ao preparar upload')

        // 2. Envia original e prévia direto para o Supabase Storage
        const up1 = await supabase.storage.from('originais')
          .uploadToSignedUrl(urls.original.path, urls.original.token, file, { contentType: file.type })
        if (up1.error) throw new Error(`Original: ${up1.error.message}`)
        const up2 = await supabase.storage.from('provas')
          .uploadToSignedUrl(urls.preview.path, urls.preview.token, preview, { contentType: 'image/jpeg' })
        if (up2.error) throw new Error(`Prévia: ${up2.error.message}`)

        // 3. Registra a foto no banco
        const res2 = await fetch('/api/admin/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: params.id, filename: file.name, original_path: urls.original.path, preview_path: urls.preview.path })
        })
        const data = await res2.json()
        if (!res2.ok) throw new Error(data.error || 'Falha ao registrar foto')
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'ok' } : f))
      } catch (err: any) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'erro', error: err.message } : f))
      }
    }
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-black mb-1">Adicionar fotos</h1>
      <p className="text-zinc-400 mb-6">{eventTitle || 'Carregando evento...'}</p>
      <input type="file" accept="image/*" multiple onChange={handleSelect} className="mb-4 block" />
      {files.length > 0 && (
        <>
          <button onClick={uploadAll} className="bg-[#C6FF00] text-black font-black py-2 px-5 rounded-full mb-4">
            Enviar {files.length} foto(s)
          </button>
          <ul className="max-w-md flex flex-col gap-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex justify-between border-b border-zinc-800 py-1">
                <span className="truncate max-w-[60%]">{f.file.name}</span>
                <span className={f.status === 'ok' ? 'text-[#C6FF00]' : f.status === 'erro' ? 'text-red-400' : 'text-zinc-500'}>
                  {f.status === 'erro' ? f.error : f.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
