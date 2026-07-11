import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import "./welcome-desktop-fix.css";

/**
 * App tipo mapa: el usuario hace zoom solo en MapLibre, no en la página.
 * (evita que el pinch mueva toda la UI en móvil)
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#047857",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ViaMorelia — Transporte público de Morelia",
  description:
    "ViaMorelia: consulta y planifica rutas de transporte público en Morelia por origen y destino. Combis y autobuses con mapa en tiempo real.",
  applicationName: "ViaMorelia",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "ViaMorelia",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/brand/favicon-32_v2.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icono-64_v2.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/icono-192_v2.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icono-512_v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/icono-192_v2.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/brand/favicon_v2.ico",
  },
  openGraph: {
    title: "ViaMorelia",
    description: "Rutas de transporte público en Morelia — origen a destino",
    siteName: "ViaMorelia",
    locale: "es_MX",
    type: "website",
  },
  other: {
    "theme-color": "#047857",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: 'light' }}
    >
      <body className="h-full overflow-hidden overscroll-none">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
