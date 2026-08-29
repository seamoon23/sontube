import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "최종관리자 | SonTube",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SuperAdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
