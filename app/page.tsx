import Image from 'next/image'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'

export default async function HomePage() {
  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('id, slug, title, date, location')
    .eq('is_active', true)
    .order('date', { ascending: true })

  return (
    <main className="min-h-screen bg-[#0A0A0A]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="FFoto River"
              width={180}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
            FFoto River
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Encontre suas fotos do evento.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Escolha o evento, encontre suas fotos e compre seus registros
            esportivos em poucos passos.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold">Eventos disponíveis</h2>

          {error ? (
            <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-5 text-red-200">
              <p>Não foi possível carregar os eventos agora.</p>
              {process.env.NODE_ENV !== 'production' && (
                <pre className="mt-3 whitespace-pre-wrap text-xs text-red-300">{error.message}</pre>
              )}
            </div>
          ) : !events?.length ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-8 text-white/60">
              Nenhum evento disponível no momento.
            </div>
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/e/${event.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-emerald-400/40 hover:bg-white/[0.07]"
                >
                  <p className="text-sm text-emerald-400">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString(
                      'pt-BR',
                      { day: '2-digit', month: '2-digit', year: 'numeric' }
                    )}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold group-hover:text-emerald-300">
                    {event.title}
                  </h3>
                  {event.location && (
                    <p className="mt-2 text-sm text-white/55">{event.location}</p>
                  )}
                  <span className="mt-6 inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">
                    Ver galeria
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/40">
        © {new Date().getFullYear()} FFoto River
      </footer>
    </main>
  )
}
