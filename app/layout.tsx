import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const deploymentUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? deploymentUrl),
  title: "D-GITA · Den Gode IT-Anskaffelse",
  description:
    "Et moderne workspace til kommunale IT-anskaffelser, godkendelser, dokumentation og kvitteringer.",
  openGraph: {
    title: "D-GITA · Den gode IT-anskaffelse",
    description: "Fra behov til sikker behandling, godkendelse og Outlook-kvittering.",
    locale: "da_DK",
    type: "website",
    images: [
      {
        url: "/og-editorial.png",
        width: 1731,
        height: 909,
        alt: "D-GITA – fra behov til godkendelse",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#183a32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="da">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
