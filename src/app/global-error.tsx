"use client";

/** Último recurso: erro no próprio layout raiz (sem os estilos do sistema). */
export default function ErroGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", color: "#2a211b" }}>
        <h1>Algo não funcionou</h1>
        <p>Não foi possível carregar a página. Tente de novo em instantes.</p>
        <button type="button" onClick={reset}>
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
