"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearStoredSession, writeStoredSession } from "@/lib/api";
import type { AuthSession, UserAccount } from "@/lib/types";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completando acceso...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const showError = (nextMessage: string) => {
      window.setTimeout(() => {
        setHasError(true);
        setMessage(nextMessage);
      }, 0);
    };

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    const params = new URLSearchParams(hash);
    const error = params.get("error");
    const token = params.get("token");
    const encodedUser = params.get("user");

    if (error) {
      clearStoredSession();
      showError(error);
      return;
    }

    if (!token || !encodedUser) {
      clearStoredSession();
      showError("No pudimos completar el acceso con Google.");
      return;
    }

    try {
      const user = JSON.parse(decodeBase64Url(encodedUser)) as UserAccount;
      const session: AuthSession = { token, user };
      writeStoredSession(session);
      window.location.replace("/");
    } catch {
      clearStoredSession();
      showError("La respuesta de Google llegó incompleta o con un formato no válido.");
    }
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "min(100%, 520px)",
          borderRadius: "28px",
          padding: "28px",
          background: "rgba(255, 251, 245, 0.9)",
          border: "1px solid rgba(70, 49, 27, 0.12)",
          boxShadow: "0 18px 50px rgba(120, 78, 40, 0.12)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(2rem, 4vw, 2.6rem)",
            lineHeight: 1,
          }}
        >
          {hasError ? "No se pudo iniciar sesión" : "Entrando a tu cuenta"}
        </h1>
        <p
          style={{
            marginTop: "14px",
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
        {hasError ? (
          <Link
            href="/"
            style={{
              display: "inline-flex",
              marginTop: "20px",
              padding: "12px 16px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, var(--brand), #ef8a52)",
              color: "white",
              fontWeight: 700,
            }}
          >
            Volver al inicio
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return window.atob(normalized + padding);
}
