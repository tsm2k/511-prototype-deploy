import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '511 Traffic Analysis',
  description: 'INDOT 511 Traffic Management System',
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
      <body>{children}</body>
    </html>
  )
}
