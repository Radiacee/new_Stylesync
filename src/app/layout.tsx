import './globals.css';
import type { ReactNode } from 'react';
import { ConditionalLayout } from '../components/ConditionalLayout';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';
import InstallPrompt from '../components/InstallPrompt';

export const metadata = {
  title: 'StyleSync',
  description: 'Personalize paraphrasing to your authentic writing voice (ethical, transparent use).',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/apple-touch-icon.png' },
      { url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' }
    ],
  },
  themeColor: '#3b82f6',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StyleSync'
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'StyleSync: AI-Powered Paraphrasing Companion',
    description: 'Transform any text to match your unique writing style with AI-powered analysis',
    type: 'website',
    siteName: 'StyleSync',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StyleSync: AI-Powered Paraphrasing Companion',
    description: 'Transform any text to match your unique writing style with AI-powered analysis',
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning on body to ignore extension-injected attrs (e.g. Grammarly) */}
      <body suppressHydrationWarning>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
