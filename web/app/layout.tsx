import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parser — Document Parsing",
  description:
    "AI-powered document parsing with template corrections. Upload, review, and teach the parser with your corrections.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
