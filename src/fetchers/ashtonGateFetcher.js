const axios = require('axios');

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};

function normalizeMonth(s) {
  if (!s) return undefined;
  const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return MONTH_MAP[n] !== undefined ? MONTH_MAP[n] : MONTH_MAP[n.slice(0, 3)];
}

function decodeEntities(str) {
  return (str || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').trim();
}

// Ashton Gate Stadium scraper.
// The stadium site (WordPress / Tribe Events plugin) lists all events
// at the ground — Bristol City FC fixtures, concerts, corporate events, etc.
// This is the authoritative source for Bristol City home matches.
class AshtonGateFetcher {
  async fetchEvents(now = new Date()) {
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
      'Accept': 'text/html'
    };

    try {
      const listRes = await axios.get('https://www.ashtongatestadium.co.uk/whatson/', {
        headers, timeout: 15000
      });

      const slugs = this._parseSlugs(listRes.data);
      if (!slugs.length) {
        console.log('Ashton Gate: no event slugs found');
        return [];
      }

      const settled = await Promise.allSettled(
        slugs.map(({ slug, url }) =>
          axios.get(url, { headers, timeout: 15000 })
            .then(r => ({ slug, url, html: r.data }))
        )
      );

      const events = [];
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const parsed = this._parseEventPage(result.value.html, result.value.slug, result.value.url, now, endDate);
        events.push(...parsed);
      }

      console.log(`Ashton Gate Stadium: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error('Ashton Gate fetch failed:', err.message);
      return [];
    }
  }

  _parseSlugs(html) {
    const slugs = [];
    const seen = new Set();

    // Tribe Events plugin links: /event/some-event-slug/
    // Also catch generic WordPress event links with date-keyed paths
    const re = /href="(https?:\/\/(?:www\.)?ashtongatestadium\.co\.uk\/(?:event|events)\/([^"?#\/]+)(?:\/\d{4}-\d{2}-\d{2})?\/?)"/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const url = m[1].replace(/\/$/, '') + '/';
      const slug = m[2];
      if (!seen.has(slug)) {
        seen.add(slug);
        slugs.push({ slug, url });
      }
    }
    return slugs;
  }

  _parseEventPage(html, slug, url, now, endDate) {
    // Title
    const titleM = html.match(/<h1[^>]*>\s*([^<]{3,}?)\s*<\/h1>/i);
    if (!titleM) return [];
    const title = decodeEntities(titleM[1]);
    if (!title) return [];

    // Image
    const imgM = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/i);
    const image = imgM ? imgM[1] : null;

    // Description
    const descM = html.match(/<meta\s+name="description"\s+content="([^"]{10,})"/i) ||
      html.match(/<meta\s+content="([^"]{10,})"\s+name="description"/i);
    const description = descM ? decodeEntities(descM[1]) : '';

    // Date/time — look for structured data first (JSON-LD), then HTML patterns
    const events = [];

    // Try JSON-LD structured data (common in WordPress/Tribe)
    const jsonLdRe = /"@type"\s*:\s*"Event"[\s\S]{0,2000}?"startDate"\s*:\s*"([^"]+)"/;
    const jsonLdM = html.match(jsonLdRe);
    if (jsonLdM) {
      const d = new Date(jsonLdM[1]);
      if (!isNaN(d.getTime()) && d >= now && d <= endDate) {
        events.push(this._makeEvent(title, d, url, image, description, slug));
      }
      return events; // structured data is authoritative
    }

    // Fallback: HTML text patterns like "Saturday 15 August 2026" or "15 Aug 2026"
    // Look for: (DayName )? D(D)? (Month) (YYYY) patterns
    const datePat = /(?:\w+\s+)?(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})/gi;
    let dm;
    while ((dm = datePat.exec(html)) !== null) {
      const day = parseInt(dm[1]);
      const month = normalizeMonth(dm[2]);
      const year = parseInt(dm[3]);
      if (month === undefined) continue;

      // Look for a time within 200 chars after this date
      const after = html.slice(dm.index + dm[0].length, dm.index + dm[0].length + 200);
      const timeM = after.match(/\b(\d{1,2}):(\d{2})\s*(?:([ap]m?))?/i) ||
        after.match(/\b(\d{1,2})(?::00)?\s*(am|pm)/i);

      let hour = 15, minute = 0; // sensible stadium default (3pm)
      if (timeM) {
        hour = parseInt(timeM[1]);
        minute = timeM[2] ? parseInt(timeM[2]) : 0;
        const suffix = (timeM[3] || timeM[2] || '').toLowerCase();
        if (suffix.startsWith('p') && hour < 12) hour += 12;
        if (suffix.startsWith('a') && hour === 12) hour = 0;
        if (isNaN(minute)) minute = 0;
      }

      const d = new Date(year, month, day, hour, minute, 0);
      if (!isNaN(d.getTime()) && d >= now && d <= endDate) {
        const id = `ashtongate-${slug}-${year}${String(month + 1).padStart(2, '0')}${String(day).padStart(2, '0')}`;
        if (!events.find(e => e.id === id)) {
          events.push(this._makeEvent(title, d, url, image, description, slug));
        }
      }
    }

    return events;
  }

  _makeEvent(title, date, url, image, description, slug) {
    const d = date;
    const pad = n => String(n).padStart(2, '0');
    const id = `ashtongate-${slug}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    return {
      id,
      source: 'ashtongate',
      name: title,
      description,
      date: d.toISOString(),
      venue: 'Ashton Gate Stadium',
      cost: 'Price TBA',
      url,
      image,
      status: null
    };
  }
}

module.exports = { AshtonGateFetcher, normalizeMonth };
