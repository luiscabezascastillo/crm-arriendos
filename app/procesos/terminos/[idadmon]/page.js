import { supabaseAdmin } from "@/src/lib/supabase";
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

      <GrafoTermino data={data} edges={edges} />

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
