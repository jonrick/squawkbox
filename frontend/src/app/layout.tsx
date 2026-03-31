import './globals.css'
import type { Metadata } from 'next'

// Force dynamic rendering so process.env.API_URL is read at request time, not at build time.
// Without this, Next.js may statically cache this layout during the Docker build, baking in an empty string.
export const dynamic = 'force-dynamic';

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
        {/* Inject Runtime Config — uses private env var so it's read at SERVER runtime, not baked at build time */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = { API_URL: "${process.env.API_URL || ''}" };`,
          }}
        />
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
