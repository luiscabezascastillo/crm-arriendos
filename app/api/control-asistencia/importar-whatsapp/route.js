import { NextResponse } from "next/server";
import JSZip from "jszip";
import crypto from "crypto";
import { supabaseAdmin } from "@/src/lib/supabase";

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseFechaWhatsApp(fecha, hora) {
  const [dia, mes, anio] = fecha.split("/").map(Number);
  const [hh, mm, ss] = hora.split(":").map(Number);

  return new Date(anio, mes - 1, dia, hh, mm, ss);
}

function hashMensaje({ fechaHora, trabajador, texto }) {
  return crypto
    .createHash("sha256")
    .update(`${fechaHora}|${trabajador}|${texto}`)
    .digest("hex");
}

function parsearMensajesWhatsApp(texto) {
  const lineas = texto.split(/\r?\n/);
  const mensajes = [];

  const patron =
    /^\[(\d{1,2}\/\d{1,2}\/\d{4}),\s+(\d{1,2}:\d{2}:\d{2})\]\s([^:]+):\s([\s\S]*)$/;

  for (const linea of lineas) {
    const match = linea.match(patron);

    if (!match) continue;

    const [, fecha, hora, trabajador, textoMensaje] = match;

    const fechaHora = parseFechaWhatsApp(fecha, hora);

    // Ignorar todas las pruebas anteriores a 2026
    if (fechaHora.getFullYear() < 2026) {
      continue;
    }

    mensajes.push({
      fecha_hora: fechaHora.toISOString(),
      trabajador: trabajador.trim(),
      texto_original: textoMensaje.trim(),
      texto_normalizado: normalizarTexto(textoMensaje),
    });
  }

  return mensajes;
}

async function obtenerAlias() {
  const { data, error } = await supabaseAdmin
    .from("control_asistencia_eventos_alias")
    .select("texto_normalizado, codigo_evento")
    .eq("activo", true);

  if (error) throw new Error(error.message);

  const mapa = new Map();

  for (const item of data || []) {
    mapa.set(normalizarTexto(item.texto_normalizado), item.codigo_evento);
  }

  return mapa;
}

async function obtenerTrabajadores() {
  const { data, error } = await supabaseAdmin
    .from("control_asistencia_trabajadores")
    .select("id, nombre_whatsapp")
    .eq("activo", true);

  if (error) throw new Error(error.message);

  const mapa = new Map();

  for (const t of data || []) {
    mapa.set(normalizarTexto(t.nombre_whatsapp), t.id);
  }

  return mapa;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    modulo: "CONTROL_ASISTENCIA",
    endpoint: "importar-whatsapp",
    estado: "OPERATIVO",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "No se recibió archivo" },
        { status: 400 }
      );
    }

    const archivo = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    const chatFileName = Object.keys(zip.files).find((name) =>
      name.toLowerCase().endsWith(".txt")
    );

    if (!chatFileName) {
      return NextResponse.json(
        { ok: false, error: "El ZIP no contiene archivo TXT" },
        { status: 400 }
      );
    }

    const chatTxt = await zip.files[chatFileName].async("string");
    const mensajes = parsearMensajesWhatsApp(chatTxt);

    const aliasMap = await obtenerAlias();
    const trabajadoresMap = await obtenerTrabajadores();

    let { data: importacion, error: errorImportacion } = await supabaseAdmin
      .from("control_asistencia_importaciones")
      .select("*")
      .eq("archivo", archivo)
      .maybeSingle();

    if (errorImportacion) {
      return NextResponse.json(
        { ok: false, error: errorImportacion.message },
        { status: 500 }
      );
    }

    if (!importacion) {
      const { data: nueva, error } = await supabaseAdmin
        .from("control_asistencia_importaciones")
        .insert({
          archivo,
          estado: "PROCESANDO",
          mensajes_leidos: mensajes.length,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      importacion = nueva;
    }

    const eventos = mensajes.map((m) => {
      const evento = aliasMap.get(m.texto_normalizado) || null;
      const trabajadorId =
        trabajadoresMap.get(normalizarTexto(m.trabajador)) || null;

      const tipo = evento ? "EVENTO_VALIDO" : "MENSAJE_NO_VALIDO";
      const estado = evento ? "OK" : "OBSERVACION";

      return {
        hash_mensaje: hashMensaje({
          fechaHora: m.fecha_hora,
          trabajador: m.trabajador,
          texto: m.texto_original,
        }),
        importacion_id: importacion.id,
        archivo_origen: archivo,
        fecha_hora: m.fecha_hora,
        trabajador: m.trabajador,
        trabajador_id: trabajadorId,
        texto_original: m.texto_original,
        evento,
        tipo,
        estado,
      };
    });

    const lote = 500;
    let insertados = 0;
    let duplicados = 0;

    for (let i = 0; i < eventos.length; i += lote) {
      const chunk = eventos.slice(i, i + lote);

      const { data: inserted, error } = await supabaseAdmin
        .from("control_asistencia_eventos")
        .upsert(chunk, {
          onConflict: "hash_mensaje",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      insertados += inserted?.length || 0;
      duplicados += chunk.length - (inserted?.length || 0);
    }

    const noValidos = eventos.filter(
      (e) => e.tipo === "MENSAJE_NO_VALIDO"
    ).length;

    const { data: actualizado, error: errorUpdate } = await supabaseAdmin
      .from("control_asistencia_importaciones")
      .update({
        estado: "IMPORTADO",
        mensajes_leidos: mensajes.length,
        mensajes_nuevos: insertados,
        mensajes_duplicados: duplicados,
        mensajes_no_validos: noValidos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importacion.id)
      .select()
      .single();

    if (errorUpdate) {
      return NextResponse.json(
        { ok: false, error: errorUpdate.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      importacion_id: actualizado.id,
      archivo,
      txt: chatFileName,
      estado: actualizado.estado,
      mensajes_leidos: mensajes.length,
      mensajes_nuevos: insertados,
      mensajes_duplicados: duplicados,
      mensajes_no_validos: noValidos,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Error inesperado" },
      { status: 500 }
    );
  }
}