export default async function AuthError({ searchParams }) {
  const params = await searchParams
  const error = params?.error
  const mensajes = {
    AccessDenied: 'Tu cuenta no tiene acceso al CRM. Contacta al administrador.',
    Default: 'Ocurrió un error al iniciar sesión. Inténtalo de nuevo.',
  }
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Error de autenticación</h1>
      <p>{mensajes[error] || mensajes.Default}</p>
      <a href="/">Volver al inicio</a>
    </div>
  )
}