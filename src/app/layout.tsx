import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koliance | Decentralized Identity & Trust Infrastructure on Monad",
  description:
    "Next-generation on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-monad-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
