// VERSION: v1 · 2026-08-18 · Placeholder "en desarrollo" de Facturas.
// RUTA: portal-propietarios/src/app/(portal)/facturas/page.tsx
import EnDesarrollo from '@/components/EnDesarrollo'

export default function FacturasPage() {
  return (
    <EnDesarrollo
      titulo="Facturas"
      descripcion="Aquí podrás consultar y descargar las facturas y boletas emitidas por la administración de tus propiedades."
      puntos={[
        'Documentos tributarios organizados por mes.',
        'Descarga en PDF.',
      ]}
    />
  )
}
