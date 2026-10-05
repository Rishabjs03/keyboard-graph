import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

const title = 'Clacky · Your GitHub contributions as a mechanical keyboard';
const description =
  'Render your GitHub contribution graph as a grid of clickable mechanical keycaps, with tactile press animations and switch sounds. React component and Web Component.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title,
  description,
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary_large_image', title, description, creator: '@Yrishavjs' },
};

export const viewport: Viewport = {
  themeColor: '#e4d9c6',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
