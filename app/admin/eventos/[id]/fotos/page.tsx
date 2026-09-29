'use client'
import { useEffect, useState } from 'react'
import { applyWatermark } from '@/lib/watermark'

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
        const preview = await applyWatermark(files[i].file)
        const form = new FormData()
        form.append('event_id', params.id)
        form.append('filename', files[i].file.name)
        form.append('original', files[i].file)
        form.append('preview', preview, 'preview.jpg')
        const res = await fetch('/api/admin/photos', { method: 'POST', body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Falha no upload')
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
