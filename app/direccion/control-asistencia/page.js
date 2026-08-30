"use client";
// VERSION: 2026-08-30g · Secciones cerradas por defecto. Resumen semanal extraído a componente reutilizable ResumenSemanal (compartido con Mi Portal). Hereda 30f (teórica L-V fija).


import React, { useEffect, useMemo, useState } from "react";
import PersonalNav from "../../components/ui/PersonalNav";
import { useSession } from "next-auth/react";
import ResumenSemanal from "../../components/ui/ResumenSemanal";
import TopNav from "@/app/components/ui/TopNav";
import FinancieroNav from "@/app/components/ui/FinancieroNav";

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


const TIPO_AUS = { VACACIONES: "Vacaciones", LICENCIA: "Licencia médica", PERMISO: "Permiso" };
const secFicha = { marginTop: 16, border: "1px solid #ddd", borderRadius: 12, background: "#fff", maxWidth: 1200, overflow: "hidden" };
const thF = { padding: 8 };

function Seccion({ titulo, abierto, onToggle, children }) {
  return (
    <section style={secFicha}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "13px 20px", userSelect: "none" }}>
        <span style={{ fontSize: 13, color: "#6b7280", width: 12 }}>{abierto ? "▾" : "▸"}</span>
        <h2 style={{ margin: 0, fontSize: 16 }}>{titulo}</h2>
      </div>
      {abierto && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
    </section>
  );
}

function FichaTrabajador({ ficha, dashboard, ausencias, detalleTrab, calendario, esDireccion, onClose }) {
  const tid = ficha.trabajador_id;
  const tend = (dashboard?.tendencia || []).filter((m) => String(m.trabajador_id) === String(tid));
  const inci = (dashboard?.incidencias || []).filter((i) => String(i.trabajador_id) === String(tid));
  const aus = (ausencias || []).filter((a) => String(a.trabajador_id) === String(tid));
  const cargandoDet = detalleTrab === null;
  const det = (detalleTrab && detalleTrab.length ? detalleTrab : (dashboard?.detalle || []).filter((d) => String(d.trabajador_id) === String(tid)));

  const [open, setOpen] = useState({ mes: false, sem: false, aus: false, tend: false, inci: false, diario: false });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const card = (label, value) => (
    <div style={{ flex: "1 1 130px", minWidth: 130, padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fafafa" }}>
      <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}>← Volver al resumen</button>
        {esDireccion && (
          <a href={`/mi-portal?trab=${tid}`} style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 8, border: "1px solid #6366f1", background: "#eef2ff", color: "#3730a3", marginLeft: 10, textDecoration: "none", display: "inline-block" }}>Ver ficha completa (portal del trabajador) →</a>
        )}
      </div>
      <h1 style={{ margin: "0 0 2px" }}>{ficha.trabajador}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Ficha de personal — asistencia y ausencias. Toca cada título para abrir o cerrar.</p>

      <Seccion titulo="Este mes" abierto={open.mes} onToggle={() => toggle("mes")}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {card("Estado", estadoTexto(ficha.estado_dashboard))}
          {card("Horas mes", numero(ficha.horas_trabajadas_mes))}
          {card("Esperadas", numero(ficha.horas_esperadas_mes_a_fecha))}
          {card("Saldo", numero(ficha.saldo_mes_a_fecha))}
          {card("Críticas", ficha.incidencias_criticas_mes ?? 0)}
          {card("Informativas", ficha.incidencias_informativas_mes ?? 0)}
        </div>
      </Seccion>

      <Seccion titulo="Resumen semanal (últimos 2 meses · incluye sábados)" abierto={open.sem} onToggle={() => toggle("sem")}>
        <ResumenSemanal detalle={det} calendario={calendario} ausencias={aus} cargando={cargandoDet} />
      </Seccion>

      <Seccion titulo="Vacaciones y ausencias" abierto={open.aus} onToggle={() => toggle("aus")}>
        {aus.length === 0 ? (<div style={{ color: "#888" }}>Sin ausencias registradas.</div>) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #ddd" }}>
              <th align="left" style={thF}>Tipo</th><th align="left" style={thF}>Desde</th><th align="left" style={thF}>Hasta</th><th align="right" style={thF}>Días hábiles</th><th align="left" style={thF}>Motivo</th>
            </tr></thead>
            <tbody>{aus.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={thF}>{TIPO_AUS[a.tipo] || a.tipo}</td>
                <td style={thF}>{a.fecha_inicio}</td>
                <td style={thF}>{a.fecha_fin}</td>
                <td align="right" style={thF}>{a.dias_habiles}</td>
                <td style={thF}>{a.motivo || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Seccion>

      <Seccion titulo="Tendencia últimos 3 meses" abierto={open.tend} onToggle={() => toggle("tend")}>
        {tend.length === 0 ? (<div style={{ color: "#888" }}>Sin datos.</div>) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #ddd" }}>
              <th align="left" style={thF}>Mes</th><th align="right" style={thF}>Esperadas</th><th align="right" style={thF}>Trabajadas</th><th align="right" style={thF}>Saldo</th><th align="left" style={thF}>Estado</th>
            </tr></thead>
            <tbody>{tend.map((m, idx) => (
              <tr key={`${m.mes}-${idx}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={thF}>{String(m.mes).slice(0, 7)}</td>
                <td align="right" style={thF}>{numero(m.horas_esperadas_mes)}</td>
                <td align="right" style={thF}>{numero(m.horas_trabajadas_mes)}</td>
                <td align="right" style={thF}>{numero(m.saldo_mes)}</td>
                <td style={thF}>{estadoTexto(m.estado_mes)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Seccion>

      <Seccion titulo="Incidencias abiertas" abierto={open.inci} onToggle={() => toggle("inci")}>
        {inci.length === 0 ? (<div style={{ color: "#888" }}>Sin incidencias abiertas.</div>) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #ddd" }}>
              <th align="left" style={thF}>Fecha</th><th align="left" style={thF}>Incidencia</th><th align="left" style={thF}>Estado</th>
            </tr></thead>
            <tbody>{inci.map((i) => (
              <tr key={i.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={thF}>{i.fecha}</td><td style={thF}>{i.tipo}</td><td style={thF}>{i.estado}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Seccion>

      <Seccion titulo={`Detalle diario 2026 completo (${det.length} días)`} abierto={open.diario} onToggle={() => toggle("diario")}>
        {cargandoDet ? (<div style={{ color: "#888" }}>Cargando el histórico…</div>) : det.length === 0 ? (<div style={{ color: "#888" }}>Sin registros.</div>) : (
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead><tr style={{ borderBottom: "1px solid #ddd" }}>
              <th align="left" style={thF}>Fecha</th><th align="left" style={thF}>Inicio</th><th align="left" style={thF}>Fin</th><th align="right" style={thF}>Horas netas</th><th align="left" style={thF}>Estado</th>
            </tr></thead>
            <tbody>{det.map((d, idx) => (
              <tr key={`${d.fecha}-${idx}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={thF}>{String(d.fecha).slice(0, 10)}</td>
                <td style={thF}>{hora(d.inicio_jornada)}</td>
                <td style={thF}>{hora(d.fin_jornada)}</td>
                <td align="right" style={thF}>{d.horas_trabajadas_netas !== null ? numero(d.horas_trabajadas_netas) : "-"}</td>
                <td style={thF}>{d.cumplimiento_reglamento}</td>
              </tr>
            ))}</tbody>
          </table>
          </div>
        )}
      </Seccion>
    </div>
  );
}

export default function ControlAsistenciaPage() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [errorDashboard, setErrorDashboard] = useState(null);
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState("TODOS");
  const [ficha, setFicha] = useState(null);
  const [ausencias, setAusencias] = useState([]);
  const [showFin, setShowFin] = useState(false);
  const { data: session } = useSession();
  const esDireccion = ["alberto.cabezas@fondocapital.com", "luis.cabezas@fondocapital.com"].includes(session?.user?.email);
  const [detalleTrab, setDetalleTrab] = useState(null);
  const [calendario, setCalendario] = useState([]);

  async function abrirFicha(r) {
    setFicha(r);
    setDetalleTrab(null);
    try {
      const res = await fetch(`/api/control-asistencia/detalle-trabajador?id=${r.trabajador_id}`, { cache: "no-store" });
      const data = await res.json();
      setDetalleTrab(data.detalle || []);
      setCalendario(data.calendario || []);
    } catch {
      setDetalleTrab([]);
      setCalendario([]);
    }
  }

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

  async function cargarAusencias() {
    try {
      const res = await fetch("/api/control-asistencia/ausencias", { cache: "no-store" });
      const data = await res.json();
      setAusencias(data.ausencias || []);
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    cargarDashboard();
    cargarAusencias();
    setShowFin(new URLSearchParams(window.location.search).get("fin") === "1");
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
    <>
      <TopNav />
      {showFin && <FinancieroNav activo="ausencias" />}
      <main style={{ padding: 24 }}>
      <PersonalNav activo="asistencia" fin={showFin} />
      {ficha ? (
        <FichaTrabajador ficha={ficha} dashboard={dashboard} ausencias={ausencias} detalleTrab={detalleTrab} calendario={calendario} esDireccion={esDireccion} onClose={() => setFicha(null)} />
      ) : (
      <>
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
                    <td style={{ padding: 8 }}><button onClick={() => abrirFicha(r)} style={{ background: "none", border: "none", padding: 0, color: "#085041", fontWeight: 600, fontSize: "inherit", fontFamily: "inherit", cursor: "pointer", textDecoration: "underline" }}>{r.trabajador}</button></td>
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
      </>
      )}
    </main>
    </>
  );
}