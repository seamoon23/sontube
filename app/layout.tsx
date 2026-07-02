import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SonTube",
  description: "보호자가 직접 등록한 영상 안에서만 고르는 아이 전용 영상서랍",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0369a1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
