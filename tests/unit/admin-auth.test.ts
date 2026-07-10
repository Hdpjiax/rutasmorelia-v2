import { describe, expect, it } from 'vitest';
import { getAdminEmails, isAdminEmail } from '@/lib/auth/admin';

describe('admin access helpers', () => {
  it('parsea lista de correos', () => {
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'A@x.com, b@y.com; c@z.com';
    expect(getAdminEmails()).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it('isAdminEmail respeta lista configurada', () => {
    const prev = process.env.ADMIN_EMAILS;
    const prevVercel = process.env.VERCEL;
    process.env.ADMIN_EMAILS = 'admin@viamorelia.org';
    delete process.env.VERCEL;
    expect(isAdminEmail('admin@viamorelia.org')).toBe(true);
    expect(isAdminEmail('otro@x.com')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  });
});
