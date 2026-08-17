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

      // Always supplement with the comprehensive known-category list so we never miss
      // categories that the main-page nav omits (e.g. family-events, exhibitions, talks).
      [
        'comedy', 'jazz', 'rock-pop-indie', 'folk', 'electronic-dance',
        'soul-rb', 'world-roots-folk', 'classical', 'orchestral', 'gigs-concerts', 'dance',
        'family-events', 'exhibitions', 'film', 'talks-events', 'free-events'
      ].forEach(c => catUrls.add(`https://bristolbeacon.org/whats-on/category/${c}/`));

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
    // Bristol Beacon category-page card structure:
    //
    //   <a class="c-col-card__link" href="https://bristolbeacon.org/whats-on/slug/">
    //     <span class="u-hidden-visually">
    //         Event Name     </span>
    //   </a>
    //   <div class="c-event-card__image">
    //     <img ... data-srcset="url 16w, url 475w, ...">
    //   </div>
    //   <div class="c-event-card__content">
    //     <p class="c-event-card__meta-label c-event-card__meta-label--date">
    //       <i class="fas fa-calendar-alt" aria-hidden="true"></i> DATE TEXT
    //     </p>
    //     <h3 class="c-event-card__title">Title</h3>
    //   </div>
    //
    // Strategy: find the c-col-card__link opening tag (single line), then scan
    // forward in two bounded slices — near (200 chars) for the name span,
    // far (1500 chars) for date, image, and cancelled flag.

    // Match the <a> opening tag that carries c-col-card__link (stays on one line)
    const LINK_RE = /href="(https?:\/\/bristolbeacon\.org\/whats-on\/(?!category\/)[^"?#\/][^"?#]*)"[^>]*class="[^"]*c-col-card__link|class="[^"]*c-col-card__link[^"]*"[^>]*href="(https?:\/\/bristolbeacon\.org\/whats-on\/(?!category\/)[^"?#\/][^"?#]*)"/gi;

    const events = [];
    const seen = new Set();
    let m;

    while ((m = LINK_RE.exec(html)) !== null) {
      // group 1 = href-first order, group 2 = class-first order
      const url = (m[1] || m[2] || '').trim();
      if (!url) continue;
      if (seen.has(url)) continue;

      // Bounded slice after the end of the matched tag for name, date, image
      const tagEnd = html.indexOf('>', m.index + m[0].length);
      if (tagEnd === -1) continue;
      const after = html.slice(tagEnd + 1, tagEnd + 1 + 1500);

      // Name: first <span> after the opening tag (holds "u-hidden-visually" text)
      const spanM = after.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      if (!spanM) continue;
      const name = spanM[1]
        .replace(/\n/g, ' ').replace(/\s+/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, '')
        .replace(/&[a-z]+;/g, '')
        .trim();
      if (!name || name.length < 2) continue;
      seen.add(url);

      // Date: text after the <i> icon inside the --date paragraph
      const dateParaM = after.match(
        /<p[^>]*class="[^"]*--date[^"]*"[^>]*>([\s\S]*?)<\/p>/i
      );
      let dateStr = '';
      if (dateParaM) {
        // Strip all tags (including the <i> icon) then take the remaining text
        dateStr = dateParaM[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&ndash;/g, '–')
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/\s+/g, ' ')
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

      const cancelled = /\bCANCELLED\b/i.test(after.slice(0, 600));
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
