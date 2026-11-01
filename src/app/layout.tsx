import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Statusfactory',
  description: 'A stats tracking program for Satisfactory using Ficsit Remote Monitoring',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/*
        No remote font fetch: the dashboard must work offline and must not
        disclose usage to a third party (OBS-005). The system font stack is
        defined in globals.css. A CSP meta tag with script hashes is injected
        into the static export by scripts/postbuild-csp.mjs.
      */}
      <head />
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
