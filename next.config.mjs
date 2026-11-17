/** @type {import('next').NextConfig} */

// Content-Security-Policy:
// - Google Fonts liberado (styles + fonts) por causa da tipografia da marca.
// - 'unsafe-inline' em script-src é exigência do Next.js sem nonces;
//   próximo passo de hardening é migrar para CSP com nonce via middleware.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Anti-clickjacking (redundante com frame-ancestors, p/ navegadores antigos)
  { key: "X-Frame-Options", value: "DENY" },
  // Impede MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não vazar URL (que carrega o token do aluno) para sites externos
  { key: "Referrer-Policy", value: "no-referrer" },
  // HSTS: força HTTPS por 2 anos
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Desliga APIs de navegador que o app não usa
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  poweredByHeader: false, // não anunciar o framework (X-Powered-By)
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
