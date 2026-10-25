import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/components/client';
import { listProjects } from '@/modules/projects/service';
import { pageCtx } from '@/server/page';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Catat', template: '%s · Catat' },
  description: 'Jadwal projek, task, dan to-do harian.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { ctx, today } = await pageCtx();
  const projects = await listProjects(ctx, today);
  return (
    <html lang="id">
      <body>
        <ToastProvider>
          <div className="shell">
            <Sidebar projects={projects} />
            <div className="content">
              <Suspense>{children}</Suspense>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
