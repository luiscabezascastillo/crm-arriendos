"use client";
// VERSION: 2026-08-28 · Importar WhatsApp: zona de arrastrar-soltar el ZIP + clic para elegir; el nombre del archivo ya no importa (la fecha sale del contenido del chat). Hereda versión previa.


import { useEffect, useMemo, useState } from "react";

function estadoTexto(estado) {
  if (estado === "ACCION_REQUERIDA") return "🔴 ACCIÓN";
  if (estado === "REVISAR") return "🟡 REVISAR";
  if (estado === "DEFICIT") return "🟡 DÉFICIT";
  if (estado === "OK") return "🟢 OK";
  return "⚪ PENDIENTE";
}

function numero(valor) {
  return Number(valor || 0).toFixed(2);
}

function hora(valor) {
  if (!valor) return "-";
  return String(valor).slice(11, 16);
}

export default function ControlAsistenciaPage() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [errorDashboard, setErrorDashboard] = useState(null);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState("TODOS");

  async function cargarDashboard() {
    try {
      setErrorDashboard(null);

      const res = await fetch("/api/control-asistencia/dashboard", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.ok) {
        setErrorDashboard(data.error || "No se pudo cargar el dashboard");
        return;
      }

      setDashboard(data);
    } catch (err) {
      setErrorDashboard(err.message || "Error cargando dashboard");
    }
  }

  useEffect(() => {
    cargarDashboard();
  }, []);

  async function importarZip() {
    if (!file) {
      alert("Selecciona un archivo ZIP primero");
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/control-asistencia/importar-whatsapp", {
        method: "POST",
        body: formData,
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { ok: false, error: `Respuesta no valida del servidor (HTTP ${res.status}): ${raw.slice(0, 300)}` };
      }
      if (!res.ok && data.ok !== false) {
        data = { ok: false, error: data.error || `Error HTTP ${res.status}` };
      }

      setResultado(data);
      if (data.ok) await cargarDashboard();
    } catch (e) {
      setResultado({ ok: false, error: "No se pudo importar: " + (e?.message || String(e)) });
    } finally {
      setLoading(false);
    }
  }

  const detalleFiltrado = useMemo(() => {
    const detalle = dashboard?.detalle || [];

    if (trabajadorSeleccionado === "TODOS") {
      return detalle;
    }

    return detalle.filter(
      (d) => String(d.trabajador_id) === String(trabajadorSeleccionado)
    );
  }, [dashboard, trabajadorSeleccionado]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Control de Asistencia</h1>

      <p style={{ color: "#666", maxWidth: 900 }}>
        Panel interno de Dirección. De momento solo muestra información; no
        envía correos ni comunica datos a trabajadores.
      </p>

      {errorDashboard && (
        <section
          style={{
            marginTop: 16,
            padding: 14,
            border: "1px solid #f5c2c7",
            borderRadius: 10,
            background: "#f8d7da",
            color: "#842029",
            maxWidth: 900,
          }}
        >
          Error cargando dashboard: {errorDashboard}
        </section>
      )}

      <section
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          maxWidth: 720,
        }}
      >
        <h2>Importar WhatsApp</h2>

        <p style={{ color: "#666" }}>
          Sube el ZIP exportado de WhatsApp (sin multimedia). El nombre del
          archivo da igual: la fecha se toma del propio chat.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files && e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
          onClick={() => document.getElementById("zipInput")?.click()}
          style={{
            marginTop: 12,
            padding: "26px 18px",
            border: "2px dashed " + (dragOver ? "#1D9E75" : "#cbd5e1"),
            borderRadius: 12,
            background: dragOver ? "#ECFDF5" : "#F9FAFB",
            textAlign: "center",
            cursor: "pointer",
            color: "#555",
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 26, marginBottom: 6 }}>📎</div>
          {file ? (
            <>
              Archivo listo: <b>{file.name}</b>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Arrastra otro o haz clic para cambiarlo</div>
            </>
          ) : (
            <>
              Arrastra aquí el ZIP de WhatsApp
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>o haz clic para seleccionarlo · el nombre da igual</div>
            </>
          )}
          <input
            id="zipInput"
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <button
          onClick={importarZip}
          disabled={loading || !file}
          style={{
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: (loading || !file) ? "#aaa" : "#1D9E75",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            cursor: (loading || !file) ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Procesando…" : "Pasar a CRM"}
        </button>

        {loading && (
          <div style={{ marginTop: 10, color: "#555", fontSize: 13 }}>
            Procesando el chat e insertando en el CRM… puede tardar unos segundos, no cierres la página.
          </div>
        )}
        {!loading && resultado && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: resultado.ok === false ? "#B91C1C" : "#065F46" }}>
            {resultado.ok === false
              ? "⚠ " + (resultado.error || "No se pudo importar")
              : "✓ Pasado al CRM: " + (resultado.mensajes_nuevos ?? 0) + " nuevos · " + (resultado.mensajes_duplicados ?? 0) + " ya estaban · " + (resultado.mensajes_no_validos ?? 0) + " no reconocidos."}
          </div>
        )}
      </section>

      {resultado && (
        <section
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid #ddd",
            borderRadius: 12,
            background: "#f8f9fa",
            maxWidth: 900,
          }}
        >
          <h2>Resultado importación</h2>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#111",
              color: "#9ef29e",
              padding: 16,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(resultado, null, 2)}
          </pre>
        </section>
      )}

      {dashboard && (
        <>
          <section
            style={{
              marginTop: 28,
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              maxWidth: 1200,
            }}
          >
            <h2>Resumen Ejecutivo</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th align="left" style={{ padding: 8 }}>
                    Trabajador
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Estado
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Horas mes
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Esperadas
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Saldo
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Críticas
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Informativas
                  </th>
                </tr>
              </thead>

              <tbody>
                {dashboard.resumen?.map((r) => (
                  <tr key={r.trabajador_id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{r.trabajador}</td>
                    <td style={{ padding: 8 }}>
                      {estadoTexto(r.estado_dashboard)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(r.horas_trabajadas_mes)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(r.horas_esperadas_mes_a_fecha)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(r.saldo_mes_a_fecha)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {r.incidencias_criticas_mes}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {r.incidencias_informativas_mes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            style={{
              marginTop: 24,
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              maxWidth: 1200,
            }}
          >
            <h2>Tendencia últimos 3 meses</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th align="left" style={{ padding: 8 }}>
                    Trabajador
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Mes
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Esperadas
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Trabajadas
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Saldo
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {dashboard.tendencia?.map((m, idx) => (
                  <tr
                    key={`${m.trabajador_id}-${m.mes}-${idx}`}
                    style={{ borderBottom: "1px solid #eee" }}
                  >
                    <td style={{ padding: 8 }}>{m.trabajador}</td>
                    <td style={{ padding: 8 }}>{String(m.mes).slice(0, 7)}</td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(m.horas_esperadas_mes)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(m.horas_trabajadas_mes)}
                    </td>
                    <td align="right" style={{ padding: 8 }}>
                      {numero(m.saldo_mes)}
                    </td>
                    <td style={{ padding: 8 }}>{estadoTexto(m.estado_mes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            style={{
              marginTop: 24,
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              maxWidth: 1200,
            }}
          >
            <h2>Incidencias abiertas</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th align="left" style={{ padding: 8 }}>
                    Fecha
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Trabajador
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Incidencia
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {dashboard.incidencias?.slice(0, 30).map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{i.fecha}</td>
                    <td style={{ padding: 8 }}>
                      {i.control_asistencia_trabajadores?.nombre_real || "-"}
                    </td>
                    <td style={{ padding: 8 }}>{i.tipo}</td>
                    <td style={{ padding: 8 }}>{i.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            style={{
              marginTop: 24,
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              maxWidth: 1200,
            }}
          >
            <h2>Detalle diario reciente</h2>

            <div style={{ marginBottom: 16 }}>
              <label>
                Trabajador:{" "}
                <select
                  value={trabajadorSeleccionado}
                  onChange={(e) => setTrabajadorSeleccionado(e.target.value)}
                >
                  <option value="TODOS">Todos</option>
                  {dashboard.resumen?.map((r) => (
                    <option key={r.trabajador_id} value={r.trabajador_id}>
                      {r.trabajador}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th align="left" style={{ padding: 8 }}>
                    Fecha
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Trabajador
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Inicio
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Fin
                  </th>
                  <th align="right" style={{ padding: 8 }}>
                    Horas netas
                  </th>
                  <th align="left" style={{ padding: 8 }}>
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {detalleFiltrado.slice(0, 50).map((d, idx) => (
                  <tr
                    key={`${d.trabajador_id}-${d.fecha}-${idx}`}
                    style={{ borderBottom: "1px solid #eee" }}
                  >
                    <td style={{ padding: 8 }}>{d.fecha}</td>
                    <td style={{ padding: 8 }}>{d.trabajador}</td>
                    <td style={{ padding: 8 }}>{hora(d.inicio_jornada)}</td>
                    <td style={{ padding: 8 }}>{hora(d.fin_jornada)}</td>
                    <td align="right" style={{ padding: 8 }}>
                      {d.horas_trabajadas_netas !== null
                        ? numero(d.horas_trabajadas_netas)
                        : "-"}
                    </td>
                    <td style={{ padding: 8 }}>{d.cumplimiento_reglamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}