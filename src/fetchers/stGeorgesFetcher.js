const axios = require('axios');

const MONTH_MAP = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};
const MONTH_NAMES = Object.keys(MONTH_MAP).join('|');

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

function parseDate(dayNum, monthName, year) {
  const normalized = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
  const month = MONTH_MAP[normalized];
  if (month === undefined) return null;
  return new Date(parseInt(year), month, parseInt(dayNum), 19, 30, 0, 0);
}

class StGeorgesFetcher {
  async fetchEvents(now = new Date()) {
    try {
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const res = await axios.get('https://www.stgeorgesbristol.co.uk/whats-on/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
          'Accept': 'text/html'
        },
        timeout: 15000
      });

      const events = this._parseEvents(res.data).filter(e => {
        const d = new Date(e.date);
        return d >= now && d <= endDate;
      });

      console.log(`St George's Bristol: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error("St George's fetch failed:", err.message);
      return [];
    }
  }

  _parseEvents(html) {
    const events = [];

    // Match only the "View event" anchor to avoid matching the "Book Now" /book/ sub-path links
    const viewRe = /<a href="(https:\/\/www\.stgeorgesbristol\.co\.uk\/whats-on\/([^"\/]+)\/)">View event<\/a>/gi;
    const datePattern = `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\s+(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})`;

    let m;
    while ((m = viewRe.exec(html)) !== null) {
      const url = m[1];
      const slug = m[2];

      // Look in 600 chars before the "View event" link; take the LAST match in that
      // context so we always pick the current card's date/title, not a prior card's
      const ctx = html.slice(Math.max(0, m.index - 600), m.index);

      const dateMatches = [...ctx.matchAll(new RegExp(datePattern, 'gi'))];
      if (!dateMatches.length) continue;
      const dm = dateMatches[dateMatches.length - 1];
      const eventDate = parseDate(dm[1], dm[2], dm[3]);
      if (!eventDate) continue;

      const h4s = [...ctx.matchAll(/<h4[^>]*>([^<]+)<\/h4>/gi)];
      if (!h4s.length) continue;
      const title = decodeEntities(h4s[h4s.length - 1][1]);
      if (!title || title.length < 3) continue;

      events.push({
        id: `stgeorges-${slug}`,
        source: 'stgeorges',
        name: title,
        description: '',
        date: eventDate.toISOString(),
        venue: "St George's Bristol",
        cost: 'Price TBA',
        url,
        image: null,
        status: null
      });
    }

    return events;
  }
}

module.exports = { StGeorgesFetcher, parseDate };
