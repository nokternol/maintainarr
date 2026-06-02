import type { GetServerSidePropsContext } from 'next';

type AuthRedirect = { redirect: { destination: string; permanent: false } };

export async function requireAuth(ctx: GetServerSidePropsContext): Promise<AuthRedirect | null> {
  if (process.env.BYPASS_AUTH === 'true') return null;

  const port = process.env.PORT ?? 5057;
  try {
    const res = await fetch(`http://localhost:${port}/api/auth/me`, {
      headers: { cookie: ctx.req.headers.cookie ?? '' },
    });
    if (res.ok) return null;
  } catch {
    // Server unavailable — redirect to login
  }

  return { redirect: { destination: '/login', permanent: false } };
}
