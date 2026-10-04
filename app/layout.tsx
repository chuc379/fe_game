import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Game Theory - Guess 2/3 of Average',
  description: 'Real-time multiplayer game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
