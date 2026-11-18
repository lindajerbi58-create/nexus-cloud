import type { Metadata } from "next";

import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";

import "./globals.css";

export const metadata: Metadata = {
  title: "NEXUS Cloud | Distributed Storage",

  description:
    "Secure distributed cloud storage with intelligent replication, fault tolerance and infrastructure monitoring.",

  applicationName: "NEXUS Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}

          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
            duration={4000}
          />
        </AuthProvider>
      </body>
    </html>
  );
}