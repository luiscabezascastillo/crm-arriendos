"use client"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ROLES = ["admin","operaciones","finanzas","legal","comercial","tecnico"]
const MODULOS = {
  admin:      ["Panel","Admin","CC1","Liquidaciones"],
  operaciones:["Panel","Admin","Incidencias","Liquidaciones"],
  finanzas:   ["Panel","Admin","CC1","Liquidaciones"],
  legal:      ["Admin","Legal"],
  comercial:  ["Publicaciones"],
  tecnico:    ["Incidencias"],
}

export default function Config() {
  const [usuarios, setUsuarios] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevo, setNuevo] = useState({ nombre:"", email:"", rol:"operaciones", auth_provider:"google", password:"" })
  const [msg, setMsg] = useState("")
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from("crm_users").select("*").order("nombre")
    setUsuarios(data || [])
  }

  async function guardarEdicion(u) {
    const { error } = await supabase.from("crm_users")
      .update({ rol: u.rol, activo: u.activo })
      .eq("id", u.id)
    if (!error) { setMsg("Guardado"); setEditando(null); cargar() }
  }

  async function crearUsuario() {
    const payload = { nombre: nuevo.nombre, email: nuevo.email, rol: nuevo.rol, auth_provider: nuevo.auth_provider, activo: true }
    const { error } = await supabase.from("crm_users").insert([payload])
    if (!error) { setMsg("Usuario creado"); setShowForm(false); setNuevo({ nombre:"", email:"", rol:"operaciones", auth_provider:"google", password:"" }); cargar() }
    else setMsg("Error: " + error.message)
  }

  const badge = (rol) => {
    const colores = { admin:"#1F4E79", operaciones:"#BF5700", finanzas:"#1E6B3C", legal:"#6B1E6B", comercial:"#444", tecnico:"#333" }
    return <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background: colores[rol]+"22", color: colores[rol], fontWeight:500 }}>{rol}</span>
  }

  return (
    <div style={{ padding:"2rem", maxWidth:900, margin:"0 auto", fontFamily:"sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:500, margin:0 }}>Usuarios y permisos</h1>
          <p style={{ fontSize:13, color:"#666", margin:"4px 0 0" }}>Gestiona el acceso al CRM</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ fontSize:13, padding:"8px 16px" }}>+ Nuevo usuario</button>
      </div>

      {msg && <div style={{ background:"#f0fdf4", border:"0.5px solid #86efac", borderRadius:8, padding:"8px 14px", fontSize:13, color:"#166534", marginBottom:"1rem" }}>{msg} <button onClick={()=>setMsg("")} style={{ border:"none", background:"none", cursor:"pointer", float:"right" }}>�</button></div>}

      {showForm && (
        <div style={{ background:"#fff", border:"0.5px solid #e5e7eb", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <h2 style={{ fontSize:16, fontWeight:500, margin:"0 0 1rem" }}>Nuevo usuario</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label style={{ fontSize:12, color:"#666" }}>Nombre</label><br/><input value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})} style={{ width:"100%" }}/></div>
            <div><label style={{ fontSize:12, color:"#666" }}>Email</label><br/><input value={nuevo.email} onChange={e=>setNuevo({...nuevo,email:e.target.value})} style={{ width:"100%" }}/></div>
            <div><label style={{ fontSize:12, color:"#666" }}>Rol</label><br/>
              <select value={nuevo.rol} onChange={e=>setNuevo({...nuevo,rol:e.target.value})} style={{ width:"100%" }}>
                {ROLES.map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize:12, color:"#666" }}>Tipo de acceso</label><br/>
              <select value={nuevo.auth_provider} onChange={e=>setNuevo({...nuevo,auth_provider:e.target.value})} style={{ width:"100%" }}>
                <option value="google">Google Workspace</option>
                <option value="credentials">Usuario/contrase�a</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop:12, display:"flex", gap:8 }}>
            <button onClick={crearUsuario}>Crear usuario</button>
            <button onClick={()=>setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ background:"#fff", border:"0.5px solid #e5e7eb", borderRadius:12, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#f9fafb" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:500, color:"#666", borderBottom:"0.5px solid #e5e7eb" }}>Usuario</th>
              <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:500, color:"#666", borderBottom:"0.5px solid #e5e7eb" }}>Rol</th>
              <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:500, color:"#666", borderBottom:"0.5px solid #e5e7eb" }}>M�dulos</th>
              <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:500, color:"#666", borderBottom:"0.5px solid #e5e7eb" }}>Acceso</th>
              <th style={{ padding:"10px 16px", textAlign:"left", fontWeight:500, color:"#666", borderBottom:"0.5px solid #e5e7eb" }}>Estado</th>
              <th style={{ padding:"10px 16px", borderBottom:"0.5px solid #e5e7eb" }}></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u,i) => (
              <tr key={u.id} style={{ borderBottom:"0.5px solid #f3f4f6", background: i%2===0?"#fff":"#fafafa" }}>
                <td style={{ padding:"10px 16px" }}>
                  <div style={{ fontWeight:500 }}>{u.nombre}</div>
                  <div style={{ color:"#888", fontSize:12 }}>{u.email}</div>
                </td>
                <td style={{ padding:"10px 16px" }}>
                  {editando===u.id
                    ? <select value={u.rol} onChange={e=>setUsuarios(usuarios.map(x=>x.id===u.id?{...x,rol:e.target.value}:x))} style={{ fontSize:12 }}>
                        {ROLES.map(r=><option key={r}>{r}</option>)}
                      </select>
                    : badge(u.rol)
                  }
                </td>
                <td style={{ padding:"10px 16px", color:"#555", fontSize:12 }}>{(MODULOS[u.rol]||[]).join(", ")}</td>
                <td style={{ padding:"10px 16px", fontSize:12, color:"#888" }}>{u.auth_provider==="google"?"Google":"Usuario/clave"}</td>
                <td style={{ padding:"10px 16px" }}>
                  {editando===u.id
                    ? <input type="checkbox" checked={u.activo} onChange={e=>setUsuarios(usuarios.map(x=>x.id===u.id?{...x,activo:e.target.checked}:x))}/>
                    : <span style={{ fontSize:11, padding:"2px 8px", borderRadius:10, background:u.activo?"#dcfce7":"#fee2e2", color:u.activo?"#166534":"#991b1b" }}>{u.activo?"Activo":"Inactivo"}</span>
                  }
                </td>
                <td style={{ padding:"10px 16px", textAlign:"right" }}>
                  {editando===u.id
                    ? <><button onClick={()=>guardarEdicion(u)} style={{ fontSize:12, marginRight:6 }}>Guardar</button><button onClick={()=>setEditando(null)} style={{ fontSize:12 }}>Cancelar</button></>
                    : <button onClick={()=>setEditando(u.id)} style={{ fontSize:12 }}>Editar</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
