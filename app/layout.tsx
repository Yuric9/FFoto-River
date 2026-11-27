import './globals.css'
export const metadata = {
  title: 'Achei Minha Photo',
  description: 'Encontre e compre suas fotos de corridas e eventos esportivos. Pagamento por PIX e download na hora.'
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0A0A0A] text-white antialiased">{children}</body>
    </html>
  )
}