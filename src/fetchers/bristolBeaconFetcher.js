const axios = require('axios');

const MONTHS_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

// Parses "Thu 27 Aug 2026, 20:00", "Thu 27 Aug 2026",
// "Thu 3–Sun 6 Sep 2026", "Mon 31 Aug–Tue 22 Sep 2026"
function parseDateRange(str) {
  if (!str) return null;
  str = str.replace(/\s+/g, ' ').trim();

  // Range: start day (optional start month) – end day end-month year
  const rangeM = str.match(
    /(?:\w+\s+)?(\d{1,2})\s*(?:([A-Za-z]+)\s*)?[–-]\s*(?:\w+\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/
  );
  if (rangeM) {
    const endDay = parseInt(rangeM[3]);
    const endMonthKey = rangeM[4].slice(0, 3).toLowerCase();
    const endMonth = MONTHS_MAP[endMonthKey];
    const endYear = parseInt(rangeM[5]);
    const startDay = parseInt(rangeM[1]);
    const startMonthKey = rangeM[2] ? rangeM[2].slice(0, 3).toLowerCase() : endMonthKey;
    const startMonth = MONTHS_MAP[startMonthKey];
    if (endMonth === undefined || startMonth === undefined) return null;
    const startYear = startMonth > endMonth ? endYear - 1 : endYear;
    return {
      start: new Date(startYear, startMonth, startDay, 19, 0, 0),
      end: new Date(endYear, endMonth, endDay, 23, 59, 59)
    };
  }

  // Single date with optional time
  const singleM = str.match(
    /(?:\w+\s+)?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/
  );
  if (singleM) {
    const month = MONTHS_MAP[singleM[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    const hour = singleM[4] ? parseInt(singleM[4]) : 19;
    const minute = singleM[5] ? parseInt(singleM[5]) : 0;
    const d = new Date(parseInt(singleM[3]), month, parseInt(singleM[1]), hour, minute, 0);
    return { start: d, end: d };
  }

  return null;
}

class BristolBeaconFetcher {
  async fetchEvents(now = new Date()) {
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      const response = await axios.get('https://bristolbeacon.org/whats-on/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
          'Accept': 'text/html'
        },
        timeout: 20000
      });
      const html = response.data || '';
      console.log(`Bristol Beacon: fetched whats-on page (${html.length} bytes)`);

      const events = this._parseEvents(html, now, endDate);
      console.log(`Bristol Beacon: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error('Bristol Beacon fetch failed:', err.message);
      return [];
    }
  }

  _parseEvents(html, now, endDate) {
    // Each event card has an h3 with the title link. Image and date appear before it;
    // description appears after. Use the h3 anchor as the locator for each card.
    const titleRe = /<h3[^>]*>\s*<a\s+href="((?:https?:\/\/bristolbeacon\.org)?\/whats-on\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

    const events = [];
    const seen = new Set();
    let m;

    while ((m = titleRe.exec(html)) !== null) {
      const rawUrl = m[1].trim();
      const name = m[2].trim();
      if (!name || name.length < 2) continue;

      const url = rawUrl.startsWith('http') ? rawUrl : `https://bristolbeacon.org${rawUrl}`;
      if (seen.has(url)) continue;
      seen.add(url);

      // Context windows relative to the h3 anchor
      const before = html.slice(Math.max(0, m.index - 1000), m.index);
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 500);

      // Date: walk backwards through <p> elements to find the first that parses as a date
      const allParas = [...before.matchAll(/<p[^>]*>([^<]{3,120})<\/p>/gi)];
      let dateStr = '';
      for (let i = allParas.length - 1; i >= 0; i--) {
        const candidate = allParas[i][1].trim();
        if (parseDateRange(candidate)) { dateStr = candidate; break; }
      }
      if (!dateStr) continue;

      const range = parseDateRange(dateStr);
      if (!range || range.end < now || range.start > endDate) continue;

      // Display date: use start if upcoming; for ongoing shows use today's slot (or tomorrow)
      let displayDate;
      if (range.start >= now) {
        displayDate = new Date(range.start);
      } else {
        const todaySlot = new Date(
          now.getFullYear(), now.getMonth(), now.getDate(),
          range.start.getHours(), range.start.getMinutes(), 0, 0
        );
        displayDate = todaySlot > now
          ? todaySlot
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1,
                     range.start.getHours(), range.start.getMinutes(), 0, 0);
      }

      // Image: last <img src="..."> before the title
      const imgMatches = [...before.matchAll(/<img[^>]+src=(["'])([^"']+)\1/gi)];
      const lastImgSrc = imgMatches.length ? imgMatches[imgMatches.length - 1][2] : null;
      const image = lastImgSrc
        ? (lastImgSrc.startsWith('http') ? lastImgSrc : `https://bristolbeacon.org${lastImgSrc}`)
        : null;

      // Description: first <p> after the title
      const descM = after.match(/<p[^>]*>([^<]{5,200})<\/p>/i);
      const description = descM ? descM[1].trim() : '';

      // Cancelled: check the immediate card context
      const cardCtx = before.slice(-300) + m[0] + after.slice(0, 300);
      const cancelled = /\bCANCELLED\b/i.test(cardCtx);

      const slug = url
        .replace(/^https?:\/\/bristolbeacon\.org\/whats-on\//, '')
        .replace(/\/+$/, '');

      events.push({
        id: `bristolbeacon-${slug}`,
        source: 'bristolbeacon',
        name,
        description,
        date: displayDate.toISOString(),
        venue: 'Bristol Beacon',
        cost: 'Price TBA',
        url,
        image,
        status: cancelled ? 'cancelled' : null
      });
    }

    return events;
  }
}

module.exports = { BristolBeaconFetcher, parseDateRange };
