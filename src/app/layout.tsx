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
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand-icon.png", type: "image/png" },
    ],
    apple: "/brand-icon.png",
  },
  openGraph: {
    title: "Koliance | Decentralized Identity & Trust Infrastructure",
    description: "Verifiable on-chain identity and trust attestations powered by Monad Testnet (10143).",
    url: "https://koliance.vercel.app",
    siteName: "Koliance",
    type: "website",
    images: [
      {
        url: "/brand-icon-512.png",
        width: 512,
        height: 512,
        alt: "Koliance Brand Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Koliance | Decentralized Identity & Trust Infrastructure on Monad",
    description:
      "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad.",
    images: ["/brand-icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://koliance.vercel.app/#website",
      url: "https://koliance.vercel.app",
      name: "Koliance",
      description:
        "Decentralized Identity & Cryptographic Trust Infrastructure on Monad parallel EVM.",
      publisher: {
        "@id": "https://koliance.vercel.app/#organization",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://koliance.vercel.app/#organization",
      name: "Koliance",
      url: "https://koliance.vercel.app",
      logo: "https://koliance.vercel.app/brand-icon-512.png",
      sameAs: [
        "https://github.com",
        "https://x.com",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://koliance.vercel.app/#software",
      name: "Koliance Protocol",
      applicationCategory: "BlockchainApplication",
      operatingSystem: "Web3 / EVM (Monad)",
      description:
        "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased selection:bg-monad-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
