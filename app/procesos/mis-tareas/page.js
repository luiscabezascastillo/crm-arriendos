import Link from "next/link";
import { supabaseAdmin } from "@/src/lib/supabase";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-CL");
}

function getRowStyle(t) {
  if (t.esta_retrasado) {
    return {
      background: "#f8d7da",
      color: "#842029",
    };
  }

  return {
    background: "#fff3cd",
    color: "#7a4f00",
  };
}

function getEstadoVisual(t) {
  if (t.esta_retrasado) return "🔴 RETRASADA";
  return "🟡 ACTIVA";
}

export default async function MisTareasPage() {
  const { data, error } = await supabaseAdmin
    .from("vw_tareas_activas")
    .select("*")
    .order("esta_retrasado", { ascending: false })
    .order("fecha_limite", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Error cargando mis tareas</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  const total = data.length;
  const retrasadas = data.filter((t) => t.esta_retrasado).length;
  const activas = data.filter((t) => !t.esta_retrasado).length;

  return (
    <main style={{ padding: 24 }}>
      <h1>Mis tareas / tareas activas</h1>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(120px, 1fr))",
          gap: 12,
          margin: "16px 0",
        }}
      >
        <div style={{ padding: 12, background: "#f1f3f5", borderRadius: 8 }}>
          <b>Total</b>
          <div>{total}</div>
        </div>

        <div style={{ padding: 12, background: "#f8d7da", borderRadius: 8 }}>
          <b>Retrasadas</b>
          <div>{retrasadas}</div>
        </div>

        <div style={{ padding: 12, background: "#fff3cd", borderRadius: 8 }}>
          <b>Activas</b>
          <div>{activas}</div>
        </div>
      </section>

      <table
        cellPadding="8"
        style={{
          borderCollapse: "collapse",
          width: "100%",
        }}
      >
        <thead>
          <tr>
            <th>Estado</th>
            <th>IDADMON</th>
            <th>Nodo</th>
            <th>Tarea</th>
            <th>Área</th>
            <th>Responsable</th>
            <th>Fecha límite</th>
            <th>Días vencido</th>
            <th>Expediente</th>
          </tr>
        </thead>

        <tbody>
          {data.map((t) => (
            <tr
              key={`${t.workflow_instance_id}-${t.node_codigo}`}
              style={getRowStyle(t)}
            >
              <td>
                <b>{getEstadoVisual(t)}</b>
              </td>

              <td>
                <b>{t.idadmon}</b>
              </td>

              <td>{t.node_codigo}</td>

              <td>{t.nombre}</td>

              <td>{t.area_responsable}</td>

              <td>{t.responsable}</td>

              <td>{formatDate(t.fecha_limite)}</td>

              <td>
                {t.esta_retrasado ? t.dias_vencido : "—"}
              </td>

              <td>
                <Link href={`/procesos/terminos/${t.idadmon}`}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}