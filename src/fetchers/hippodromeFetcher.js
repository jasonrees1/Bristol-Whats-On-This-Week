const axios = require('axios');

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  January: 0, February: 1, March: 2, April: 3, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
};

const MONTH_PAT = Object.keys(MONTH_MAP).join('|');

function normalizeMonth(s) {
  if (!s) return undefined;
  const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return MONTH_MAP[n] !== undefined ? MONTH_MAP[n] : MONTH_MAP[n.slice(0, 3)];
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ').trim();
}

class HippodromeFetcher {
  async fetchEvents(now = new Date()) {
    try {
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
        'Accept': 'text/html'
      };

      // Pass 1: venue listing page → show cards with date ranges
      const listRes = await axios.get('https://www.atgtickets.com/venues/bristol-hippodrome/', {
        headers,
        timeout: 15000
      });
      const shows = this._parseShowCards(listRes.data);

      // Filter to shows whose run overlaps with the current 7-day window
      const thisWeek = shows.filter(show => {
        const range = this._parseDateRange(show.dateStr);
        return range && range.start <= endDate && range.end >= now;
      });

      if (!thisWeek.length) {
        console.log('Bristol Hippodrome: no shows running this week');
        return [];
      }

      // Pass 2: fetch each show page for description and performance time
      const settled = await Promise.allSettled(
        thisWeek.map(show => axios.get(show.url, { headers, timeout: 15000 }))
      );

      const events = [];
      const pad = n => String(n).padStart(2, '0');

      settled.forEach((result, i) => {
        const show = thisWeek[i];
        const range = this._parseDateRange(show.dateStr);

        // First upcoming performance: whichever is later, the run start or now
        const baseDate = new Date(Math.max(range.start.getTime(), now.getTime()));

        let description = '';
        let hour = 19, minute = 30; // default evening time

        if (result.status === 'fulfilled') {
          description = this._extractDescription(result.value.data);
          const t = this._extractPrimaryTime(result.value.data);
          if (t) { hour = t.hour; minute = t.minute; }
        }

        baseDate.setHours(hour, minute, 0, 0);
        // If applying the time pushed us before now (show already ran today), advance one day
        if (baseDate < now) {
          baseDate.setDate(baseDate.getDate() + 1);
          baseDate.setHours(hour, minute, 0, 0);
        }
        if (baseDate > endDate) return; // run doesn't cover this week after all

        const d = baseDate;
        const id = `hippodrome-${show.slug}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

        events.push({
          id,
          source: 'hippodrome',
          name: show.title,
          description,
          date: d.toISOString(),
          venue: 'Bristol Hippodrome',
          cost: 'Price TBA',
          url: show.url,
          image: show.image,
          status: null
        });
      });

      console.log(`Bristol Hippodrome: ${events.length} shows this week`);
      return events;
    } catch (err) {
      console.error('Hippodrome fetch failed:', err.message);
      return [];
    }
  }

  _parseShowCards(html) {
    const shows = [];
    const seen = new Set();

    // Locate each show by its detail URL (exclude /calendar/ sub-links)
    const urlRe = /href="(\/shows\/([^"\/]+)\/bristol-hippodrome\/)"/gi;
    let m;

    while ((m = urlRe.exec(html)) !== null) {
      const [, path, slug] = m;
      if (seen.has(slug)) continue;
      seen.add(slug);

      // Scan up to 1200 chars after the link for card details
      const context = html.slice(m.index, m.index + 1200);

      // Title from <h3>
      const titleM = context.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/i);
      if (!titleM) continue;
      const title = decodeEntities(titleM[1]);
      if (!title || title.length < 3) continue;

      // Date string: "Sat 15 Aug 2026" or "Tue 18 Aug - Sun 23 Aug 2026"
      const dateM = context.match(
        new RegExp(
          `\\d{1,2}\\s+(?:${MONTH_PAT})\\s+\\d{4}(?:\\s*[-–]\\s*(?:\\w+\\s+)?\\d{1,2}\\s+(?:${MONTH_PAT})\\s+\\d{4})?`,
          'i'
        )
      );
      if (!dateM) continue;

      // Image (Cloudinary or similar CDN)
      const imgM = context.match(/src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/i);
      const image = imgM ? imgM[1] : null;

      shows.push({
        slug,
        url: `https://www.atgtickets.com${path}`,
        title,
        dateStr: dateM[0],
        image
      });
    }

    return shows;
  }

  _parseDateRange(str) {
    if (!str) return null;

    // Range: "Tue 18 Aug - Sun 23 Aug 2026" or "18 Aug - 23 Aug 2026"
    const rangeM = str.match(
      /(?:\w+\s+)?(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?\s*[-–]\s*(?:\w+\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})/i
    );
    if (rangeM) {
      const endYear = parseInt(rangeM[6]);
      const endMonth = normalizeMonth(rangeM[5]);
      const endDay = parseInt(rangeM[4]);
      const startMonth = normalizeMonth(rangeM[2]);
      const startYear = rangeM[3] ? parseInt(rangeM[3]) : endYear;
      const startDay = parseInt(rangeM[1]);
      if (endMonth === undefined || startMonth === undefined) return null;
      return {
        start: new Date(startYear, startMonth, startDay, 0, 0, 0),
        end: new Date(endYear, endMonth, endDay, 23, 59, 59)
      };
    }

    // Single date: "Sat 15 Aug 2026"
    const singleM = str.match(/(?:\w+\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (singleM) {
      const year = parseInt(singleM[3]);
      const month = normalizeMonth(singleM[2]);
      const day = parseInt(singleM[1]);
      if (month === undefined) return null;
      return {
        start: new Date(year, month, day, 0, 0, 0),
        end: new Date(year, month, day, 23, 59, 59)
      };
    }

    return null;
  }

  _extractDescription(html) {
    const m =
      html.match(/<meta\s+name="description"\s+content="([^"]{10,})"/i) ||
      html.match(/<meta\s+content="([^"]{10,})"\s+name="description"/i) ||
      html.match(/<p[^>]*>([^<]{40,})<\/p>/i);
    return m ? decodeEntities(m[1]) : '';
  }

  _extractPrimaryTime(html) {
    // Find the first evening time (17:00–23:00) in the page — avoids matinee times
    const allTimes = [...html.matchAll(/\b(\d{2}):(\d{2})\b/g)];
    for (const m of allTimes) {
      const h = parseInt(m[1]);
      const min = parseInt(m[2]);
      if (h >= 17 && h < 24 && min < 60) return { hour: h, minute: min };
    }
    return null; // caller uses default 19:30
  }
}

module.exports = { HippodromeFetcher, normalizeMonth };
