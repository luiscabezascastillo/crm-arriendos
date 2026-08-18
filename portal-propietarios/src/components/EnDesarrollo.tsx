// VERSION: v1 · 2026-08-18 · Panel reutilizable "VISTA DE PRUEBA / EN DESARROLLO" para secciones aun no conectadas.
// RUTA: portal-propietarios/src/components/EnDesarrollo.tsx

export function BadgeDesarrollo({ texto = 'VISTA DE PRUEBA' }: { texto?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase',
      color: '#B45309', background: '#FEF3C7', border: '1px solid #FCD34D',
      borderRadius: 999, padding: '3px 10px',
    }}>
      <i className="ti ti-tools" style={{ fontSize: 12 }} aria-hidden="true" />
      {texto}
    </span>
  )
}

export default function EnDesarrollo({ titulo, descripcion, puntos }: {
  titulo: string; descripcion?: string; puntos?: string[]
}) {
  return (
    <div className="dash-wrap">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#111827' }}>{titulo}</div>
        <BadgeDesarrollo />
      </div>

      <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '2rem', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ti ti-tools" style={{ fontSize: 20, color: '#B45309' }} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#92400E' }}>Sección en desarrollo</div>
        </div>
        <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
          {descripcion || 'Estamos preparando esta sección. Pronto podrás consultarla aquí con tus datos reales.'}
        </div>
        {puntos && puntos.length > 0 && (
          <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {puntos.map((p, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: '#78350F' }}>
                <i className="ti ti-point-filled" style={{ fontSize: 14, color: '#D97706', marginTop: 1 }} aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
