'use client';

import { useT } from '@/lib/i18n';

export interface PasswordChecks {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
  special: boolean;
}

/** Live breakdown of the OWASP password policy mirrored from the shared schema. */
export function passwordChecksOf(value: string): PasswordChecks {
  return {
    length: value.length >= 8 && value.length <= 128,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

export function passwordPolicyMet(checks: PasswordChecks): boolean {
  return checks.length && checks.lower && checks.upper && checks.digit && checks.special;
}

/**
 * Dossier-style live policy checklist: every satisfied requirement flips
 * from a hollow `[ ]` to a red `[x]` as the operator types — the same
 * rules the server enforces on registration and reset.
 */
export function PasswordStrength({ password }: { password: string }) {
  const t = useT();
  if (!password) return null;

  const checks = passwordChecksOf(password);
  const rows: { ok: boolean; key: string }[] = [
    { ok: checks.length, key: 'auth.password.hint.length' },
    { ok: checks.lower, key: 'auth.password.hint.lower' },
    { ok: checks.upper, key: 'auth.password.hint.upper' },
    { ok: checks.digit, key: 'auth.password.hint.digit' },
    { ok: checks.special, key: 'auth.password.hint.special' },
  ];

  return (
    <ul className="mt-2 space-y-1 font-mono text-[10px] uppercase tracking-wide text-fade">
      {rows.map((row) => (
        <li key={row.key} className={row.ok ? 'text-red-700' : undefined}>
          [{row.ok ? 'x' : ' '}] {t(row.key)}
        </li>
      ))}
    </ul>
  );
}
