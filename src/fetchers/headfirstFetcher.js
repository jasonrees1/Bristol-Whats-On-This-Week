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
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
        'Accept': 'text/html'
      },
      timeout: 15000
    });
    return this._parseDayEvents(response.data, date);
  }

  _parseDayEvents(html, date) {
    const events = [];

    // Event links: /whats-on/{venue-slug}/{day-abbr}-{date}-{month-abbr}-{title-slug}-{id}
    const linkRe = /href="(\/whats-on\/([^"\/]+)\/((?:mon|tue|wed|thu|fri|sat|sun)-\d+-[a-z]+-[^"]+))"[^>]*>\s*([^<]+)\s*<\/a>/gi;
    let m;

    while ((m = linkRe.exec(html)) !== null) {
      const fullPath = m[1];
      const venueSlug = m[2];
      const eventSlug = m[3];
      const rawTitle = decodeEntities(m[4]);

      if (!rawTitle || rawTitle.length < 3) continue;

      // Handle cancellation notices embedded in title
      const cancelled = /\*?GIG CANCELLED\*?/i.test(rawTitle);
      const title = rawTitle.replace(/\*?GIG CANCELLED\*?\s*/i, '').trim();
      if (!title) continue;

      // Extract venue name: look for "— Venue Name" in the 400 chars after the link
      const afterLink = html.slice(m.index + m[0].length, m.index + m[0].length + 400);
      const venueMatch = afterLink.match(/—\s*([^<\n\r]+)/);
      const venue = venueMatch
        ? decodeEntities(venueMatch[1].trim())
        : venueSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      // Event ID from end of slug
      const idMatch = eventSlug.match(/-(\d+)$/);
      const eventId = idMatch ? idMatch[1] : eventSlug;

      // No time shown on listing pages — use noon as neutral default
      const eventDate = new Date(date);
      eventDate.setHours(12, 0, 0, 0);

      events.push({
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

    return events;
  }
}

module.exports = { HeadfirstFetcher, getDayUrl, ordinal };
