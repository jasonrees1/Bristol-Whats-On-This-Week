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
      // Step 1: fetch the main whats-on page to discover category links
      const mainRes = await axios.get('https://bristolbeacon.org/whats-on/', {
        headers: HEADERS,
        timeout: 20000
      });
      const mainHtml = mainRes.data || '';
      console.log(`Bristol Beacon: main page (${mainHtml.length} bytes)`);

      // Step 2: collect category page URLs
      const catRe = /href="((?:https?:\/\/bristolbeacon\.org)?\/whats-on\/category\/[^"?#]+)"/gi;
      const catUrls = new Set();
      let cm;
      while ((cm = catRe.exec(mainHtml)) !== null) {
        const raw = cm[1];
        catUrls.add(raw.startsWith('http') ? raw : `https://bristolbeacon.org${raw}`);
      }

      // Hardcoded fallback if the main page yields no categories (e.g. AJAX-driven)
      if (!catUrls.size) {
        [
          'comedy', 'jazz', 'rock-pop-indie', 'folk', 'electronic-dance',
          'soul-rb', 'world-roots-folk', 'classical'
        ].forEach(c => catUrls.add(`https://bristolbeacon.org/whats-on/category/${c}/`));
      }

      console.log(`Bristol Beacon: fetching ${catUrls.size} category pages`);

      // Step 3: fetch all category pages in parallel
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
    // Event links on category pages: any <a href="/whats-on/[slug]/"> that isn't a
    // category link. Use the link's text content as the title; look before it for
    // date and image, after it for description.
    // NOTE: Use <a[^>]*href= (not <a\s+href=) to handle other attributes before href.
    const titleRe = /<a[^>]+href="((?:https?:\/\/bristolbeacon\.org)?\/whats-on\/(?!category\/)[^"?#]+)"[^>]*>([^<]{2,120})<\/a>/gi;

    const events = [];
    const seen = new Set();
    let m;

    while ((m = titleRe.exec(html)) !== null) {
      const rawUrl = m[1].trim();
      const name = m[2].trim().replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, '').trim();
      if (!name || name.length < 2) continue;

      // Skip generic navigation links whose text is clearly not an event name
      if (/^(book\s*tickets?|more\s*info|find\s*out\s*more|buy\s*tickets?|tickets?|info|see\s*all)$/i.test(name)) continue;

      const url = rawUrl.startsWith('http') ? rawUrl : `https://bristolbeacon.org${rawUrl}`;
      if (seen.has(url)) continue;
      seen.add(url);

      const before = html.slice(Math.max(0, m.index - 1000), m.index);
      const after = html.slice(m.index + m[0].length, m.index + m[0].length + 500);

      // Date: walk backwards through <p> and text nodes to find a parseable date
      const allParas = [...before.matchAll(/<(?:p|span|div)[^>]*>([^<]{3,120})<\/(?:p|span|div)>/gi)];
      let dateStr = '';
      for (let i = allParas.length - 1; i >= 0; i--) {
        const candidate = allParas[i][1].trim().replace(/&#\d+;/g, '').replace(/&[a-z]+;/g, '');
        if (parseDateRange(candidate)) { dateStr = candidate; break; }
      }
      if (!dateStr) continue;

      const range = parseDateRange(dateStr);
      if (!range || range.end < now || range.start > endDate) continue;

      // Display date
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

      // Image: last <img src="..."> before the link
      const imgMatches = [...before.matchAll(/<img[^>]+src=(["'])([^"']+)\1/gi)];
      const lastImgSrc = imgMatches.length ? imgMatches[imgMatches.length - 1][2] : null;
      const image = lastImgSrc
        ? (lastImgSrc.startsWith('http') ? lastImgSrc : `https://bristolbeacon.org${lastImgSrc}`)
        : null;

      // Description: first <p> after the link
      const descM = after.match(/<p[^>]*>([^<]{5,200})<\/p>/i);
      const description = descM ? descM[1].trim() : '';

      const cancelled = /\bCANCELLED\b/i.test(before.slice(-300) + m[0] + after.slice(0, 300));

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
