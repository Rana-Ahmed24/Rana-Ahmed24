import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "A-Z Home Expenses",
  description: "View and record household expenses.",
  robots: { index: false, follow: false, nocache: true },
  applicationName: "A-Z Home Expenses",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
