// VERSION: v1 · 2026-07-26 · Cabecera compartida de las pantallas financieras.
//
// Por que existe: cada pantalla (ventas, compras, honorarios, caja-chica, sa)
// repetia su propia cabecera pegajosa con el MISMO calculo de offset, y ese
// calculo miraba solo el hermano inmediato anterior. Al meter FinancieroNav en
// medio, todas empezaron a pegarse a la altura equivocada y a esconderse detras
// del TopNav. Una sola cabecera = un solo sitio donde arreglarlo.
//
// Se coloca SIEMPRE justo despues de <FinancieroNav /> y se mide sola:
// suma la altura de todas las barras pegajosas que tiene encima y se pone debajo.
// Ademas informa al padre, via onOffset, de la coordenada donde debe pegarse
// lo siguiente (tipicamente la cabecera de columnas de la tabla).
//
// Uso:
//   const [topTabla, setTopTabla] = useState(0)
//   <FinancieroHeader
//     titulo="Ventas"
//     subtitulo="Ventas del mes con Centro de Coste/Beneficio"
//     derecha={<>...</>}          // controles arriba a la derecha (linea 1)
//     acciones={<>...</>}         // botones (linea 2)
//     metricas={[{ label:'Neto', valor:'1.234' }]}   // chips (linea 3)
//     mensajes={<>...</>}         // avisos opcionales, debajo
//     onOffset={setTopTabla}
//   />
//   ...
//   <div style={{ position:'sticky', top: topTabla, ... }}>cabecera de tabla</div>
'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const BORDE = '#E5E4DF'
const TENUE = '#888780'

export default function FinancieroHeader({
  titulo,
  subtitulo,
  derecha = null,
  acciones = null,
  metricas = null,
  mensajes = null,
  onOffset = null,
  maxWidth = 1180,
}) {
  const ref = useRef(null)
  const cbRef = useRef(onOffset)
  const [top, setTop] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // El callback se guarda en una ref: si el padre pasa una funcion nueva en cada
  // render, el efecto no debe volver a montarse (bucle de medicion).
  useEffect(() => { cbRef.current = onOffset })

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768)
    c(); window.addEventListener('resize', c)
    return () => window.removeEventListener('resize', c)
  }, [])

  useIsoLayoutEffect(() => {
    const medir = () => {
      let alto = 0
      let el = ref.current?.previousElementSibling
      while (el) {
        // se salta overlays a pantalla completa (arrastrar archivo), que son
        // fixed y falsearian la suma
        if (!el.dataset?.overlay) {
          const pos = window.getComputedStyle(el).position
          if (pos === 'sticky' || pos === 'fixed') {
            alto += Math.round(el.getBoundingClientRect().height)
          }
        }
        el = el.previousElementSibling
      }
      setTop(alto)
      if (cbRef.current && ref.current) {
        cbRef.current(alto + Math.round(ref.current.getBoundingClientRect().height))
      }
    }

    medir()
    window.addEventListener('resize', medir)
    const t = setTimeout(medir, 300)

    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(medir)
      if (ref.current) ro.observe(ref.current)
      const prev = ref.current?.previousElementSibling
      if (prev) ro.observe(prev)
    }

    return () => {
      window.removeEventListener('resize', medir)
      clearTimeout(t)
      if (ro) ro.disconnect()
    }
  }, [])

  const pad = isMobile ? '0 8px' : '0 20px'

  return (
    <div ref={ref} style={{
      position: 'sticky', top, zIndex: 19, background: '#fff',
      borderBottom: `1px solid ${BORDE}`,
    }}>
      <div style={{ maxWidth, margin: '0 auto', padding: pad }}>

        {/* LINEA 1 · titulo + subtitulo en la misma linea, controles a la derecha */}
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap', paddingTop: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 600, margin: 0, color: '#2C2C2A' }}>
              {titulo}
            </h1>
            {subtitulo && (
              <span style={{ fontSize: 12, color: TENUE }}>{subtitulo}</span>
            )}
          </div>
          {derecha && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {derecha}
            </div>
          )}
        </div>

        {/* LINEA 2 · botones */}
        {acciones && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {acciones}
          </div>
        )}

        {/* LINEA 3 · metricas como chips en linea (no tarjetas) */}
        {metricas && metricas.length > 0 && (
          <div style={{
            display: 'flex', gap: 16, marginTop: 8, paddingBottom: 8,
            flexWrap: 'wrap', alignItems: 'baseline',
          }}>
            {metricas.map((m, i) => (
              <span key={m.label || i} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 11, color: TENUE, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: m.color || '#2C2C2A' }}>
                  {m.valor}
                </span>
              </span>
            ))}
          </div>
        )}

        {!metricas && acciones && <div style={{ paddingBottom: 8 }} />}
        {!metricas && !acciones && <div style={{ paddingBottom: 8 }} />}

        {mensajes}
      </div>
    </div>
  )
}
