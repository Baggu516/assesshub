const RESERVED = new Set([
  'master',
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'mail',
  'smtp',
  'ftp',
  'cdn',
  'static',
  'assets',
]);

export function isReservedSubdomain(subdomain: string) {
  const s = subdomain.trim().toLowerCase();
  return !s || RESERVED.has(s);
}

/** Plain localhost / master.* → master console (registry DB). */
export function isMasterHost(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const host = hostname.split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
  if (host === 'master.localhost' || host.startsWith('master.')) return true;
  const base = (import.meta.env.VITE_BASE_DOMAIN || 'classtrio.in').toLowerCase();
  if (host === `master.${base}` || host === base || host === `www.${base}`) return true;
  return false;
}
