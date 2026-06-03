import Link from "next/link";
import { supabaseAdmin } from "@/src/lib/supabase";

function getSemaforo(t) {
  if (Number(t.retrasadas) > 0) return "🔴";
  if (Number(t.avance_pct) === 100) return "🟢";
  if (Number(t.activas) > 0) return "🟡";
  return "⚪";
}

function getRowStyle(t) {
  if (Number(t.retrasadas) > 0) {
    return {
      background: "#f8d7da",
      color: "#842029",
    };
  }

  if (Number(t.avance_pct) === 100) {
    return {
      background: "#d8f3dc",
      color: "#1b5e20",
    };
  }

  if (Number(t.activas) > 0) {
    return {
      background: "#fff3cd",
      color: "#7a4f00",
    };
  }

  return {
    background: "#e9ecef",
    color: "#495057",
  };
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("es-CL");
}

export default async function TerminosPage() {
  const { data, error } = await supabaseAdmin
    .from("vw_workflow_resumen")
    .select("*")
    .order("retrasadas", { ascending: false })
    .order("activas", { ascending: false })
    .order("fecha_inicio", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Error cargando términos</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard de términos</h1>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: "#f8d7da",
            color: "#842029",
            padding: "6px 12px",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          🔴 Con retrasos
        </span>

        <span
          style={{
            background: "#fff3cd",
            color: "#7a4f00",
            padding: "6px 12px",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          🟡 En curso
        </span>

        <span
          style={{
            background: "#d8f3dc",
            color: "#1b5e20",
            padding: "6px 12px",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          🟢 Completado
        </span>

        <span
          style={{
            background: "#e9ecef",
            color: "#495057",
            padding: "6px 12px",
            borderRadius: 6,
            fontWeight: "bold",
          }}
        >
          ⚪ Sin actividad activa
        </span>
      </div>

      <table
        cellPadding="8"
        style={{
          borderCollapse: "collapse",
          width: "100%",
        }}
      >
        <thead>
          <tr>
            <th>Semáforo</th>
            <th>IDADMON</th>
            <th>Estado</th>
            <th>Inicio</th>
            <th>Días abiertos</th>
            <th>Nodos activos</th>
            <th>Avance</th>
            <th>Total</th>
            <th>Completadas</th>
            <th>Activas</th>
            <th>Pendientes</th>
            <th>Retrasadas</th>
            <th>Responsable actual</th>
            <th>Ver</th>
          </tr>
        </thead>

        <tbody>
          {data.map((t) => {
            const avance = Number(t.avance_pct || 0);

            return (
              <tr
                key={t.workflow_instance_id}
                style={getRowStyle(t)}
              >
                <td style={{ textAlign: "center", fontSize: 20 }}>
                  {getSemaforo(t)}
                </td>

                <td>
                  <b>{t.idadmon}</b>
                </td>

                <td>{t.workflow_estado}</td>

                <td>{formatDate(t.fecha_inicio)}</td>

                <td>{t.dias_abierto}</td>

                <td>{t.nodos_activos || "—"}</td>

                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 120,
                        height: 12,
                        background: "#ffffff99",
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

                    <span>{avance}%</span>
                  </div>
                </td>

                <td>{t.total_tareas}</td>
                <td>{t.completadas}</td>
                <td>{t.activas}</td>
                <td>{t.pendientes}</td>

                <td style={{ fontWeight: "bold" }}>
                  {t.retrasadas}
                </td>

                <td>{t.responsables_activos || "—"}</td>

                <td>
                  <Link href={`/procesos/terminos/${t.idadmon}`}>
                    Abrir
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}