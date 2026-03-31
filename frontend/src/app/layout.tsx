import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SquawkBox',
  description: 'Social Gateway for Meshtastic',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-darkBg text-white antialiased" suppressHydrationWarning>
        {/* Ambient Lighting Background */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="ambient-orb bg-orbCyan w-96 h-96 top-[-10%] left-[-10%]"></div>
          <div className="ambient-orb bg-orbPurple w-[30rem] h-[30rem] bottom-[-20%] right-[-10%] animate-orb-float" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <main className="relative z-10 w-full min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
