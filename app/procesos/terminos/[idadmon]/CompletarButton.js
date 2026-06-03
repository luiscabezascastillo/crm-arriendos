"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompletarButton({ workflowInstanceId, nodeCodigo }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function completar() {
    const comentario = window.prompt(
      `Comentario para completar ${nodeCodigo}:`,
      ""
    );

    if (comentario === null) return;

    const confirmado = window.confirm(
      `¿Marcar ${nodeCodigo} como COMPLETADO?`
    );

    if (!confirmado) return;

    setLoading(true);

    const res = await fetch("/api/workflow/completar-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_instance_id: workflowInstanceId,
        node_codigo: nodeCodigo,
        comentarios: comentario || "Completado sin comentario",
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Error completando tarea");
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={completar}
      disabled={loading}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid #adb5bd",
        cursor: loading ? "not-allowed" : "pointer",
        background: loading ? "#dee2e6" : "#ffffff",
      }}
    >
      {loading ? "Completando..." : "Completar"}
    </button>
  );
}