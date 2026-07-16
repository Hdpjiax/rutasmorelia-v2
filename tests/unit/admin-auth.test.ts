import { describe, expect, it } from 'vitest';
import {
  getAdminEmails,
  isAdminAccessAllowed,
  isAdminEmail,
  isLocalAdminDev,
} from '@/lib/auth/admin';

describe('admin access helpers', () => {
  it('parsea lista de correos (legacy)', () => {
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'A@x.com, b@y.com; c@z.com';
    expect(getAdminEmails()).toEqual(['a@x.com', 'b@y.com', 'c@z.com']);
    if (prev === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = prev;
  });

  it('isLocalAdminDev es true fuera de Vercel en test/dev', () => {
    const prevVercel = process.env.VERCEL;
    const prevNode = process.env.NODE_ENV;
    delete process.env.VERCEL;
    // vitest suele correr con NODE_ENV=test → no production
    process.env.NODE_ENV = 'test';
    expect(isLocalAdminDev()).toBe(true);
    expect(isAdminAccessAllowed()).toBe(true);
    expect(isAdminEmail('cualquiera@x.com')).toBe(true);

    process.env.VERCEL = '1';
    expect(isLocalAdminDev()).toBe(false);
    expect(isAdminAccessAllowed()).toBe(false);
    expect(isAdminEmail('admin@viamorelia.org')).toBe(false);

    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });
});
