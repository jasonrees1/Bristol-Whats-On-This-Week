const axios = require('axios');

const MONTH_MAP = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Sept: 8, Oct: 9, Nov: 10, Dec: 11
};

// Longest alternatives first so "September" isn't partially matched as "Sep"
const MONTH_PAT = 'September|January|February|November|December|October|August|April|March|July|June|May|Sept|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
const DAY_PAT = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun';

function parseMonthStr(s) {
  const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return MONTH_MAP[n] !== undefined ? MONTH_MAP[n] : null;
}

function parseAmPm(hourStr, minuteStr, ampm) {
  let hour = parseInt(hourStr);
  const minute = minuteStr ? parseInt(minuteStr) : 0;
  if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
  if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
  return { hour, minute };
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

function inferYear(day, month, now) {
  const y = now.getFullYear();
  const candidate = new Date(y, month, day);
  return (now - candidate > 60 * 24 * 60 * 60 * 1000) ? y + 1 : y;
}

class WethecuriousFetcher {
  async fetchEvents(now = new Date()) {
    try {
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
        'Accept': 'text/html'
      };

      // Pass 1: listing pages → event slugs
      const [p0, p1] = await Promise.allSettled([
        axios.get('https://www.wethecurious.org/whats-on/events', { headers, timeout: 15000 }),
        axios.get('https://www.wethecurious.org/whats-on/events?page=1', { headers, timeout: 15000 })
      ]);

      const slugs = new Set();
      for (const r of [p0, p1]) {
        if (r.status === 'fulfilled') {
          this._parseListingSlugs(r.value.data).forEach(s => slugs.add(s));
        }
      }

      // Pass 2: event pages
      const slugArr = [...slugs];
      const settled = await Promise.allSettled(
        slugArr.map(s =>
          axios.get(`https://www.wethecurious.org/whats-on/events/${s}`, { headers, timeout: 15000 })
        )
      );

      const seen = new Set();
      const events = [];

      settled.forEach((result, i) => {
        if (result.status === 'rejected') return;
        const url = `https://www.wethecurious.org/whats-on/events/${slugArr[i]}`;
        const evs = this._parseEventPage(result.value.data, slugArr[i], url, now, endDate);
        for (const ev of evs) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            events.push(ev);
          }
        }
      });

      console.log(`We The Curious: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error('We The Curious fetch failed:', err.message);
      return [];
    }
  }

  _parseListingSlugs(html) {
    const re = /href="\/whats-on\/events\/([^"?\/]+)"/gi;
    const slugs = new Set();
    let m;
    while ((m = re.exec(html)) !== null) {
      slugs.add(m[1]);
    }
    return [...slugs];
  }

  _parseEventPage(html, slug, url, now, endDate) {
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i);
    if (!titleMatch) return [];
    const title = decodeEntities(titleMatch[1]);

    const pad = n => String(n).padStart(2, '0');

    // Find specific performance dates and collect times that follow within 150 chars.
    // Handles:
    //   "Thursday 17th Sept: 6pm, 7:15pm, 8:30pm"
    //   "Wed 12 Aug - 10am"
    const dateRe = new RegExp(`(?:${DAY_PAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PAT})`, 'gi');
    const timeRe = /(\d{1,2})(?::(\d{2}))?(am|pm)/gi;

    const events = [];
    let dm;

    while ((dm = dateRe.exec(html)) !== null) {
      const day = parseInt(dm[1]);
      const month = parseMonthStr(dm[2]);
      if (month === null) continue;
      const year = inferYear(day, month, now);

      const afterDate = html.slice(dm.index + dm[0].length, dm.index + dm[0].length + 150);
      timeRe.lastIndex = 0;
      let tm;
      while ((tm = timeRe.exec(afterDate)) !== null) {
        const { hour, minute } = parseAmPm(tm[1], tm[2], tm[3]);
        const d = new Date(year, month, day, hour, minute, 0, 0);
        if (d < now || d > endDate) continue;

        events.push({
          id: `wtc-${slug}-${year}${pad(month + 1)}${pad(day)}-${pad(hour)}${pad(minute)}`,
          source: 'wethecurious',
          name: title,
          description: '',
          date: d.toISOString(),
          venue: 'We The Curious',
          cost: 'Price TBA',
          url,
          image: null,
          status: null
        });
      }
    }

    if (events.length > 0) return events;

    // Fallback: date range like "1 – 28 Aug 2026" or "17 Sep – 2 Dec 2026".
    // If the range end is still in the future, show the event as active this week.
    const rangeRe = new RegExp(
      `\\d{1,2}(?:\\s+(?:${MONTH_PAT}))?\\s*[–-]\\s*(\\d{1,2})\\s+(${MONTH_PAT})\\s+(\\d{4})`,
      'i'
    );
    const rm = html.match(rangeRe);
    if (!rm) return [];

    const endMonth = parseMonthStr(rm[2]);
    if (endMonth === null) return [];
    const rangeEnd = new Date(parseInt(rm[3]), endMonth, parseInt(rm[1]), 23, 59, 0, 0);
    if (rangeEnd < now) return [];

    return [{
      id: `wtc-${slug}`,
      source: 'wethecurious',
      name: title,
      description: '',
      date: now.toISOString(),
      venue: 'We The Curious',
      cost: 'Price TBA',
      url,
      image: null,
      status: null
    }];
  }
}

module.exports = { WethecuriousFetcher, parseMonthStr, parseAmPm, inferYear };
