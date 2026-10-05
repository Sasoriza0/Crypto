'use client';

import Link from 'next/link';
import { CipherModule } from '@shiftcrack/shared';
import { useT } from '@/lib/i18n';

const MODULES = [
  { slug: 'caesar', module: CipherModule.CAESAR },
  { slug: 'transposition', module: CipherModule.TRANSPOSITION },
  { slug: 'frequency', module: CipherModule.FREQUENCY },
] as const;

/** Module selection screen (SDD §2: app/page.tsx). */
export default function HomePage() {
  const t = useT();

  return (
    <section>
      <h1 className="text-3xl font-bold">{t('modules.title')}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{t('app.tagline')}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {MODULES.map(({ slug, module }) => (
          <Link
            key={slug}
            href={`/modules/${slug}`}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-600"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              {module}
            </span>
            <h2 className="mt-2 text-xl font-semibold">{t(`modules.${slug}.name`)}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t(`modules.${slug}.description`)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
