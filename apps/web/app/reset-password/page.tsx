import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

/**
 * Password reset page (SDD §5): the email link lands here with the
 * single-use token in the query string. The server page reads the
 * searchParams promise and hands the token to the client form.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const raw = Array.isArray(token) ? token[0] : token;
  return <ResetPasswordForm token={raw ?? ''} />;
}
