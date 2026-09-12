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
      <head>
        {/* Zod documents this pre-import configuration hook. Set it before
            any browser schema is constructed: even its caught eval probe
            violates our CSP. This fixed script contains no user input. */}
        <script dangerouslySetInnerHTML={{ __html: 'globalThis.__zod_globalConfig = Object.assign(globalThis.__zod_globalConfig || {}, { jitless: true });' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
