import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ErrorSnap - RAG-Based Coding Error Assistant',
  description: 'Local RAG application for understanding programming errors with evidence-based fixes and examples',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}