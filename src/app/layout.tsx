import './globals.css';
import type { ReactNode } from 'react';
import { ConditionalLayout } from '../components/ConditionalLayout';

export const metadata = {
  title: 'StyleSync',
  description: 'Personalize paraphrasing to your authentic writing voice (ethical, transparent use).'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning on body to ignore extension-injected attrs (e.g. Grammarly) */}
      <body suppressHydrationWarning>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  );
}
