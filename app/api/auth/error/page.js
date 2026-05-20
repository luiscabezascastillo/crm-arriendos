export default function AuthError({ searchParams }) {
  const error = searchParams?.error
  const mensajes = {
    AccessDenied: 'Tu cuenta no tiene acceso al CRM. Contacta al administrador.',
    Default: 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.',
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "16px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "22px", fontWeight: 500 }}>Error de acceso</h1>
      <p style={{ color: "#666", maxWidth: 320, textAlign: "center" }}>{mensajes[error] || mensajes.Default}</p>
      <a href="/" style={{ color: "#2E75B6", textDecoration: "none", fontSize: "14px" }}>← Volver al inicio</a>
    </div>
  )
}
