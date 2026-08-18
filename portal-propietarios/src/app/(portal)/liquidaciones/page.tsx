// VERSION: v1 · 2026-08-18 · Placeholder "en desarrollo" de Liquidaciones (aun no conectado a liquidacion_idprop/idadmon ni a Paola).
// RUTA: portal-propietarios/src/app/(portal)/liquidaciones/page.tsx
import EnDesarrollo from '@/components/EnDesarrollo'

export default function LiquidacionesPage() {
  return (
    <EnDesarrollo
      titulo="Liquidaciones"
      descripcion="Aquí verás el detalle mensual de tus liquidaciones: renta cobrada, comisión, gastos y el neto transferido, mes a mes."
      puntos={[
        'Se mostrará solo cada mes ya cerrado y liquidado.',
        'Cada mes con su resumen y documento descargable.',
      ]}
    />
  )
}
