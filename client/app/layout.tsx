import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from 'sonner';
import { Inter } from "next/font/google";
import Providers from "@/components/providers";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GitTask: Transform TODOs into Actionable Intelligence",
  description:
    "Automatically extract, track, and analyze TODO comments from your GitHub repositories. Get AI-powered insights and never let technical debt slip through the cracks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
