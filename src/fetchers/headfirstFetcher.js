const axios = require('axios');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

function ordinal(n) {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function getDayUrl(date) {
  const day = DAYS[date.getDay()];
  const d = ordinal(date.getDate());
  const month = MONTHS[date.getMonth()];
  return `https://www.headfirstbristol.co.uk/whats-on/${day}-${d}-${month}-${date.getFullYear()}`;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

class HeadfirstFetcher {
  async fetchEvents() {
    try {
      const today = new Date();
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
      });

      const settled = await Promise.allSettled(
        dates.map(date => this._fetchDay(date))
      );

      const seen = new Set();
      const events = [];

      for (const result of settled) {
        if (result.status === 'rejected') {
          console.error('Headfirst day fetch failed:', result.reason?.message);
          continue;
        }
        for (const event of result.value) {
          if (!seen.has(event.id)) {
            seen.add(event.id);
            events.push(event);
          }
        }
      }

      console.log(`Headfirst Bristol: ${events.length} events this week`);
      return events;
    } catch (error) {
      console.error('Headfirst fetch failed:', error.message);
      return [];
    }
  }

  async _fetchDay(date) {
    const url = getDayUrl(date);
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
          'Accept': 'text/html'
        },
        timeout: 15000
      });
      const html = response.data || '';
      console.log(`Headfirst: fetched ${url} (${html.length} bytes)`);

      // Detect Next.js SSR data — parse it first if present
      if (html.includes('__NEXT_DATA__')) {
        console.log('Headfirst: page has __NEXT_DATA__ (Next.js SSR)');
        const nd = this._extractNextData(html, date);
        if (nd.length) return nd;
        // Fall through to HTML scraping — Next.js also server-renders HTML
      }

      return this._parseDayEvents(html, date, url);
    } catch (err) {
      // Rethrow so the caller's Promise.allSettled captures it
      throw err;
    }
  }

  // Extract events from Next.js __NEXT_DATA__ JSON if the site is SSR/Next.js.
  // Logs the shape of the data so we can tune parsing if needed.
  _extractNextData(html, date) {
    try {
      const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
      if (!m) return [];
      const data = JSON.parse(m[1]);
      console.log('Headfirst: __NEXT_DATA__ keys:', Object.keys(data.props?.pageProps || {}).join(', '));
      // Try common structures: pageProps.events, pageProps.data.events
      const raw = data.props?.pageProps?.events
        || data.props?.pageProps?.data?.events
        || data.props?.pageProps?.listings
        || [];
      if (!Array.isArray(raw) || !raw.length) return [];
      console.log(`Headfirst: extracted ${raw.length} events from __NEXT_DATA__`);
      return raw.slice(0, 50).map((ev, i) => {
        const eventDate = new Date(date);
        eventDate.setHours(12, 0, 0, 0);
        return {
          id: `headfirst-nd-${ev.id || i}`,
          source: 'headfirst',
          name: ev.title || ev.name || '',
          description: ev.description || '',
          date: ev.date ? new Date(ev.date).toISOString() : eventDate.toISOString(),
          venue: ev.venue?.name || ev.venueName || 'Venue TBA',
          cost: 'Price TBA',
          url: ev.url || ev.link || 'https://www.headfirstbristol.co.uk/whats-on',
          image: ev.image || ev.imageUrl || null,
          status: null
        };
      }).filter(e => e.name);
    } catch (e) {
      console.log('Headfirst: __NEXT_DATA__ parse error:', e.message);
      return [];
    }
  }

  _parseDayEvents(html, date, sourceUrl) {
    const events = [];

    // Primary: /whats-on/{venue-slug}/{day-abbr}-{date}-{month-abbr}-{title-slug}-{numeric-id}
    // This is the original Headfirst URL pattern.
    const linkRe = /href="(\/whats-on\/([^"\/]+)\/((?:mon|tue|wed|thu|fri|sat|sun)-\d+-[a-z]+-[^"]+))"[^>]*>\s*([^<]+)\s*<\/a>/gi;

    // Fallback: any /whats-on/{venue}/{event} link — catches if the day-prefix format changed
    const fallbackRe = /href="(\/whats-on\/([^"\/]+)\/([^"?#\/][^"?#]+))"[^>]*>\s*([A-Z][^<]{2,100}?)\s*<\/a>/gi;

    const extractWith = (re) => {
      const found = [];
      let m;
      while ((m = re.exec(html)) !== null) {
        const fullPath = m[1];
        const venueSlug = m[2];
        const eventSlug = m[3];
        const rawTitle = decodeEntities(m[4]);
        if (!rawTitle || rawTitle.length < 3) continue;
        const cancelled = /\*?GIG CANCELLED\*?/i.test(rawTitle);
        const title = rawTitle.replace(/\*?GIG CANCELLED\*?\s*/i, '').trim();
        if (!title) continue;

        const afterLink = html.slice(m.index + m[0].length, m.index + m[0].length + 400);
        const venueMatch = afterLink.match(/—\s*([^<\n\r]+)/);
        const venue = venueMatch
          ? decodeEntities(venueMatch[1].trim())
          : venueSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        const idMatch = eventSlug.match(/-(\d+)$/);
        const eventId = idMatch ? idMatch[1] : eventSlug;
        const eventDate = new Date(date);
        eventDate.setHours(12, 0, 0, 0);

        found.push({
          id: `headfirst-${eventId}`,
          source: 'headfirst',
          name: title,
          description: '',
          date: eventDate.toISOString(),
          venue,
          cost: 'Price TBA',
          url: `https://www.headfirstbristol.co.uk${fullPath}`,
          image: null,
          status: cancelled ? 'cancelled' : null
        });
      }
      return found;
    };

    const primary = extractWith(linkRe);
    if (primary.length) {
      events.push(...primary);
    } else {
      // Try the more permissive pattern and log so we can diagnose what changed
      const fallback = extractWith(fallbackRe);
      if (fallback.length) {
        console.log(`Headfirst: primary regex matched 0 events; fallback matched ${fallback.length} — URL format may have changed`);
        events.push(...fallback);
      } else {
        // Log a snippet of the page to help diagnose (links found, page structure)
        const anyLinks = (html.match(/href="\/whats-on\/[^"]+"/g) || []).slice(0, 5);
        console.log(`Headfirst: 0 events found on ${sourceUrl}`);
        console.log('Headfirst: /whats-on links found:', anyLinks.length ? anyLinks.join(', ') : 'none');
      }
    }

    return events;
  }
}

module.exports = { HeadfirstFetcher, getDayUrl, ordinal };
