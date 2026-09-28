import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { data: rows } = await supabaseAdmin.from('sales_dashboard').select('*')
  return <div className="min-h-screen p-6"><h1 className="text-2xl font-black mb-6">Painel FFoto River</h1><div className="grid gap-4 max-w-2xl">{(rows || []).map((r: any) => <div key={r.event_id} className="bg-zinc-900 border border-zinc-800 rounded p-4"><h2 className="font-bold text-lg">{r.title}</h2><p className="text-zinc-400 text-sm mb-2">/e/{r.slug}</p><div className="flex gap-6 text-sm flex-wrap"><div><span className="text-zinc-500">Pedidos pagos:</span> {r.pedidos_pagos}</div><div><span className="text-zinc-500">Faturado:</span> R$ {Number(r.faturado).toFixed(2)}</div><div><span className="text-zinc-500">Fotos vendidas:</span> {r.fotos_vendidas}</div></div></div>)}{(!rows || rows.length === 0) && <p className="text-zinc-500">Nenhum evento cadastrado ainda. Crie um direto no Supabase (tabela events).</p>}</div></div>
}
