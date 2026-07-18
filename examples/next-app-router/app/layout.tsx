import { HydrationSnapshotScript } from 'why-hydration/next/script';
import { HydrationInspector } from 'why-hydration/next';

export const metadata = { title: 'why-hydration · Next.js App Router example' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV !== 'production' && <HydrationSnapshotScript />}
      </head>
      <body style={{ fontFamily: 'system-ui', margin: 0 }}>
        <HydrationInspector>{children}</HydrationInspector>
      </body>
    </html>
  );
}
