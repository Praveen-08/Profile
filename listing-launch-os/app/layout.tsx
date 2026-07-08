import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listing Launch — One property form. Every listing campaign asset.",
  description:
    "Enter your property details once and get a complete listing marketing pack: descriptions, social captions, reel scripts, vendor updates, SafeCheck compliance review and more. Built for NZ real estate agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
