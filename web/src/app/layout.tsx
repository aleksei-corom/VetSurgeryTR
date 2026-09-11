import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VetSurgeryTR — Cirugía Ortopédica Veterinaria",
  description:
    "Sistema integral de gestión para clínicas veterinarias especializadas en cirugía ortopédica: pacientes, agenda quirúrgica e inventario de implantes (platinas, clavos, tornillos, fijadores y más).",
  applicationName: "VetSurgeryTR",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VetSurgeryTR",
  },
  keywords: [
    "veterinaria",
    "cirugía ortopédica",
    "TPLO",
    "inventario veterinario",
    "implantes",
    "VetSurgeryTR",
  ],
  authors: [{ name: "VetSurgeryTR" }],
};

export const viewport: Viewport = {
  themeColor: "#0d7d74",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
