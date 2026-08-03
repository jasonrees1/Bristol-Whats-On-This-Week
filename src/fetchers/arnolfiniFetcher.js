const axios = require('axios');

const MONTH_MAP = {
  January: 0, February: 1, March: 2, April: 3,
  May: 4, June: 5, July: 6, August: 7,
  September: 8, October: 9, November: 10, December: 11
};

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

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

function toDate(day, month, year) {
  const y = year ? parseInt(year) : new Date().getFullYear();
  const d = new Date(y, MONTH_MAP[month], parseInt(day));
  return isNaN(d.getTime()) ? null : d;
}

class ArnolfiniFetcher {
  async fetchEvents() {
    try {
      const response = await axios.get('https://arnolfini.org.uk/whatson/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
          'Accept': 'text/html'
        },
        timeout: 15000
      });
      return this._parseEvents(response.data);
    } catch (error) {
      console.error('Arnolfini scrape failed:', error.message);
      return [];
    }
  }

  _parseEvents(html, now = new Date()) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Collect all /whatson/{slug}/ links — slug + title + position
    const linkRe = /href="(?:https?:\/\/(?:www\.)?arnolfini\.org\.uk)?\/whatson\/([^"\/]+)\/"[^>]*>([^<]+)<\/a>/g;
    const links = [];
    const seen = new Set();
    let m;

    while ((m = linkRe.exec(html)) !== null) {
      const slug = m[1];
      const title = decodeEntities(m[2]);
      if (title.length >= 3 && !seen.has(slug)) {
        seen.add(slug);
        links.push({ slug, title, start: m.index, end: m.index + m[0].length });
      }
    }

    const events = [];

    for (let i = 0; i < links.length; i++) {
      const { slug, title, end } = links[i];

      // Use text between this link and the next as the date context — prevents bleed
      const ctxEnd = i + 1 < links.length
        ? Math.min(links[i + 1].start, end + 600)
        : end + 600;
      const ctx = html.slice(end, ctxEnd).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

      const { startDate, endDate } = this._parseDateContext(ctx);
      if (!startDate) continue;

      // Include if event overlaps with this week
      if (startDate > weekEnd || endDate < today) continue;

      // If the event started before today (ongoing), use today as display date
      const eventDate = startDate < today ? new Date(today) : new Date(startDate);

      events.push({
        id: `arnolfini-${slug}`,
        source: 'arnolfini',
        name: title,
        description: '',
        date: eventDate.toISOString(),
        venue: 'Arnolfini, Bristol',
        cost: 'Price TBA',
        url: `https://arnolfini.org.uk/whatson/${slug}/`,
        image: null,
        status: null
      });
    }

    console.log(`Arnolfini: ${events.length} events overlapping this week`);
    return events;
  }

  _parseDateContext(ctx) {
    const FAR_FUTURE = new Date(8640000000000000);

    // Range: "DD Month [YYYY] - DD Month YYYY"  (dash or en-dash)
    const rangeRe = new RegExp(
      `(\\d{1,2})\\s+(${MONTHS})(?:\\s+(\\d{4}))?\\s*[-–]\\s*(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})`
    );
    const rm = ctx.match(rangeRe);
    if (rm) {
      const startDate = toDate(rm[1], rm[2], rm[3] || rm[6]);
      const endDate = toDate(rm[4], rm[5], rm[6]);
      if (startDate && endDate) return { startDate, endDate };
    }

    // Ongoing: "From DD Month [YYYY]"
    const fromRe = new RegExp(`From\\s+(\\d{1,2})\\s+(${MONTHS})(?:\\s+(\\d{4}))?`);
    const fm = ctx.match(fromRe);
    if (fm) {
      const startDate = toDate(fm[1], fm[2], fm[3]);
      if (startDate) return { startDate, endDate: FAR_FUTURE };
    }

    // Single date: "DD Month YYYY"
    const singleRe = new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})`);
    const sm = ctx.match(singleRe);
    if (sm) {
      const startDate = toDate(sm[1], sm[2], sm[3]);
      if (startDate) {
        const endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        return { startDate, endDate };
      }
    }

    return { startDate: null, endDate: null };
  }
}

module.exports = ArnolfiniFetcher;
