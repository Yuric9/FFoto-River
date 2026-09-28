// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

serve(async (req) => {
  const { event_id, original_path, filename } = await req.json()
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Baixa original
  const { data: file } = await supabase.storage.from("originais").download(original_path)
  const buffer = await file.arrayBuffer()

  // Aqui entra o Sharp - no Deno use ImageMagick ou chama uma API
  // Para MVP, vamos só copiar para bucket de provas (marca d'água via CSS no front)
  // V2: implementar com sharp via Node ou Cloudinary

  const preview_path = original_path.replace("originais/", "").replace("originais", "")
  const final_preview_path = `${event_id}/${filename}`

  await supabase.storage.from("provas").upload(final_preview_path, file, { upsert: true })

  // Salva no banco
  await supabase.from("photos").insert({
    event_id,
    original_path,
    preview_path: final_preview_path,
    filename,
  })

  return new Response(JSON.stringify({ ok: true, preview_path: final_preview_path }), { status: 200 })
})