import type { Metadata } from 'next';
import './globals.css';
import { APP_CONFIG } from './editor/config';

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} — Agent-ready cinema workspace`,
  description: APP_CONFIG.description,
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: `${APP_CONFIG.name} — Agent-ready cinema workspace`,
    description: APP_CONFIG.description,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_CONFIG.name} — Agent-ready cinema workspace`,
    description: APP_CONFIG.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
