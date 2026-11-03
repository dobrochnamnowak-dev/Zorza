import { createHash } from 'node:crypto';

export const categories = ['wyniki', 'kontrakty', 'działania', 'inne'];
export function clean(value = '') {
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : '';
    }).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g, ' ').trim();
}
export function publicLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; }
  catch { return null; }
}
export function canonicalLink(value) {
  const safe = publicLink(value);
  if (!safe) return null;
  const u = new URL(safe); u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/.test(k)) u.searchParams.delete(k);
  return u.href;
}
export const digest = text => createHash('sha256').update(text).digest('hex');
export function classify(title) {
  if (/earnings|financial results|quarter.*results|wynik/i.test(title)) return 'wyniki';
  if (/contract|agreement|partnership|collaborat|zamówien|umow|kontrakt/i.test(title)) return 'kontrakty';
  if (/launch|announc|acquir|dividend|buyback|introduc|invest|expan/i.test(title)) return 'działania';
  return 'inne';
}
// Ograniczony parser RSS 2.0. Bez wykonywania HTML i bez encji zewnętrznych.
export function parseRss(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Nieobsługiwane deklaracje XML');
  if (!/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new Error('Źródło nie zwróciło RSS 2.0');
  const result = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const tag = name => clean(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '');
    const title = tag('title').slice(0, 500), url = canonicalLink(tag('link'));
    const rawDate = tag('pubDate'); const parsedDate = Date.parse(rawDate);
    if (!title || !url) continue;
    result.push({ title, url, excerpt: tag('description').slice(0, 1800),
      published_at: Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : null,
      category: classify(title),publisher_name:tag('source'),publisher_url:publicLink(clean(block.match(/<source\b[^>]*\burl=["']([^"']+)["']/i)?.[1]||'')) });
    if (result.length === 50) break;
  }
  return result;
}
export function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateSummary(value, article) {
  if (!value || typeof value.title_pl !== 'string' || !value.title_pl.trim() || value.title_pl.length>700 || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 1800 ||
      typeof value.significance !== 'string' || value.significance.length > 1000 ||
      !categories.includes(value.category) || !Array.isArray(value.events) || value.events.length > 5) {
    throw new Error('Niepoprawny format notatki');
  }
  const evidence = clean(article.title + ' ' + article.excerpt);
  for (const event of value.events) {
    if (!validDay(event.date) || typeof event.title !== 'string' || !event.title || event.title.length > 250 ||
        typeof event.evidence !== 'string' || event.evidence.length < 8 || event.evidence.length > 600 ||
        !evidence.includes(clean(event.evidence)) || !['confirmed', 'estimated'].includes(event.certainty)) {
      throw new Error('Data lub cytat wydarzenia wymaga poprawy');
    }
  }
  return value;
}
export const utcDay = () => new Date().toISOString().slice(0, 10);
export const isoNow = () => new Date().toISOString();

export function publicationSince(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 const year=Number(parts.year),month=Number(parts.month)-1,day=Number(parts.day);
 const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
 return new Date(Date.UTC(year,month-1,Math.min(day,lastDay))).toISOString();
}
