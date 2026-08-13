import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cotizador de Papelería",
  description: "Herramienta interna de cotización — uso exclusivo del equipo de ventas.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="bg-mesh min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
