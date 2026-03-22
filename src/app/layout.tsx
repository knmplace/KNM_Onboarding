import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { PoweredByFooter } from "@/components/powered-by-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homestead — Onboarding Dashboard",
  description: "User onboarding management",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="app-body antialiased">
        <ThemeProvider>
          {children}
          <PoweredByFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
