import type { NextConfig } from "next";

const secureHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/invoice/:id*", headers: secureHeaders },
      { source: "/api/invoice/:id/pdf", headers: secureHeaders },
      { source: "/admin/:path*", headers: secureHeaders },
      { source: "/admin-login", headers: secureHeaders },
    ];
  },
};

export default nextConfig;
