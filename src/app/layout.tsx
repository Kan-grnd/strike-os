import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "sonner";
import "@/styles/globals.css";
import GlobalShell from "@/app/(shell)/layout";
import { THEME_IDS, DEFAULT_THEME } from "@/lib/theme-packs";

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
  title: {
    default: "Strike OS",
    template: "%s · Strike OS",
  },
  description: "Strike OS — adaptive AI workforce operating system.",
  applicationName: "Strike OS",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
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
          defaultTheme={DEFAULT_THEME}
          themes={[...THEME_IDS]}
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