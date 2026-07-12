// VERSION: v3 · 2026-07-12 · app/procesos/terminos/[idadmon]/page.js
//   Vista NUEVA del término por las 7 ETAPAS (0-6) del modelo desplegado en B2.2:
//   - Bandas por etapa (workflow_etapas): ventana de días, responsable visible, 🔒 compuerta dura,
//     ⏱ si cuenta al reloj; la etapa en curso se resalta.
//   - Nodos agrupados en su etapa (workflow_nodes.etapa_numero), como tarjetas coloreadas por
//     estado, con descripción y botón Completar en los ACTIVOS.
//   - Reloj de 45 días arriba (si terminos.fecha_entrega existe).
//   - Se conserva el grafo de dependencias (abajo) y el historial.
//   Import consolidado a @/lib/supabaseAdmin y guardas de null (heredado de v2).
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CompletarButton from "./CompletarButton";
import GrafoTermino from "./GrafoTermino";

const nodeColor = {
  COMPLETADO: { bg: "#d8f3dc", bd: "#2f9e44", tx: "#1b5e20" },
  ACTIVO: { bg: "#fff3cd", bd: "#f59f00", tx: "#7a4f00" },
  PENDIENTE: { bg: "#f1f3f5", bd: "#ced4da", tx: "#495057" },
  RETRASADO: { bg: "#f8d7da", bd: "#e03131", tx: "#842029" },
  BLOQUEADO: { bg: "#ffe5b4", bd: "#f08c00", tx: "#8a4b00" },
};

function estadoDe(t) {
  return t.esta_retrasado ? "RETRASADO" : (t.task_estado || "PENDIENTE");
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

  const { data: etapasRaw } = await supabaseAdmin
    .from("workflow_etapas")
    .select("*")
    .eq("workflow_codigo", "TERMINO")
    .order("numero", { ascending: true });

  const { data: nodosRaw } = await supabaseAdmin
    .from("workflow_nodes")
    .select("codigo, etapa_numero, orden_visual")
    .eq("workflow_codigo", "TERMINO");

  const tasks = Array.isArray(data) ? data : [];
  const edgeList = Array.isArray(edges) ? edges : [];
  const etapas = Array.isArray(etapasRaw) ? etapasRaw : [];
  const nodos = Array.isArray(nodosRaw) ? nodosRaw : [];

  const workflowInstanceId = tasks[0]?.workflow_instance_id;

  const { data: logs, error: logsError } = workflowInstanceId
    ? await supabaseAdmin
        .from("workflow_task_logs")
        .select("*")
        .eq("workflow_instance_id", workflowInstanceId)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const { data: term } = await supabaseAdmin
    .from("terminos")
    .select("fecha_entrega")
    .eq("idadmon", idadmon)
    .maybeSingle();

  if (error || edgeError || logsError) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Error cargando workflow</h1>
        <p>IDADMON: {idadmon}</p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f8d7da", color: "#842029", padding: 12, borderRadius: 8 }}>
          {error?.message || edgeError?.message || logsError?.message}
        </pre>
      </main>
    );
  }

  if (tasks.length === 0) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Workflow de término</h1>
        <h2>IDADMON: {idadmon}</h2>
        <p style={{ marginTop: 16, padding: 16, background: "#fff3cd", color: "#7a4f00", borderRadius: 8, lineHeight: 1.5 }}>
          Este término todavía <b>no tiene expediente de workflow</b> (no existe una instancia de
          TERMINO para {idadmon}). El expediente se crea automáticamente al pasar el contrato a{" "}
          <b>Q</b>. Si ya está en Q y no aparece, es un término anterior al circuito automático —
          avísame y le generamos la instancia.
        </p>
      </main>
    );
  }

  const logList = Array.isArray(logs) ? logs : [];

  // Mapa nodo -> etapa (desde workflow_nodes, no dependemos de que la vista lo exponga).
  const etapaDeNodo = {};
  for (const n of nodos) etapaDeNodo[n.codigo] = n.etapa_numero;

  // Agrupar tareas por etapa.
  const porEtapa = {};
  for (const t of tasks) {
    const e = etapaDeNodo[t.node_codigo];
    const key = e === null || e === undefined ? "sin" : String(e);
    (porEtapa[key] = porEtapa[key] || []).push(t);
  }

  // Reloj de 45 días (si hay fecha de entrega / Q registrada).
  let diaActual = null;
  if (term?.fecha_entrega) {
    const ms = Date.now() - new Date(String(term.fecha_entrega).slice(0, 10) + "T00:00:00").getTime();
    diaActual = Math.floor(ms / 86400000);
  }

  // KPIs.
  const total = tasks.length;
  const completadas = tasks.filter((t) => t.task_estado === "COMPLETADO").length;
  const activas = tasks.filter((t) => t.task_estado === "ACTIVO").length;
  const retrasadas = tasks.filter((t) => t.esta_retrasado).length;
  const avance = total > 0 ? Math.round((completadas / total) * 1000) / 10 : 0;

  // Lista de etapas a pintar: las definidas + una "sin etapa" si hubiera nodos sueltos.
  const bandas = etapas.length
    ? etapas.map((et) => ({ et, list: porEtapa[String(et.numero)] || [] }))
    : [{ et: { numero: "—", nombre: "Todos los nodos", dia_desde: null, dia_hasta: null, responsable_visible: "", compuerta_dura: false, cuenta_reloj: false }, list: tasks }];
  const sueltos = porEtapa["sin"] || [];

  const chip = (bg, tx, bd) => ({ background: bg, color: tx, border: `1px solid ${bd || bg}`, padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600 });

  function NodoCard({ t }) {
    const c = nodeColor[estadoDe(t)] || nodeColor.PENDIENTE;
    return (
      <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 10, padding: 12, width: 260, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <b style={{ color: c.tx, fontSize: 13 }}>{t.node_codigo}</b>
          <span style={{ ...chip(c.bg, c.tx, c.bd), fontSize: 11 }}>{estadoDe(t)}</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "#212529", marginBottom: 6 }}>{t.nombre}</div>
        <div style={{ fontSize: 11, color: "#6c757d", marginBottom: 6 }}>
          {(t.responsable || t.area_responsable || "—")}
          {t.esta_retrasado && t.dias_vencido != null ? ` · vencido ${t.dias_vencido} d` : (t.dias_restantes != null ? ` · ${t.dias_restantes} d rest.` : "")}
        </div>
        {t.descripcion ? (
          <div style={{ fontSize: 11, color: "#495057", lineHeight: 1.45, marginBottom: t.task_estado === "ACTIVO" ? 8 : 0 }}>{t.descripcion}</div>
        ) : null}
        {t.task_estado === "ACTIVO" ? (
          <CompletarButton workflowInstanceId={t.workflow_instance_id} nodeCodigo={t.node_codigo} />
        ) : null}
      </div>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 2 }}>Workflow de término</h1>
      <h2 style={{ marginTop: 0, color: "#495057" }}>IDADMON: {idadmon}</h2>

      {/* Reloj de 45 días */}
      <section style={{ background: "#fff", border: "1px solid #dee2e6", borderRadius: 12, padding: 16, margin: "12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <b>Reloj del término (objetivo: 45 días desde la entrega de llaves)</b>
          <span style={{ fontSize: 13, color: "#495057" }}>
            {diaActual != null ? `Día ${diaActual} de 45` : "Sin fecha de entrega registrada"}
          </span>
        </div>
        {diaActual != null ? (
          <div style={{ width: "100%", height: 16, background: "#e9ecef", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, (diaActual / 45) * 100))}%`, height: "100%", background: diaActual > 45 ? "#e03131" : "#2f9e44" }} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#7a4f00", background: "#fff3cd", padding: 8, borderRadius: 6 }}>
            El reloj arranca al registrar la entrega de llaves (paso a Q). Este término aún no tiene fecha de entrega en el expediente.
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: "#495057" }}>
          Avance: <b>{avance}%</b> · Completadas {completadas}/{total} · Activas {activas} · Retrasadas {retrasadas}
        </div>
      </section>

      {/* Bandas por etapa */}
      <section style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        {bandas.map(({ et, list }) => {
          const enReloj = et.cuenta_reloj;
          const ventana =
            et.dia_desde == null && et.dia_hasta == null
              ? (enReloj ? "sin ventana" : "fuera de reloj")
              : `días ${et.dia_desde}–${et.dia_hasta}`;
          const enCurso =
            diaActual != null && enReloj && et.dia_desde != null &&
            diaActual >= et.dia_desde && diaActual <= et.dia_hasta;

          return (
            <div
              key={String(et.numero)}
              style={{
                background: "#fff",
                border: "1px solid #dee2e6",
                borderLeft: enCurso ? "5px solid #2f9e44" : "5px solid #ced4da",
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#212529" }}>
                  Etapa {et.numero} · {et.nombre}
                </span>
                {enCurso ? <span style={chip("#d8f3dc", "#1b5e20", "#2f9e44")}>EN CURSO</span> : null}
                <span style={chip("#e7f5ff", "#1971c2", "#a5d8ff")}>{ventana}</span>
                {et.responsable_visible ? <span style={chip("#f1f3f5", "#495057")}>{et.responsable_visible}</span> : null}
                {et.compuerta_dura ? <span style={chip("#ffe3e3", "#c92a2a", "#ffc9c9")}>🔒 compuerta</span> : null}
                <span style={chip("#f8f9fa", "#868e96")}>{enReloj ? "⏱ cuenta al reloj" : "fuera del reloj"}</span>
              </div>

              {list.length === 0 ? (
                <div style={{ fontSize: 12, color: "#adb5bd" }}>Sin nodos en esta etapa.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {list.map((t) => <NodoCard key={t.task_id} t={t} />)}
                </div>
              )}
            </div>
          );
        })}

        {/* Nodos sin etapa asignada (no debería haber, pero por si acaso) */}
        {sueltos.length > 0 && etapas.length ? (
          <div style={{ background: "#fff", border: "1px dashed #ced4da", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: "#868e96" }}>Nodos sin etapa asignada</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {sueltos.map((t) => <NodoCard key={t.task_id} t={t} />)}
            </div>
          </div>
        ) : null}
      </section>

      {/* Grafo de dependencias (se conserva) */}
      <GrafoTermino data={tasks} edges={edgeList} />

      {/* Historial */}
      <section style={{ marginTop: 24, background: "white", border: "1px solid #dee2e6", borderRadius: 12, padding: 16 }}>
        <h3>Historial del expediente</h3>
        {logList.length === 0 ? (
          <p>No hay movimientos registrados todavía.</p>
        ) : (
          <table cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
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
              {logList.map((log) => (
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