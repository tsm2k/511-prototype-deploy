import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

export const metadata: Metadata = {
  title: 'SPR 4937 Data Analysis',
  description: 'INDOT 511 Data Management System',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/511-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/511-icon.svg" />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
