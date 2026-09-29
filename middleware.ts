import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER
  const pass = process.env.ADMIN_PASSWORD

  if (!user || !pass) {
    return new NextResponse('Painel admin não configurado. Defina ADMIN_USER e ADMIN_PASSWORD.', { status: 500 })
  }

  const auth = req.headers.get('authorization')
  if (auth) {
    const [scheme, encoded] = auth.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString()
      const i = decoded.indexOf(':')
      if (decoded.slice(0, i) === user && decoded.slice(i + 1) === pass) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Acesso restrito', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Admin FFoto River"' }
  })
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}
