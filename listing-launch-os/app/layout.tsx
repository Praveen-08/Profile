import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listing Launch OS — Property listing launch packs, done in minutes",
  description:
    "Enter your property details once and get a complete listing marketing pack: descriptions, social captions, reel scripts, vendor updates and more. Built for NZ real estate agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
