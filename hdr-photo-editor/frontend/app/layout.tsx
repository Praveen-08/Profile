import type { Metadata } from "next";
import "./globals.css";
import { ProjectProvider } from "@/components/project-context";
import { TopNav } from "@/components/top-nav";

export const metadata: Metadata = {
  title: "HDR Architectural Photo Editor",
  description: "AI-assisted HDR editor for real estate and architectural photographers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <ProjectProvider>
          <TopNav />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </ProjectProvider>
      </body>
    </html>
  );
}
