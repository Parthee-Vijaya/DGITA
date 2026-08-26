import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Formularmotoren accepterer dokumenter op til 25 MB. Multipart-overhead
      // kræver lidt ekstra plads, mens endpointet fortsat håndhæver 25 MB pr. fil.
      bodySizeLimit: "30mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
