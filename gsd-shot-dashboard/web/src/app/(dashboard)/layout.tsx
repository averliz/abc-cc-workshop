'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '@/hooks/useAuth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading } = useMe();
  useEffect(() => {
    if (!isLoading && me === null) router.replace('/login');
  }, [me, isLoading, router]);
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!me) return null;
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">OSINT Shot Dashboard</h1>
        <span className="text-sm text-muted-foreground">{me.email}</span>
      </header>
      <main className="flex flex-1 min-h-0">{children}</main>
    </div>
  );
}
