import type { Metadata } from 'next';
import { Lora } from 'next/font/google';
import { DossierFooter } from '@/components/ui/DossierFooter';
import { Header } from '@/components/ui/Header';
import { SessionKeepAlive } from '@/components/ui/SessionKeepAlive';
import './globals.css';

/**
 * Classic reading serif for the dossier masthead and headings (replaces the
 * default Times-style font-serif stack). Self-hosted at build time via
 * next/font — no runtime requests to Google. Cyrillic subsets cover the
 * Ukrainian interface.
 */
const lora = Lora({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-lora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ShiftCrack — crack the cipher',
  description:
    'Browser-based educational cryptography game: Caesar, Transposition, Frequency Analysis',
};

/**
 * Runs before hydration: reads the persisted theme/locale straight from
 * localStorage so the first paint matches the user's saved preferences
 * (the stores themselves rehydrate after mount).
 */
const bootstrapScript = `
(function () {
  try {
    var theme = JSON.parse(localStorage.getItem('sc-theme') || 'null');
    if (theme && theme.state && theme.state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
    var i18n = JSON.parse(localStorage.getItem('sc-i18n') || 'null');
    var locale = i18n && i18n.state && i18n.state.locale ? i18n.state.locale : 'uk';
    document.documentElement.lang = locale;
  } catch (_) {}
})();
`;

/**
 * Root layout: the whole app lives inside one "Retro Spy Dossier" folder —
 * vintage paper background, a hard-offset shadow panel with a TOP SECRET
 * header, and a field-manual footer.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning className={lora.variable}>
      <body className="min-h-screen bg-page font-sans text-ink antialiased">
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <div className="min-h-screen px-3 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl border border-tan bg-paper shadow-[8px_8px_0_rgba(66,54,36,0.12)]">
            <Header />
            <SessionKeepAlive />
            <main className="px-5 py-4 sm:px-8 sm:py-5 lg:px-10 lg:py-6">{children}</main>
            <DossierFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
