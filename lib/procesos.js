// lib/procesos.js
// Fuente única de verdad del catálogo de procesos del Motor.
// Lo consumen: app/procesos/page.js (tarjetas) y app/components/ui/TopNav.js (desplegable).
// Para subir un proceso a la franja/menú 'en producción': añadir produccion: true.

// Un solo listado, agrupado por `responsable` en el render.
// frecuencia = Mensual | Semanal | Puntual (informativa)
export const PROCESOS = [
  // ── VENTAS ──
  { key: 'publicacion', titulo: 'Publicación', responsable: 'Ventas', participa: [], frecuencia: 'Puntual', produccion: true,
    descripcion: 'Depto vacío → candidato',
    etapas: ['Detectar', 'Publicar', 'Visitas', 'Selección', 'Cierre'], conecta: null, href: '/publicaciones' },
  { key: 'inicios', titulo: 'Inicios', responsable: 'Ventas', participa: ['Legal', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Contrato, firma y ciclo mensual',
    etapas: ['Validar', 'Contrato', 'Firma', 'LOG', 'Activar'], conecta: null, href: null },

  // ── ADMINISTRACIÓN ──
  { key: 'servicios', titulo: 'Servicios', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual', produccion: true,
    descripcion: 'Consulta y carga mensual deudas de servicios',
    etapas: [], conecta: null, href: '/op/deudas' },
  { key: 'descuentos', titulo: 'Descuentos', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Semanal', produccion: true,
    descripcion: 'Descuentos a propietarios',
    etapas: ['Revisar', 'Autorizar', 'Aplicar', 'Confirmar'], conecta: 'Liquidación', href: '/procesos/descuentos' },
  { key: 'cobranza', titulo: 'Cobranza', responsable: 'Administración', participa: ['Finanzas', 'Legal'], frecuencia: 'Puntual',
    descripcion: 'Impago → pago o acción legal',
    etapas: ['Detectar', 'Aviso 1', 'Gestión', 'Legal', 'Cierre'], conecta: null, href: '/op/deudas' },
  { key: 'notificaciones', titulo: 'Notificaciones', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual',
    descripcion: 'Avisos automáticos a arrendatarios',
    etapas: ['Generar', 'Enviar', 'Acuses', 'No entregados'], conecta: null, href: '/procesos/notificaciones' },

  // ── MANTENCIÓN ──
  { key: 'incidencia', titulo: 'Incidencia', responsable: 'Mantención', participa: ['Administración', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Reporte, resolución y cierre',
    etapas: ['Reporte', 'Clasificar', 'Validar', 'Resolver', 'Cierre'], conecta: null, href: '/procesos/incidencias' },
  { key: 'presupuestos', titulo: 'Presupuestos', responsable: 'Mantención', participa: ['Administración', 'Finanzas'], frecuencia: 'Puntual',
    descripcion: 'Crear y editar presupuestos de reparación',
    etapas: ['Buscar', 'Crear', 'Líneas', 'Revisar', 'PDF'], conecta: 'Término · Incidencia · Inicios', href: '/procesos/presupuestos' },

  // ── LEGAL ──
  { key: 'revision_log', titulo: 'LOG', responsable: 'Legal', participa: ['Administración', 'Finanzas', 'Ventas'], frecuencia: 'Semanal', produccion: true,
    descripcion: 'BD_LOG Drive → Supabase',
    etapas: ['Leer LOG', 'Validar', 'Aprobar', 'Sincronizar'], conecta: null, href: '/cc1' },
  { key: 'contratos', titulo: 'Contratos', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Redacción de contratos',
    etapas: [], conecta: null, href: null },
  { key: 'valoraciones', titulo: 'Valoraciones', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Validación / evaluación de arrendatarios',
    etapas: [], conecta: null, href: null },
  { key: 'dicom', titulo: 'DICOM', responsable: 'Legal', participa: [], frecuencia: 'Puntual', enConstruccion: true,
    descripcion: 'Consulta comercial del candidato',
    etapas: [], conecta: null, href: null },

  // ── FINANZAS ──
  { key: 'termino', titulo: 'Término', responsable: 'Finanzas', participa: ['Administración', 'Legal'], frecuencia: 'Puntual', produccion: true,
    descripcion: 'Aviso legal, recepción y garantías',
    etapas: ['Aviso', 'Registro', 'Legal', 'Excel', 'Recepción', 'GGCC', 'Garantías', 'Cierre'], conecta: 'Términos', href: '/procesos/terminos' },
  { key: 'liquidacion', titulo: 'Liquidación/APPVISION', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual', produccion: true,
    descripcion: 'Información para liquidación mensual',
    etapas: [], conecta: null, href: '/procesos/liquidaciones' },
  { key: 'liquidacion_paola', titulo: 'Liquidación Paola', responsable: 'Administración', participa: ['Finanzas'], frecuencia: 'Mensual', enConstruccion: true,
    descripcion: 'Caso especial de liquidación',
    etapas: [], conecta: null, href: '/op/liquidacion-paola' },
  { key: 'cartolas', titulo: 'Cartolas', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual', produccion: true,
    descripcion: 'Cartola de IDADMON (lee/solicita cambios: Administración)',
    etapas: ['Carga', 'Cruce IDADMON', 'No matcheados', 'Deuda'], conecta: null, href: '/procesos/cartolas' },
  { key: 'mandato', titulo: 'Mandato', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Mensual',
    descripcion: 'Cuotas esperadas y deuda mensual (resultado visible por Administración)',
    etapas: ['Cuotas', 'Cartola BI', 'Vista deuda', 'Confirmar'], conecta: null, href: null },
  { key: 'nubox', titulo: 'Financiero', responsable: 'Finanzas', participa: ['Administración'], frecuencia: 'Semanal', produccion: true,
    descripcion: 'Tratamiento datos financieros (resultado visible por Administración)',
    etapas: [], conecta: null, href: '/procesos/financiero' },
  { key: 'bi_sa', titulo: 'BI', responsable: 'Finanzas', participa: [], frecuencia: 'Semanal', produccion: true,
    descripcion: 'Cartola Banco Internacional',
    etapas: ['Cargar', 'Sugerir', 'Revisar', 'Volcar'], conecta: null, href: '/procesos/bi' },
]
