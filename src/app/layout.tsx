import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ScrollToTop } from "@/components/ScrollToTop";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Readli: Every Book. Every Voice.",
  description: "Their favorite stories. Read by their favorite people.",
};

export const viewport: Viewport = {
  themeColor: "#FFF9ED",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunitoSans.variable}`}>
      <body className="min-h-dvh antialiased">
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
