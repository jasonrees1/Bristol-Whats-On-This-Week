const { BristolBeaconFetcher, parseDateRange } = require('../../src/fetchers/bristolBeaconFetcher');
const axios = require('axios');

const NOW = new Date('2099-09-20T10:00:00Z'); // Sat 20 Sep 2099, 10 AM UTC
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

// ── Helpers ────────────────────────────────────────────────────
// Mirrors the real Bristol Beacon category-page card structure:
// <a class="c-col-card__link" href="URL"><span class="u-hidden-visually">NAME</span></a>
// <div class="c-event-card__image"><img data-srcset="URL 16w, URL 475w"></div>
// <div class="c-event-card__content">
//   <p class="...--date"><i ...></i> DATE</p>
//   <h3 class="c-event-card__title">TITLE</h3>
// </div>

function makeCard({ slug, title, dateStr, description = '', image = 'https://images.bristolbeacon.org/images/test.jpg', cancelled = false }) {
  return `
<div class="c-event-card">
  <a class="c-col-card__link" href="https://bristolbeacon.org/whats-on/${slug}/">
    <span class="u-hidden-visually">
      ${title}
    </span>
  </a>
  <div class="c-event-card__image">
    <img src="${image}" data-srcset="${image} 16w, ${image} 475w" alt="${title}">
  </div>
  <div class="c-event-card__content">
    <div class="c-event-card__meta">
      <p class="c-event-card__meta-label c-event-card__meta-label--date">
        <i class="fas fa-calendar-alt" aria-hidden="true"></i> ${dateStr}${cancelled ? ' CANCELLED' : ''}
      </p>
    </div>
    <h3 class="c-event-card__title">${title}</h3>
    ${description ? `<p class="c-event-card__description">${description}</p>` : ''}
  </div>
</div>`;
}

function makeCardNoImage({ slug, title, dateStr, description = '' }) {
  return `
<div class="c-event-card">
  <a class="c-col-card__link" href="https://bristolbeacon.org/whats-on/${slug}/">
    <span class="u-hidden-visually">
      ${title}
    </span>
  </a>
  <div class="c-event-card__content">
    <div class="c-event-card__meta">
      <p class="c-event-card__meta-label c-event-card__meta-label--date">
        <i class="fas fa-calendar-alt" aria-hidden="true"></i> ${dateStr}
      </p>
    </div>
    <h3 class="c-event-card__title">${title}</h3>
    ${description ? `<p class="c-event-card__description">${description}</p>` : ''}
  </div>
</div>`;
}

function makeHtml(cards) {
  return `<html><body>${cards.join('\n')}</body></html>`;
}

// ── parseDateRange ─────────────────────────────────────────────

describe('parseDateRange', () => {
  it('parses a single date with time', () => {
    const r = parseDateRange('Thu 27 Aug 2026, 20:00');
    expect(r).not.toBeNull();
    expect(r.start.getDate()).toBe(27);
    expect(r.start.getMonth()).toBe(7); // Aug
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getHours()).toBe(20);
    expect(r.start.getMinutes()).toBe(0);
  });

  it('parses a single date without time, defaulting to 19:00', () => {
    const r = parseDateRange('Thu 27 Aug 2026');
    expect(r).not.toBeNull();
    expect(r.start.getDate()).toBe(27);
    expect(r.start.getHours()).toBe(19);
  });

  it('parses a day-name-prefixed single date', () => {
    const r = parseDateRange('Mon 1 Sep 2026');
    expect(r).not.toBeNull();
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getMonth()).toBe(8); // Sep
  });

  it('parses a same-month range', () => {
    const r = parseDateRange('Thu 3–Sun 6 Sep 2026');
    expect(r).not.toBeNull();
    expect(r.start.getDate()).toBe(3);
    expect(r.start.getMonth()).toBe(8); // Sep
    expect(r.end.getDate()).toBe(6);
    expect(r.end.getMonth()).toBe(8);
    expect(r.end.getFullYear()).toBe(2026);
  });

  it('parses a cross-month range', () => {
    const r = parseDateRange('Mon 31 Aug–Tue 22 Sep 2026');
    expect(r).not.toBeNull();
    expect(r.start.getDate()).toBe(31);
    expect(r.start.getMonth()).toBe(7); // Aug
    expect(r.end.getDate()).toBe(22);
    expect(r.end.getMonth()).toBe(8); // Sep
    expect(r.start.getFullYear()).toBe(2026);
  });

  it('returns null for a season description', () => {
    expect(parseDateRange('2026/27 Orchestral Season')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseDateRange('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseDateRange(null)).toBeNull();
  });
});

// ── _parseEvents ───────────────────────────────────────────────

describe('BristolBeaconFetcher._parseEvents', () => {
  let fetcher;
  beforeEach(() => { fetcher = new BristolBeaconFetcher(); });

  it('extracts a basic event with correct fields', () => {
    const html = makeHtml([makeCard({ slug: 'test-show', title: 'Test Show', dateStr: 'Sun 21 Sep 2099, 19:00' })]);
    const events = fetcher._parseEvents(html, NOW, END);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.name).toBe('Test Show');
    expect(e.id).toBe('bristolbeacon-test-show');
    expect(e.venue).toBe('Bristol Beacon');
    expect(e.source).toBe('bristolbeacon');
    expect(e.url).toBe('https://bristolbeacon.org/whats-on/test-show/');
    expect(e.cost).toBe('Price TBA');
  });

  it('extracts the 475w image URL from data-srcset', () => {
    const img = 'https://images.bristolbeacon.org/images/show-a.jpg';
    const html = makeHtml([makeCard({
      slug: 'show-a', title: 'Show A', dateStr: 'Sun 21 Sep 2099, 19:00', image: img
    })]);
    // makeCard puts "${img} 475w" as the second srcset entry; _parseEvents picks parts[1]
    expect(fetcher._parseEvents(html, NOW, END)[0].image).toBe(img);
  });

  it('prefixes a relative image URL with the site base', () => {
    const html = makeHtml([makeCard({
      slug: 'show-b', title: 'Show B', dateStr: 'Sun 21 Sep 2099, 19:00',
      image: '/images/show-b.jpg'
    })]);
    expect(fetcher._parseEvents(html, NOW, END)[0].image).toBe('https://bristolbeacon.org/images/show-b.jpg');
  });

  it('sets image to null when no data-srcset precedes the card content', () => {
    const html = makeHtml([makeCardNoImage({ slug: 'no-img', title: 'No Image', dateStr: 'Mon 22 Sep 2099, 20:00' })]);
    expect(fetcher._parseEvents(html, NOW, END)[0].image).toBeNull();
  });

  it('filters out events before the window', () => {
    const html = makeHtml([makeCard({ slug: 'past', title: 'Past', dateStr: 'Fri 19 Sep 2099, 19:00' })]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(0);
  });

  it('filters out events after the window', () => {
    const html = makeHtml([makeCard({ slug: 'future', title: 'Future', dateStr: 'Mon 28 Sep 2099, 19:00' })]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(0);
  });

  it('includes a date-range event whose start is within the window', () => {
    const html = makeHtml([makeCard({ slug: 'run', title: 'Running Show', dateStr: 'Tue 22–Sat 26 Sep 2099' })]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(1);
  });

  it('includes a date-range event already running whose end is within the window', () => {
    const html = makeHtml([makeCard({ slug: 'ongoing', title: 'Ongoing Show', dateStr: 'Mon 15–Sun 27 Sep 2099' })]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(1);
  });

  it('marks a cancelled event', () => {
    const html = makeHtml([makeCard({ slug: 'gone', title: 'Gone Show', dateStr: 'Mon 22 Sep 2099, 20:00', cancelled: true })]);
    const events = fetcher._parseEvents(html, NOW, END);
    expect(events[0].status).toBe('cancelled');
  });

  it('sets status to null for a normal event', () => {
    const html = makeHtml([makeCard({ slug: 'ok', title: 'OK Show', dateStr: 'Mon 22 Sep 2099, 20:00' })]);
    expect(fetcher._parseEvents(html, NOW, END)[0].status).toBeNull();
  });

  it('skips events without a parseable date', () => {
    const html = makeHtml([makeCard({ slug: 'no-date', title: 'No Date', dateStr: '2099/2100 Season' })]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(0);
  });

  it('deduplicates events with the same URL', () => {
    const card = makeCard({ slug: 'dup', title: 'Dup Show', dateStr: 'Mon 22 Sep 2099, 20:00' });
    const html = makeHtml([card, card]);
    expect(fetcher._parseEvents(html, NOW, END)).toHaveLength(1);
  });

  it('parses multiple events in the same HTML', () => {
    const html = makeHtml([
      makeCard({ slug: 'show-1', title: 'Show One', dateStr: 'Sun 21 Sep 2099, 19:00' }),
      makeCard({ slug: 'show-2', title: 'Show Two', dateStr: 'Mon 22 Sep 2099, 20:00' }),
      makeCard({ slug: 'show-3', title: 'Show Three', dateStr: 'Tue 23 Sep 2099, 19:30' })
    ]);
    const events = fetcher._parseEvents(html, NOW, END);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.name)).toEqual(['Show One', 'Show Two', 'Show Three']);
  });

  it('returns empty array for HTML with no event cards', () => {
    expect(fetcher._parseEvents('<p>Nothing here</p>', NOW, END)).toHaveLength(0);
  });
});

// ── fetchEvents ────────────────────────────────────────────────

describe('BristolBeaconFetcher.fetchEvents', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('returns parsed events on a successful fetch', async () => {
    const html = makeHtml([makeCard({ slug: 'live-show', title: 'Live Show', dateStr: 'Mon 22 Sep 2099, 19:00' })]);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: html });
    const result = await new BristolBeaconFetcher().fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Live Show');
    expect(result[0].source).toBe('bristolbeacon');
  });

  it('returns empty array on network failure', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await new BristolBeaconFetcher().fetchEvents(NOW)).toEqual([]);
  });

  it('returns empty array when the page has no matching events', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: '<html><body>Nothing</body></html>' });
    expect(await new BristolBeaconFetcher().fetchEvents(NOW)).toEqual([]);
  });
});
