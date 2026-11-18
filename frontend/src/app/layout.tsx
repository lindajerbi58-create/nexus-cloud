import type { Metadata } from "next";

import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexus — Distributed Cloud",
    template: "%s | Nexus",
  },
  description:
    "A modern workspace for distributed data storage.",
  applicationName: "Nexus Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}

            <Toaster
              position="bottom-right"
              theme="system"
              richColors
              closeButton
              duration={3500}
              toastOptions={{
                style: {
                  borderRadius: "12px",
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}