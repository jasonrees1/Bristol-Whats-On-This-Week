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
    // Tolerates single or double quotes and both relative (/whats-on/...) and
    // absolute (https://www.headfirstbristol.co.uk/whats-on/...) href forms.
    const HREF_RE = /href=(["'])((?:https?:\/\/www\.headfirstbristol\.co\.uk)?\/whats-on\/([^"'\/]+)\/((?:mon|tue|wed|thu|fri|sat|sun)-\d+-[a-z]+-[^"'?#]+))\1/gi;

    const events = [];
    let m;

    while ((m = HREF_RE.exec(html)) !== null) {
      const fullPath = m[2];
      const venueSlug = m[3];
      const eventSlug = m[4];

      const idMatch = eventSlug.match(/-(\d+)$/);
      if (!idMatch) continue;
      const eventId = idMatch[1];

      let name = '';
      let cancelled = false;

      // Try to extract the title from plain anchor text (works for simple anchors and tests).
      const afterHref = html.slice(m.index + m[0].length);
      const anchorTextM = afterHref.match(/^[^>]*>\s*([^<]{2,}?)\s*<\/a>/);
      if (anchorTextM) {
        const rawTitle = decodeEntities(anchorTextM[1].trim());
        if (/\*?GIG CANCELLED\*?/i.test(rawTitle)) cancelled = true;
        name = rawTitle.replace(/\*?GIG CANCELLED\*?\s*/i, '').trim();
        if (!name || name.length < 3) continue;
      }

      // Anchor contained nested elements — derive the name from the URL slug instead.
      if (!name) {
        const slugBody = eventSlug
          .replace(/^(?:mon|tue|wed|thu|fri|sat|sun)-\d+-[a-z]+-/i, '')
          .replace(/-\d+$/, '');
        name = slugBody.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (!name || name.length < 3) continue;
        const ctx = html.slice(Math.max(0, m.index - 100), m.index + m[0].length + 500);
        if (/GIG CANCELLED/i.test(ctx)) cancelled = true;
      }

      // Venue: look for an em-dash pattern after the link, else title-case the slug.
      const afterLink = html.slice(m.index, m.index + m[0].length + 400);
      const venueMatch = afterLink.match(/—\s*([^<\n\r]+)/);
      const venue = venueMatch
        ? decodeEntities(venueMatch[1].trim())
        : venueSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const eventDate = new Date(date);
      eventDate.setHours(12, 0, 0, 0);

      const url = fullPath.startsWith('http')
        ? fullPath
        : `https://www.headfirstbristol.co.uk${fullPath}`;

      // Image: Headfirst renders <img src="..."> before the <a> in each card
      const beforeHref = html.slice(Math.max(0, m.index - 1000), m.index);
      const imgMatches = [...beforeHref.matchAll(/<img[^>]+src=(["'])([^"']+)\1/gi)];
      const lastImgSrc = imgMatches.length ? imgMatches[imgMatches.length - 1][2] : null;
      const image = lastImgSrc
        ? (lastImgSrc.startsWith('http') ? lastImgSrc : `https://www.headfirstbristol.co.uk${lastImgSrc}`)
        : null;

      events.push({
        id: `headfirst-${eventId}`,
        source: 'headfirst',
        name,
        description: '',
        date: eventDate.toISOString(),
        venue,
        cost: 'Price TBA',
        url,
        image,
        status: cancelled ? 'cancelled' : null
      });
    }

    if (!events.length) {
      const anyLinks = (
        html.match(/href=["'](?:https?:\/\/www\.headfirstbristol\.co\.uk)?\/whats-on\/[^"']+["']/g) || []
      ).slice(0, 5);
      console.log(`Headfirst: 0 events found on ${sourceUrl}`);
      console.log('Headfirst: /whats-on links found:', anyLinks.length ? anyLinks.join(', ') : 'none');
    }

    // ── JSON-LD supplement ──────────────────────────────────────────────────────
    // Headfirst embeds schema.org JSON-LD for every event on the page, including
    // some that have no corresponding <a> link in the HTML (e.g. Butcher Brown).
    // Parse it and add any events not already captured above.
    const ldScriptM = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldScriptM) {
      try {
        const ldItems = JSON.parse(ldScriptM[1]);
        if (Array.isArray(ldItems)) {
          // Normalise a name for fuzzy dedup: lowercase, strip punctuation
          function ldNorm(n) {
            return n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
          }
          const htmlNorms = events.map(e => ldNorm(e.name));

          for (const ev of ldItems) {
            if (!ev.name) continue;

            let name = decodeEntities(String(ev.name));
            // ALL-CAPS names (e.g. "BUTCHER BROWN + ALAMAY") → title case
            if (name.length > 1 && name === name.toUpperCase()) {
              name = name.replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase());
            }
            if (!name || name.length < 2) continue;

            // Skip if already captured via an HTML link (fuzzy: either name contains the other)
            const norm = ldNorm(name);
            if (htmlNorms.some(n => n.includes(norm) || norm.includes(n))) continue;

            // Parse startDate: "2026-08-18T19:00" — add :00 for a valid ISO string
            let eventDate = new Date(date);
            eventDate.setHours(12, 0, 0, 0);
            if (ev.startDate) {
              const fixed = String(ev.startDate).replace(/T(\d{1,2}:\d{2})$/, 'T$1:00');
              const d = new Date(fixed);
              if (!isNaN(d.getTime())) eventDate = d;
            }

            const venue = decodeEntities(String(ev.location?.name || 'Venue TBA'));
            // Direct event URL is always empty in Headfirst JSON-LD; use venue page
            const url = ev.location?.sameAs || sourceUrl;

            let cost = 'Price TBA';
            const offer = Array.isArray(ev.offers) ? ev.offers[0] : null;
            if (offer && offer.price != null) {
              const pence = parseInt(offer.price, 10);
              if (!isNaN(pence)) cost = pence === 0 ? 'Free' : '£' + Math.round(pence / 100);
              if (String(offer.availability || '').includes('SoldOut')) cost = 'Sold Out';
            }

            const cancelled = String(ev.eventStatus || '').includes('Cancelled');
            const soldOut = String(offer?.availability || '').includes('SoldOut');

            const idSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 36);
            const dateStr = eventDate.toISOString().split('T')[0];

            events.push({
              id: `headfirst-ld-${dateStr}-${idSlug}`,
              source: 'headfirst',
              name,
              description: '',
              date: eventDate.toISOString(),
              venue,
              cost,
              url,
              image: null,
              status: cancelled ? 'cancelled' : soldOut ? 'sold_out' : null
            });

            htmlNorms.push(norm); // prevent intra-LD duplicates
          }
        }
      } catch (e) {
        console.log('Headfirst: JSON-LD parse error:', e.message);
      }
    }

    return events;
  }
}

module.exports = { HeadfirstFetcher, getDayUrl, ordinal };
