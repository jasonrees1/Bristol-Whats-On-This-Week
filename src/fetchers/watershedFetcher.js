const axios = require('axios');

const SHORT_MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};
const SHORT_MONTH_PAT = Object.keys(SHORT_MONTHS).join('|');

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

function inferYear(day, month, now) {
  const y = now.getFullYear();
  const candidate = new Date(y, month, day);
  return (now - candidate > 60 * 24 * 60 * 60 * 1000) ? y + 1 : y;
}

class WatershedFetcher {
  async fetchEvents(now = new Date()) {
    try {
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
        'Accept': 'text/html'
      };

      const listRes = await axios.get('https://www.watershed.co.uk/whatson', {
        headers,
        timeout: 15000
      });
      const eventUrls = this._parseListingUrls(listRes.data);

      const settled = await Promise.allSettled(
        eventUrls.map(url => axios.get(url, { headers, timeout: 15000 }))
      );

      const seen = new Set();
      const events = [];

      settled.forEach((result, i) => {
        if (result.status === 'rejected') return;
        const screenings = this._parseScreenings(result.value.data, eventUrls[i], now, endDate);
        for (const ev of screenings) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            events.push(ev);
          }
        }
      });

      console.log(`Watershed: ${events.length} screenings this week`);
      return events;
    } catch (err) {
      console.error('Watershed fetch failed:', err.message);
      return [];
    }
  }

  _parseListingUrls(html) {
    const re = /href="(\/whatson\/(\d+)\/([^"\/]+))"/gi;
    const seen = new Set();
    const urls = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const full = `https://www.watershed.co.uk${m[1]}`;
      if (!seen.has(full)) {
        seen.add(full);
        urls.push(full);
      }
    }
    return urls;
  }

  _parseScreenings(html, eventUrl, now, endDate) {
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i);
    if (!titleMatch) return [];
    const title = decodeEntities(titleMatch[1]);

    const idMatch = eventUrl.match(/\/whatson\/(\d+)\//);
    const eventId = idMatch ? idMatch[1] : 'x';

    // Format on event pages: "Tue 4 Aug: 20:20 (ends 22:05)"
    const re = new RegExp(
      `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\s+(\\d{1,2})\\s+(${SHORT_MONTH_PAT}):\\s+(\\d{1,2}):(\\d{2})`,
      'gi'
    );

    const pad = n => String(n).padStart(2, '0');
    const events = [];
    let m;

    while ((m = re.exec(html)) !== null) {
      const day = parseInt(m[1]);
      const monthKey = m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase();
      const month = SHORT_MONTHS[monthKey];
      if (month === undefined) continue;

      const year = inferYear(day, month, now);
      const hour = parseInt(m[3]);
      const minute = parseInt(m[4]);
      const d = new Date(year, month, day, hour, minute, 0, 0);
      if (d < now || d > endDate) continue;

      const dateKey = `${year}${pad(month + 1)}${pad(day)}`;
      const timeKey = `${pad(hour)}${pad(minute)}`;

      events.push({
        id: `watershed-${eventId}-${dateKey}-${timeKey}`,
        source: 'watershed',
        name: title,
        description: '',
        date: d.toISOString(),
        venue: 'Watershed',
        cost: 'Price TBA',
        url: eventUrl,
        image: null,
        status: null
      });
    }

    return events;
  }
}

module.exports = { WatershedFetcher, inferYear };
