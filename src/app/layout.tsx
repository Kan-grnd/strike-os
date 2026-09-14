import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";
import GlobalShell from "@/app/(shell)/layout";

const inter = localFont({
  src: "./fonts/inter.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  src: "./fonts/jbm.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400 800",
});

export const metadata: Metadata = {
  title: "Strike OS — Adaptive AI Workforce Operating System",
  description: "One intelligence, many workers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="abyssal"
          themes={[
            "abyssal",
            "ember",
            "ghost",
            "cobalt",
            "sandstorm",
            "abyss-teal",
            "porcelain",
            "arctic",
            "onyx",
            "high-contrast",
          ]}
          enableSystem
          disableTransitionOnChange
        >
          <GlobalShell>
            {children}
          </GlobalShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}