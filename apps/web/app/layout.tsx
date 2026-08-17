import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/700.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700-italic.css";
import "@fontsource/pt-sans/400.css";
import "@fontsource/pt-sans/700.css";

export const metadata: Metadata = {
  title: {
    default: "Daily News — digital newspaper",
    template: "%s · Daily News",
  },
  description:
    "A free AI-curated digital newspaper assembled automatically from public Telegram channels.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}