import type { Metadata } from 'next';
import { Header } from '@/components/ui/Header';
import { SessionKeepAlive } from '@/components/ui/SessionKeepAlive';
import './globals.css';

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        <Header />
        <SessionKeepAlive />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
