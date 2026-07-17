/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
];

const nextConfig = {
  async redirects() {
    return [
      { source: "/crypto", destination: "/crypto/home", permanent: false },
      { source: "/majors", destination: "/crypto/perpetual", permanent: false },
      { source: "/alts", destination: "/crypto/perpetual/alts", permanent: false },
      { source: "/coin", destination: "/crypto/home", permanent: false },
      { source: "/spot", destination: "/crypto/spot", permanent: false },
      { source: "/diagnosis", destination: "/crypto/home", permanent: false },
      { source: "/report", destination: "/crypto/home", permanent: false },
      { source: "/settings", destination: "/menu", permanent: false },
      { source: "/pro/apply", destination: "/pro", permanent: false },
      { source: "/calculator", destination: "/crypto/home", permanent: false },
      { source: "/macro-calendar", destination: "/schedule", permanent: false }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
