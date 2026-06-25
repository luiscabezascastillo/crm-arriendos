import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
const RUTAS = {
  '/panel':        ['direccion', 'administracion', 'finanzas', 'legal', 'ventas', 'comercial', 'mantencion'],
  '/admin':        ['direccion', 'legal', 'ventas', 'administracion', 'finanzas'],
  '/cc1':          ['direccion', 'finanzas', 'legal'],
  '/publicaciones': ['direccion', 'administracion', 'comercial', 'ventas', 'legal'],
  '/procesos':     ['direccion', 'administracion', 'mantencion', 'finanzas', 'legal', 'ventas'],
  '/op':           ['direccion', 'administracion', 'finanzas', 'legal'],
  '/info':         ['direccion', 'administracion', 'finanzas', 'legal'],
  '/contactos':    ['direccion', 'administracion', 'finanzas', 'legal', 'comercial'],
}
export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }
const rol = token.role

  // Aterrizaje por rol: si caen en el Panel y no es lo suyo, llevarlos a su sección
  const DESTINO_POR_ROL = {
    ventas: '/procesos',
    comercial: '/publicaciones',
  }
  if (pathname === '/panel' && DESTINO_POR_ROL[rol]) {
    return NextResponse.redirect(new URL(DESTINO_POR_ROL[rol], req.url))
  }

  const rutaProtegida = Object.keys(RUTAS).find(r => pathname.startsWith(r))
  if (rutaProtegida && !RUTAS[rutaProtegida].includes(rol)) {
    return NextResponse.redirect(new URL('/sin-acceso', req.url))
  }
  return NextResponse.next()
}
export const config = {
matcher: ['/panel/:path*', '/admin/:path*', '/cc1/:path*', '/publicaciones/:path*', '/procesos/:path*', '/op/:path*', '/info/:path*', '/contactos/:path*']
}