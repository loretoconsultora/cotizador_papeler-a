import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default de Next.js es 1MB — insuficiente para subir un PDF de
      // catálogo o una foto de portada/factura reales. Vercel tiene un
      // tope propio de ~4.5MB por request en sus funciones serverless, así
      // que subimos hasta ahí (con margen) en vez de a un valor mayor que
      // igual rebotaría a nivel de plataforma.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
