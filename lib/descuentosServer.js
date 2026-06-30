// lib/descuentosServer.js
// Helpers de servidor para los endpoints de /api/descuentos.
// Centraliza: cliente Supabase service-role, lectura de sesión, y resolución
// de capacidades (consulta proceso_permisos y aplica lib/descuentosPermisos).

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { capacidadesDescuentos } from '@/lib/descuentosPermisos';

export function supaService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// Devuelve { email, caps } o lanza un objeto {status, error} listo para responder.
export async function sesionYCaps() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) throw { status: 401, error: 'No autenticado' };

  const supa = supaService();
  const { data, error } = await supa
    .from('proceso_permisos')
    .select('rol')
    .eq('proceso', 'descuentos')
    .eq('email', email)
    .eq('activo', true)
    .maybeSingle();

  if (error) throw { status: 500, error: 'Error leyendo permisos: ' + error.message };

  const caps = capacidadesDescuentos(email, data?.rol || null);
  return { email, caps, supa };
}

// Escribe filas en descuentos_bitacora. Nunca propaga errores (la bitácora
// jamás debe romper el flujo principal). Igual criterio que lib/bitacora.js.
export async function registrarBitacora(supa, filas) {
  try {
    if (!filas || filas.length === 0) return;
    await supa.from('descuentos_bitacora').insert(filas);
  } catch (e) {
    console.error('descuentos_bitacora (ignorado):', e?.message || e);
  }
}
