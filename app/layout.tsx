import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

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
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icono-64.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/icono.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/icono.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/brand/favicon.ico",
  },
  openGraph: {
    title: "ViaMorelia",
    description: "Rutas de transporte público en Morelia — origen a destino",
    siteName: "ViaMorelia",
    locale: "es_MX",
    type: "website",
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
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
