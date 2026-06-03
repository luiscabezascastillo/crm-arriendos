import { supabaseAdmin } from "@/src/lib/supabase";
import CompletarButton from "./CompletarButton";

const estadoStyle = {
  COMPLETADO: { background: "#d8f3dc", color: "#1b5e20" },
  ACTIVO: { background: "#fff3cd", color: "#7a4f00" },
  PENDIENTE: { background: "#e9ecef", color: "#495057" },
  RETRASADO: { background: "#f8d7da", color: "#842029" },
  BLOQUEADO: { background: "#ffe5b4", color: "#8a4b00" },
};

const svgColor = {
  COMPLETADO: { fill: "#d8f3dc", stroke: "#2f9e44", text: "#1b5e20" },
  ACTIVO: { fill: "#fff3cd", stroke: "#f59f00", text: "#7a4f00" },
  PENDIENTE: { fill: "#e9ecef", stroke: "#adb5bd", text: "#495057" },
  RETRASADO: { fill: "#f8d7da", stroke: "#e03131", text: "#842029" },
  BLOQUEADO: { fill: "#ffe5b4", stroke: "#f08c00", text: "#8a4b00" },
};

const posiciones = {
  N01: { x: 80, y: 40 },
  N02: { x: 310, y: 40 },
  N03: { x: 80, y: 150 },
  N04: { x: 310, y: 150 },
  N05: { x: 540, y: 150 },
  N06: { x: 310, y: 260 },
  N07: { x: 310, y: 370 },
  N08: { x: 80, y: 500 },
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
    N05: "Ficha término",
    N06: "Llaves / Q",
    N07: "Inspección",
    N08: "Presupuesto",
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

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-CL");
}

export default async function TerminoPage({ params }) {
  const { idadmon } = await params;

  const { data, error } = await supabaseAdmin
    .from("vw_workflow_tasks")
    .select("*")
    .eq("idadmon", idadmon)
    .order("orden_visual", { ascending: true });

  const { data: edges, error: edgeError } = await supabaseAdmin
    .from("workflow_dependencies")
    .select("*")
    .eq("workflow_codigo", "TERMINO");

  const workflowInstanceId = data?.[0]?.workflow_instance_id;

  const { data: logs, error: logsError } = workflowInstanceId
    ? await supabaseAdmin
        .from("workflow_task_logs")
        .select("*")
        .eq("workflow_instance_id", workflowInstanceId)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (error || edgeError || logsError) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Error cargando workflow</h1>
        <pre>{error?.message || edgeError?.message || logsError?.message}</pre>
      </main>
    );
  }

  const total = data.length;
  const completadas = data.filter((t) => t.task_estado === "COMPLETADO").length;
  const activas = data.filter((t) => t.task_estado === "ACTIVO").length;
  const pendientes = data.filter((t) => t.task_estado === "PENDIENTE").length;
  const retrasadas = data.filter((t) => t.esta_retrasado).length;
  const avance = total > 0 ? Math.round((completadas / total) * 1000) / 10 : 0;

  const responsablesActivos = [
    ...new Set(
      data
        .filter((t) => t.task_estado === "ACTIVO")
        .map((t) => t.responsable)
    ),
  ].join(" / ");

  return (
    <main style={{ padding: 24 }}>
      <h1>Workflow de término</h1>
      <h2>IDADMON: {idadmon}</h2>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
          gap: 12,
          margin: "16px 0",
        }}
      >
        <div style={{ padding: 12, background: "#f1f3f5", borderRadius: 8 }}>
          <b>Total</b>
          <div>{total}</div>
        </div>

        <div style={{ padding: 12, background: "#d8f3dc", borderRadius: 8 }}>
          <b>Completadas</b>
          <div>{completadas}</div>
        </div>

        <div style={{ padding: 12, background: "#fff3cd", borderRadius: 8 }}>
          <b>Activas</b>
          <div>{activas}</div>
        </div>

        <div style={{ padding: 12, background: "#e9ecef", borderRadius: 8 }}>
          <b>Pendientes</b>
          <div>{pendientes}</div>
        </div>

        <div style={{ padding: 12, background: "#f8d7da", borderRadius: 8 }}>
          <b>Retrasadas</b>
          <div>{retrasadas}</div>
        </div>

        <div style={{ padding: 12, background: "#e7f5ff", borderRadius: 8 }}>
          <b>Avance</b>
          <div>{avance}%</div>
        </div>
      </section>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 6 }}>
          <b>Responsable actual:</b>{" "}
          {responsablesActivos || "Sin tareas activas"}
        </div>

        <div
          style={{
            width: "100%",
            height: 18,
            background: "#e9ecef",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${avance}%`,
              height: "100%",
              background: "#2f9e44",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span style={{ background: "#d8f3dc", color: "#1b5e20", padding: "6px 12px", borderRadius: 6, fontWeight: "bold" }}>
          🟢 COMPLETADO
        </span>
        <span style={{ background: "#fff3cd", color: "#7a4f00", padding: "6px 12px", borderRadius: 6, fontWeight: "bold" }}>
          🟡 ACTIVO
        </span>
        <span style={{ background: "#e9ecef", color: "#495057", padding: "6px 12px", borderRadius: 6, fontWeight: "bold" }}>
          ⚪ PENDIENTE
        </span>
        <span style={{ background: "#f8d7da", color: "#842029", padding: "6px 12px", borderRadius: 6, fontWeight: "bold" }}>
          🔴 RETRASADO
        </span>
        <span style={{ background: "#ffe5b4", color: "#8a4b00", padding: "6px 12px", borderRadius: 6, fontWeight: "bold" }}>
          🟠 BLOQUEADO
        </span>
      </div>

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

        <svg width="1050" height="1480" viewBox="0 0 1050 1480">
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

            const estadoReal = t.esta_retrasado
              ? "RETRASADO"
              : t.task_estado;

            const color = svgColor[estadoReal] || svgColor.PENDIENTE;

            return (
              <g key={t.node_codigo}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="140"
                  height="58"
                  rx="12"
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth="2"
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
      </section>

      <table cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>Nodo</th>
            <th>Nombre</th>
            <th>Área</th>
            <th>Estado</th>
            <th>Responsable</th>
            <th>Días restantes</th>
            <th>Días vencido</th>
            <th>Acción</th>
          </tr>
        </thead>

        <tbody>
          {data.map((t) => {
            const style = t.esta_retrasado
              ? estadoStyle.RETRASADO
              : estadoStyle[t.task_estado] || estadoStyle.PENDIENTE;

            return (
              <tr key={t.task_id} style={style}>
                <td>{t.node_codigo}</td>
                <td>{t.nombre}</td>
                <td>{t.area_responsable}</td>
                <td>
                  <b>{t.esta_retrasado ? "RETRASADO" : t.task_estado}</b>
                </td>
                <td>{t.responsable}</td>
                <td>{t.dias_restantes ?? ""}</td>
                <td>{t.dias_vencido ?? ""}</td>
                <td>
                  {t.task_estado === "ACTIVO" ? (
                    <CompletarButton
                      workflowInstanceId={t.workflow_instance_id}
                      nodeCodigo={t.node_codigo}
                    />
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section
        style={{
          marginTop: 32,
          background: "white",
          border: "1px solid #dee2e6",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h3>Historial del expediente</h3>

        {logs.length === 0 ? (
          <p>No hay movimientos registrados todavía.</p>
        ) : (
          <table
            cellPadding="8"
            style={{
              borderCollapse: "collapse",
              width: "100%",
            }}
          >
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nodo</th>
                <th>Acción</th>
                <th>Comentario</th>
                <th>Usuario</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.created_at)}</td>
                  <td>{log.node_codigo}</td>
                  <td>{log.accion}</td>
                  <td>{log.comentario || "—"}</td>
                  <td>{log.usuario || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}