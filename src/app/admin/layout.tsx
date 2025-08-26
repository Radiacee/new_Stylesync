import type { Metadata } from 'next';
import AdminLayout from './AdminLayout';

export const metadata: Metadata = {
  title: 'StyleSync Admin Panel',
  description: 'Administrative interface for StyleSync',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}
