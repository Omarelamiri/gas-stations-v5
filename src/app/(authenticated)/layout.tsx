'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/provider';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import MapsProvider from '@/lib/maps/MapsProvider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/login');
    }
  }, [loading, currentUser, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  // If no user, we don't render children (redirect in effect)
  if (!currentUser) return null;

  return (
    <AuthenticatedLayout>
      <MapsProvider>{children}</MapsProvider>
    </AuthenticatedLayout>
  );
}