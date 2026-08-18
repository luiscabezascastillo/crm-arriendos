import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raiz del workspace al propio portal: silencia el aviso de "multiple lockfiles".
  turbopack: { root: __dirname },
};

export default nextConfig;
