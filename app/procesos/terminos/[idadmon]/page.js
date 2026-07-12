// VERSION: v2 · 2026-07-12 · app/procesos/terminos/[idadmon]/page.js
//   FIX del enlace que "no abría" tras el cambio de workflow:
//   1) Import del cliente Supabase consolidado a @/lib/supabaseAdmin (antes @/src/lib/supabase,
//      la única ruta distinta del proyecto → si ese módulo se movió/renombró, supabaseAdmin quedaba
//      undefined y la página reventaba al renderizar).
//   2) Blindaje: data/edges/logs con guardas (nunca .length/.map sobre null).
//   3) Estado vacío amable: si el término no tiene expediente de workflow (p. ej. backlog viejo
//      pasado a Q antes del circuito automático), se avisa en vez de mostrar una página muerta.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CompletarButton from "./CompletarButton";
import GrafoTermino from "./GrafoTermino";

const estadoStyle = {
  COMPLETADO: { background: "#d8f3dc", color: "#1b5e20" },
  ACTIVO: { background: "#fff3cd", color: "#7a4f00" },
  PENDIENTE: { background: "#e9ecef", color: "#495057" },
  RETRASADO: { background: "#f8d7da", color: "#842029" },
  BLOQUEADO: { background: "#ffe5b4", color: "#8a4b00" },
};

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

  const tasks = Array.isArray(data) ? data : [];
  const edgeList = Array.isArray(edges) ? edges : [];

  const workflowInstanceId = tasks[0]?.workflow_instance_id;

  const { data: logs, error: logsError } = workflowInstanceId
    ? await supabaseAdmin
        .from("workflow_task_logs")
        .select("*")
        .eq("workflow_instance_id", workflowInstanceId)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  // Error real de consulta (tabla/vista/columna) -> mensaje claro, no pantalla muerta.
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

  // Término sin expediente de workflow (no hay instancia de TERMINO para este IDADMON).
  if (tasks.length === 0) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Workflow de término</h1>
        <h2>IDADMON: {idadmon}</h2>
        <p
          style={{
            marginTop: 16,
            padding: 16,
            background: "#fff3cd",
            color: "#7a4f00",
            borderRadius: 8,
            lineHeight: 1.5,
          }}
        >
          Este término todavía <b>no tiene expediente de workflow</b> (no existe una instancia de
          TERMINO para {idadmon}). El expediente se crea automáticamente al pasar el contrato a{" "}
          <b>Q</b>. Si este contrato ya está en Q y aún no aparece, es probable que sea un término
          antiguo anterior al circuito automático — avísame y le generamos la instancia para que
          entre al proceso de 45 días.
        </p>
      </main>
    );
  }

  const logList = Array.isArray(logs) ? logs : [];

  const total = tasks.length;
  const completadas = tasks.filter((t) => t.task_estado === "COMPLETADO").length;
  const activas = tasks.filter((t) => t.task_estado === "ACTIVO").length;
  const pendientes = tasks.filter((t) => t.task_estado === "PENDIENTE").length;
  const retrasadas = tasks.filter((t) => t.esta_retrasado).length;
  const avance = total > 0 ? Math.round((completadas / total) * 1000) / 10 : 0;

  const responsablesActivos = [
    ...new Set(
      tasks
        .filter((t) => t.task_estado === "ACTIVO")
        .map((t) => t.responsable)
    ),
  ]
    .filter(Boolean)
    .join(" / ");

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

      <GrafoTermino data={tasks} edges={edgeList} />

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
          {tasks.map((t) => {
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

        {logList.length === 0 ? (
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