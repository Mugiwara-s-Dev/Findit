import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FindIt | Escaparate local inteligente",
  description:
    "Explora tiendas cercanas, compara inventarios y encuentra la mejor compra por precio, calidad y distancia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
