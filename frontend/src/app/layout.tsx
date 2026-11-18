import type { Metadata } from "next";

import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";

import "./globals.css";

export const metadata: Metadata = {
  title: "NEXUS® — Data Without Boundaries",

  description:
    "Distributed storage infrastructure. Engineered for resilience.",

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
            theme="light"
            position="bottom-right"
            richColors
            closeButton
            duration={4000}
            toastOptions={{
              style: {
                borderRadius: "0px",
                border: "1px solid #121212",
                fontFamily:
                  "Helvetica Neue, Helvetica, Arial, sans-serif",
              },
            }}
          />

        </AuthProvider>

      </body>

    </html>
  );
}