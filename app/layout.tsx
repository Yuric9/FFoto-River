import './globals.css'
export const metadata = { title: 'FFoto River', description: 'Venda de fotos esportivas' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#0A0A0A] text-white antialiased">{children}</body>
    </html>
  )
}