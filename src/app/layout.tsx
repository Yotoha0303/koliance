import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#836EF9",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://koliance.vercel.app"),
  title: "Koliance | Decentralized Identity & Trust Infrastructure on Monad",
  description:
    "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Koliance | Decentralized Identity & Trust Infrastructure",
    description: "Verifiable on-chain identity and trust attestations powered by Monad Testnet (10143).",
    url: "https://koliance.vercel.app",
    siteName: "Koliance",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
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
