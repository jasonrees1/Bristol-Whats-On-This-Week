const axios = require('axios');

const MONTHS_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Bristol Events Guide/1.0)',
  'Accept': 'text/html'
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
      const mainRes = await axios.get('https://bristolbeacon.org/whats-on/', {
        headers: HEADERS,
        timeout: 20000
      });
      const mainHtml = mainRes.data || '';
      console.log(`Bristol Beacon: main page (${mainHtml.length} bytes)`);

      const catRe = /href="((?:https?:\/\/bristolbeacon\.org)?\/whats-on\/category\/[^"?#]+)"/gi;
      const catUrls = new Set();
      let cm;
      while ((cm = catRe.exec(mainHtml)) !== null) {
        const raw = cm[1];
        catUrls.add(raw.startsWith('http') ? raw : `https://bristolbeacon.org${raw}`);
      }

      // Hardcoded fallback if main page yields no category links (AJAX-driven listing)
      if (!catUrls.size) {
        [
          'comedy', 'jazz', 'rock-pop-indie', 'folk', 'electronic-dance',
          'soul-rb', 'world-roots-folk', 'classical', 'orchestral', 'gigs-concerts', 'dance'
        ].forEach(c => catUrls.add(`https://bristolbeacon.org/whats-on/category/${c}/`));
      }

      console.log(`Bristol Beacon: fetching ${catUrls.size} category pages`);

      const settled = await Promise.allSettled(
        [...catUrls].map(url => axios.get(url, { headers: HEADERS, timeout: 15000 }))
      );

      const allEvents = [];
      const seenUrls = new Set();

      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        const events = this._parseEvents(result.value.data || '', now, endDate);
        for (const event of events) {
          if (!seenUrls.has(event.url)) {
            seenUrls.add(event.url);
            allEvents.push(event);
          }
        }
      }

      console.log(`Bristol Beacon: ${allEvents.length} events this week`);
      return allEvents;
    } catch (err) {
      console.error('Bristol Beacon fetch failed:', err.message);
      return [];
    }
  }

  _parseEvents(html, now, endDate) {
    // Bristol Beacon card structure (category pages):
    // <a class="c-col-card__link" href="URL"><span class="u-hidden-visually">NAME</span></a>
    // <div class="c-event-card__image"><img data-srcset="URL 16w, URL 475w, ..."></div>
    // <div class="c-event-card__content">
    //   <p class="...--date"><i class="..."></i> DATE TEXT</p>
    //   <h3 class="c-event-card__title">TITLE</h3>
    // </div>
    const CARD_RE = /<a\s[^>]*class="[^"]*c-col-card__link[^"]*"[^>]*href="(https?:\/\/bristolbeacon\.org\/whats-on\/(?!category\/)[^"?#]+)"[^>]*>\s*<span[^>]*>\s*([^<]{1,120}?)\s*<\/span>/gi;

    const events = [];
    const seen = new Set();
    let m;

    while ((m = CARD_RE.exec(html)) !== null) {
      const url = m[1].trim();
      const name = m[2].trim()
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .replace(/&[a-z]+;/g, '')
        .trim();

      if (!name || name.length < 2) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      // Look in the 1500 chars after the matched anchor for date, image, and cancelled flag
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 1500);

      // Date: text following the icon <i> tag inside the --date paragraph
      const dateParaM = after.match(
        /<p\s[^>]*class="[^"]*--date[^"]*"[^>]*>(?:[^<]*<[^>]+>[^<]*<\/[^>]+>)*\s*([^<]{3,120})/i
      );
      let dateStr = '';
      if (dateParaM) {
        dateStr = dateParaM[1].trim()
          .replace(/&ndash;/g, '–')
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .trim();
      }
      if (!dateStr) continue;

      const range = parseDateRange(dateStr);
      if (!range || range.end < now || range.start > endDate) continue;

      let displayDate;
      if (range.start >= now) {
        displayDate = new Date(range.start);
      } else {
        // Ongoing show — use today's slot time, or tomorrow's if that's already past
        const todaySlot = new Date(
          now.getFullYear(), now.getMonth(), now.getDate(),
          range.start.getHours(), range.start.getMinutes(), 0, 0
        );
        displayDate = todaySlot > now
          ? todaySlot
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1,
                     range.start.getHours(), range.start.getMinutes(), 0, 0);
      }

      // Image: pick the 475w entry from data-srcset (image div comes after the link)
      const srcsetM = after.match(/data-srcset="([^"]+)"/i);
      let image = null;
      if (srcsetM) {
        const parts = srcsetM[1].split(',');
        const picked = (parts[1] || parts[0] || '').trim();
        const srcsetUrl = picked.replace(/\s+\d+\w*$/, '').trim();
        if (srcsetUrl) {
          image = srcsetUrl.startsWith('http')
            ? srcsetUrl
            : `https://bristolbeacon.org${srcsetUrl}`;
        }
      }

      const cancelled = /\bCANCELLED\b/i.test(after.slice(0, 500));
      const slug = url
        .replace(/^https?:\/\/bristolbeacon\.org\/whats-on\//, '')
        .replace(/\/+$/, '');

      events.push({
        id: `bristolbeacon-${slug}`,
        source: 'bristolbeacon',
        name,
        description: '',
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
