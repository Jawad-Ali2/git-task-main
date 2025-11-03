import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Toaster } from 'sonner';
import { NotificationProvider } from "@/components/NotificationProvider";
import { NotificationContextProvider } from "@/contexts/NotificationContext";

const poppins = Poppins({
  // variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

import { Inter } from "next/font/google";
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
          <NotificationContextProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </NotificationContextProvider>
        </Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
