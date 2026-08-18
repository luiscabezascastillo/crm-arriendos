// VERSION: v2 · 2026-08-18 · Anade GET (el menu "Cerrar sesion" es un enlace <a>): borra cookie y redirige a /login. Mantiene POST.
// RUTA: portal-propietarios/src/app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete(COOKIE_NAME)
  return response
}

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
