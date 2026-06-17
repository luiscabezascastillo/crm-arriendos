"use client";

import { useState } from "react";

const svgColor = {
  COMPLETADO: { fill: "#d8f3dc", stroke: "#2f9e44", text: "#1b5e20" },
  ACTIVO: { fill: "#fff3cd", stroke: "#f59f00", text: "#7a4f00" },
  PENDIENTE: { fill: "#e9ecef", stroke: "#adb5bd", text: "#495057" },
  RETRASADO: { fill: "#f8d7da", stroke: "#e03131", text: "#842029" },
  BLOQUEADO: { fill: "#ffe5b4", stroke: "#f08c00", text: "#8a4b00" },
};

// Coordenadas de cada caja en el SVG. N04b y N08b son los nodos nuevos.
// Puedes ajustar x/y a ojo si quieres recolocar alguna caja.
const posiciones = {
  N01: { x: 80, y: 40 },
  N02: { x: 310, y: 40 },
  N03: { x: 80, y: 150 },
  N04: { x: 310, y: 150 },
  N05: { x: 540, y: 150 },
  N04b: { x: 540, y: 210 },
  N06: { x: 310, y: 260 },
  N07: { x: 310, y: 370 },
  N08: { x: 80, y: 500 },
  N08b: { x: 80, y: 565 },
  N12: { x: 310, y: 500 },
  N13: { x: 540, y: 500 },
  N14: { x: 770, y: 500 },
  N09: { x: 80, y: 630 },
  N10: { x: 80, y: 740 },
  N11: { x: 80, y: 850 },
  N15: { x: 420, y: 850 },
  N16: { x: 300, y: 980 },
  N17: { x: 540, y: 980 },
  N18: { x: 420, y: 1100 },
  N19: { x: 300, y: 1230 },
  N20: { x: 300, y: 1360 },
  N21: { x: 540, y: 1230 },
};

function nombreCorto(codigo, nombre) {
  const mapa = {
    N01: "Aviso",
    N02: "Expediente",
    N03: "Publicación",
    N04: "Legal inicial",
    N04b: "Comunic. ex-arr.",
    N05: "Ficha término",
    N06: "Llaves / Q",
    N07: "Inspección",
    N08: "Presupuesto",
    N08b: "Markup FCR",
    N09: "Aprobación",
    N10: "Reparación",
    N11: "Limpieza",
    N12: "Servicios",
    N13: "Garantía",
    N14: "Deuda",
    N15: "Liquidación",
    N16: "Notif. propietario",
    N17: "Notif. arrendatario",
    N18: "Respuesta",
    N19: "Pago / cobro",
    N20: "Cierre",
    N21: "Legal / DICOM",
  };

  return mapa[codigo] || nombre;
}

const CARD_W = 280;
const SVG_W = 1050;

export default function GrafoTermino({ data, edges }) {
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);

  // El click fija (pinned); el hover solo muestra si no hay nada fijado.
  const activeCode = pinned || hovered;

  const byCode = {};
  for (const t of data) byCode[t.node_codigo] = t;

  const active = activeCode ? byCode[activeCode] : null;
  const activePos = activeCode ? posiciones[activeCode] : null;

  let cardLeft = 0;
  let cardTop = 0;
  if (active && activePos) {
    const placeRight = activePos.x + 140 + 12 + CARD_W <= SVG_W;
    cardLeft = placeRight
      ? activePos.x + 140 + 12
      : Math.max(0, activePos.x - 12 - CARD_W);
    cardTop = activePos.y;
  }

  const estadoActivo = active
    ? active.esta_retrasado
      ? "RETRASADO"
      : active.task_estado
    : null;
  const colorActivo = estadoActivo
    ? svgColor[estadoActivo] || svgColor.PENDIENTE
    : null;

  return (
    <section
      style={{
        background: "white",
        border: "1px solid #dee2e6",
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        overflowX: "auto",
      }}
    >
      <h3>Grafo de dependencias</h3>

      <div style={{ position: "relative", width: SVG_W }}>
        <svg width={SVG_W} height="1480" viewBox="0 0 1050 1480">
          <defs>
            <marker
              id="arrow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#868e96" />
            </marker>
          </defs>

          {edges.map((e) => {
            const from = posiciones[e.parent_node];
            const to = posiciones[e.child_node];

            if (!from || !to) return null;

            const x1 = from.x + 70;
            const y1 = from.y + 25;
            const x2 = to.x + 70;
            const y2 = to.y + 25;

            return (
              <line
                key={`${e.parent_node}-${e.child_node}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#868e96"
                strokeWidth="2"
                markerEnd="url(#arrow)"
              />
            );
          })}

          {data.map((t) => {
            const pos = posiciones[t.node_codigo];
            if (!pos) return null;

            const estadoReal = t.esta_retrasado ? "RETRASADO" : t.task_estado;
            const color = svgColor[estadoReal] || svgColor.PENDIENTE;
            const isActive = t.node_codigo === activeCode;

            return (
              <g
                key={t.node_codigo}
                onMouseEnter={() => setHovered(t.node_codigo)}
                onMouseLeave={() =>
                  setHovered((h) => (h === t.node_codigo ? null : h))
                }
                onClick={() =>
                  setPinned((p) => (p === t.node_codigo ? null : t.node_codigo))
                }
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="140"
                  height="58"
                  rx="12"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth={isActive ? "4" : "2"}
                />

                <text
                  x={pos.x + 70}
                  y={pos.y + 20}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="bold"
                  fill={color.text}
                >
                  {t.node_codigo}
                </text>

                <text
                  x={pos.x + 70}
                  y={pos.y + 39}
                  textAnchor="middle"
                  fontSize="12"
                  fill={color.text}
                >
                  {nombreCorto(t.node_codigo, t.nombre)}
                </text>
              </g>
            );
          })}
        </svg>

        {active && activePos ? (
          <div
            style={{
              position: "absolute",
              left: cardLeft,
              top: cardTop,
              width: CARD_W,
              background: "white",
              border: "1px solid #ced4da",
              borderRadius: 10,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              padding: 14,
              zIndex: 10,
              pointerEvents: pinned ? "auto" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#868e96" }}>
                  {active.node_codigo}
                </div>
                <div style={{ fontWeight: "bold", fontSize: 15 }}>
                  {active.nombre}
                </div>
              </div>

              {pinned ? (
                <button
                  onClick={() => setPinned(null)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    color: "#868e96",
                  }}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              {colorActivo ? (
                <span
                  style={{
                    background: colorActivo.fill,
                    color: colorActivo.text,
                    border: `1px solid ${colorActivo.stroke}`,
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {estadoActivo}
                </span>
              ) : null}

              <span
                style={{
                  background: "#f1f3f5",
                  color: "#495057",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                {active.responsable || active.area_responsable || "—"}
              </span>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.5, color: "#343a40" }}>
              {active.descripcion || "Sin descripción registrada."}
            </div>

            {!pinned ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#adb5bd",
                }}
              >
                Click para fijar
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
