const axios = require('axios');

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};

const DAY_PAT = 'Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
const MONTH_PAT = Object.keys(MONTH_MAP).join('|');

function inferYear(day, month, now) {
  const y = now.getFullYear();
  const candidate = new Date(y, month, day);
  return (now - candidate > 60 * 24 * 60 * 60 * 1000) ? y + 1 : y;
}

function normalizeMonth(s) {
  const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return MONTH_MAP[n] !== undefined ? MONTH_MAP[n] : MONTH_MAP[n.slice(0, 3)];
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').trim();
}

// Non-event paths that appear under /whats-on/ but are not individual shows
const EXCLUDED_SLUGS = new Set([
  'latest', 'archive', 'all', 'feed', 'rss', 'sitemap',
  'category', 'tag', 'page', 'search', 'filter', 'family',
  'studio', 'main-house', 'free', 'theatre', 'theatre-school'
]);

class OldVicFetcher {
  async fetchEvents(now = new Date()) {
    try {
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
        'Accept': 'text/html'
      };

      // Pass 1: listing page → event slugs
      const listRes = await axios.get('https://bristololdvic.org.uk/whats-on', {
        headers,
        timeout: 15000
      });
      const slugs = this._parseSlugs(listRes.data);

      // Pass 2: individual event pages
      const settled = await Promise.allSettled(
        slugs.map(slug =>
          axios.get(`https://bristololdvic.org.uk/whats-on/${slug}`, {
            headers,
            timeout: 15000
          })
        )
      );

      const seen = new Set();
      const events = [];

      settled.forEach((result, i) => {
        if (result.status === 'rejected') return;
        const url = `https://bristololdvic.org.uk/whats-on/${slugs[i]}`;
        const evs = this._parseEventPage(result.value.data, slugs[i], url, now, endDate);
        for (const ev of evs) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            events.push(ev);
          }
        }
      });

      console.log(`Bristol Old Vic: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error('Old Vic fetch failed:', err.message);
      return [];
    }
  }

  _parseSlugs(html) {
    const re = /href="\/whats-on\/([^"?#\/]+)"/gi;
    const slugs = new Set();
    let m;
    while ((m = re.exec(html)) !== null) {
      const slug = m[1];
      if (slug && !EXCLUDED_SLUGS.has(slug)) slugs.add(slug);
    }
    return [...slugs];
  }

  _parseEventPage(html, slug, url, now, endDate) {
    // Title
    const titleM = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
    if (!titleM) return [];
    const title = decodeEntities(titleM[1]);
    if (!title || title.length < 3) return [];

    // Description: prefer meta description, fall back to first substantial paragraph
    const descM =
      html.match(/<meta\s+name="description"\s+content="([^"]{10,})"/i) ||
      html.match(/<meta\s+content="([^"]{10,})"\s+name="description"/i) ||
      html.match(/<p[^>]*>([^<]{40,})<\/p>/i);
    const description = descM ? decodeEntities(descM[1]) : '';

    // Cost
    const costM = html.match(/\bfree\b(?:\s*\(no booking required\))?/i) ||
      html.match(/from\s+£[\d.]+/i) ||
      html.match(/£\d+(?:\.\d{2})?(?:\s*[-–]\s*£\d+(?:\.\d{2})?)?/i);
    const cost = costM
      ? (/\bfree\b/i.test(costM[0]) ? 'Free' : costM[0].trim())
      : 'Price TBA';

    const soldOut = /sold\s+out/i.test(html);

    // Date/time extraction: find every "DayName Day MonthName [Year]" then look for a time nearby
    const dateRe = new RegExp(
      `(?:${DAY_PAT})\\s+(\\d{1,2})\\s+(${MONTH_PAT})(?:\\s+(\\d{4}))?`,
      'gi'
    );
    const timeRe = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/gi;

    const events = [];
    const pad = n => String(n).padStart(2, '0');
    let dm;

    while ((dm = dateRe.exec(html)) !== null) {
      const day = parseInt(dm[1]);
      const month = normalizeMonth(dm[2]);
      if (month === undefined || month === null) continue;
      const year = dm[3] ? parseInt(dm[3]) : inferYear(day, month, now);

      // Look for time in the 250 chars following the date match
      const afterDate = html.slice(dm.index + dm[0].length, dm.index + dm[0].length + 250);
      timeRe.lastIndex = 0;
      const tm = timeRe.exec(afterDate);

      let hour = 19, minute = 30; // sensible fallback for evening shows
      if (tm) {
        hour = parseInt(tm[1]);
        minute = tm[2] ? parseInt(tm[2]) : 0;
        if (tm[3].toLowerCase() === 'pm' && hour !== 12) hour += 12;
        if (tm[3].toLowerCase() === 'am' && hour === 12) hour = 0;
      }

      const d = new Date(year, month, day, hour, minute, 0, 0);
      if (d < now || d > endDate) continue;

      const id = `oldvic-${slug}-${year}${pad(month + 1)}${pad(day)}-${pad(hour)}${pad(minute)}`;
      events.push({
        id,
        source: 'oldvic',
        name: title,
        description,
        date: d.toISOString(),
        venue: 'Bristol Old Vic',
        cost,
        url,
        image: null,
        status: soldOut ? 'sold_out' : null
      });
    }

    return events;
  }
}

module.exports = { OldVicFetcher, inferYear, normalizeMonth };
