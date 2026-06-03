import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
const RUTAS = {
  '/panel':        ['admin', 'operaciones', 'finanzas', 'legal'],
  '/admin':        ['admin', 'operaciones', 'finanzas', 'legal'],
  '/cc1':          ['admin', 'finanzas', 'legal'],
  '/publicaciones':['admin', 'comercial', 'legal'],
  '/op':           ['admin', 'operaciones', 'finanzas', 'legal'],
  '/info':         ['admin', 'operaciones', 'finanzas', 'legal'],
  '/contactos':    ['admin', 'operaciones', 'finanzas', 'legal', 'comercial'],
}
export async function middleware(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  const rol = token.role
  const rutaProtegida = Object.keys(RUTAS).find(r => pathname.startsWith(r))
  if (rutaProtegida && !RUTAS[rutaProtegida].includes(rol)) {
    return NextResponse.redirect(new URL('/sin-acceso', req.url))
  }
  return NextResponse.next()
}
export const config = {
  matcher: ['/panel/:path*', '/admin/:path*', '/cc1/:path*', '/publicaciones/:path*', '/op/:path*', '/info/:path*', '/contactos/:path*']
}