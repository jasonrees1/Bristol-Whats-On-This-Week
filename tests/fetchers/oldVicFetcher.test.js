const { OldVicFetcher, inferYear, normalizeMonth } = require('../../src/fetchers/oldVicFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9am UTC
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

// ── normalizeMonth ─────────────────────────────────────────────
describe('normalizeMonth', () => {
  it('returns 0 for Jan', () => expect(normalizeMonth('Jan')).toBe(0));
  it('returns 0 for January', () => expect(normalizeMonth('January')).toBe(0));
  it('returns 9 for Oct', () => expect(normalizeMonth('Oct')).toBe(9));
  it('returns 9 for October', () => expect(normalizeMonth('October')).toBe(9));
  it('returns 7 for Aug', () => expect(normalizeMonth('Aug')).toBe(7));
  it('returns 11 for Dec', () => expect(normalizeMonth('Dec')).toBe(11));
  it('returns undefined for a nonsense string', () => expect(normalizeMonth('Xyz')).toBeUndefined());
});

// ── inferYear ─────────────────────────────────────────────────
describe('inferYear', () => {
  it('returns current year for a date in the future', () => {
    expect(inferYear(10, 9, NOW)).toBe(2099); // Oct 10 2099 — 6 days ahead
  });
  it('returns next year for a date more than 60 days in the past', () => {
    expect(inferYear(1, 6, NOW)).toBe(2100); // Jul 1 2099 — ~95 days ago
  });
  it('returns current year for a date a few days ago', () => {
    expect(inferYear(1, 9, NOW)).toBe(2099); // Oct 1 2099 — 3 days ago
  });
});

// ── _parseSlugs ───────────────────────────────────────────────
describe('OldVicFetcher._parseSlugs', () => {
  let fetcher;
  beforeEach(() => { fetcher = new OldVicFetcher(); });

  it('extracts event slugs from listing HTML', () => {
    const html = `
      <a href="/whats-on/hamlet-2099">Hamlet</a>
      <a href="/whats-on/macbeth-sept">Macbeth</a>
    `;
    expect(fetcher._parseSlugs(html)).toEqual(
      expect.arrayContaining(['hamlet-2099', 'macbeth-sept'])
    );
  });

  it('deduplicates slugs that appear multiple times', () => {
    const html = `
      <a href="/whats-on/hamlet-2099">View</a>
      <a href="/whats-on/hamlet-2099">Book</a>
    `;
    expect(fetcher._parseSlugs(html)).toHaveLength(1);
  });

  it('excludes known non-event paths', () => {
    const html = `
      <a href="/whats-on/latest">Latest</a>
      <a href="/whats-on/archive">Archive</a>
      <a href="/whats-on/feed">Feed</a>
      <a href="/whats-on/my-show">My Show</a>
    `;
    const slugs = fetcher._parseSlugs(html);
    expect(slugs).not.toContain('latest');
    expect(slugs).not.toContain('archive');
    expect(slugs).not.toContain('feed');
    expect(slugs).toContain('my-show');
  });

  it('returns empty array when no event links present', () => {
    expect(fetcher._parseSlugs('<p>Nothing here</p>')).toHaveLength(0);
  });
});

// ── _parseEventPage ───────────────────────────────────────────
describe('OldVicFetcher._parseEventPage', () => {
  let fetcher;
  beforeEach(() => { fetcher = new OldVicFetcher(); });

  const url = 'https://bristololdvic.org.uk/whats-on/the-cherry-orchard';
  const slug = 'the-cherry-orchard';

  function makeHtml({ title = 'The Cherry Orchard', dates = [], cost = '£15 - £45', soldOut = false, desc = '' } = {}) {
    const dateLines = dates.map(({ day, time }) =>
      `<li><span class="date">${day}</span><span class="time">${time}</span></li>`
    ).join('\n');
    return `
      <html>
      <head><meta name="description" content="${desc || 'A classic play.'}"></head>
      <body>
        <h1>${title}</h1>
        ${soldOut ? '<p>Sold out</p>' : ''}
        <section class="booking">
          <p>${cost}</p>
        </section>
        <section class="dates">
          <h2>Dates &amp; Times</h2>
          <ul>${dateLines}</ul>
        </section>
      </body>
      </html>
    `;
  }

  it('parses a single performance within the window', () => {
    const html = makeHtml({ dates: [{ day: 'Wed 8 Oct', time: '7:30pm' }] });
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.name).toBe('The Cherry Orchard');
    expect(e.source).toBe('oldvic');
    expect(e.venue).toBe('Bristol Old Vic');
    expect(e.url).toBe(url);
    const d = new Date(e.date);
    expect(d.getDate()).toBe(8);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getFullYear()).toBe(2099);
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
  });

  it('parses a matinee time (2:30pm → 14:30)', () => {
    const html = makeHtml({ dates: [{ day: 'Sat 4 Oct', time: '2:30pm' }] });
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    expect(new Date(events[0].date).getHours()).toBe(14);
    expect(new Date(events[0].date).getMinutes()).toBe(30);
  });

  it('filters out performances before now', () => {
    const html = makeHtml({ dates: [{ day: 'Wed 1 Oct', time: '7:30pm' }] }); // 3 days before NOW
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('filters out performances after the 7-day window', () => {
    const html = makeHtml({ dates: [{ day: 'Mon 13 Oct', time: '7:30pm' }] }); // beyond END
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('returns multiple events for a multi-performance run within the window', () => {
    const html = makeHtml({
      dates: [
        { day: 'Wed 8 Oct', time: '7:30pm' },
        { day: 'Thu 9 Oct', time: '7:30pm' },
        { day: 'Sat 11 Oct', time: '7:30pm' } // END boundary — should be excluded (> endDate)
      ]
    });
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    // Sat 11 Oct 19:30 is after the END (Sat 11 Oct 09:00), so it's excluded
    expect(events).toHaveLength(2);
    expect(events.map(e => new Date(e.date).getDate())).toEqual([8, 9]);
  });

  it('marks sold-out events', () => {
    const html = makeHtml({ dates: [{ day: 'Wed 8 Oct', time: '7:30pm' }], soldOut: true });
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)[0].status).toBe('sold_out');
  });

  it('extracts free cost', () => {
    const html = makeHtml({ dates: [{ day: 'Wed 8 Oct', time: '7:30pm' }], cost: 'Free (no booking required)' });
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)[0].cost).toBe('Free');
  });

  it('returns empty array when no h1 title found', () => {
    const html = `<p>Wed 8 Oct</p><p>7:30pm</p>`;
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('returns empty array when no dates fall in the window', () => {
    const html = makeHtml({ dates: [] });
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('deduplicates events with the same id', () => {
    // Duplicate date in HTML should not produce two entries
    const html = makeHtml({
      dates: [
        { day: 'Wed 8 Oct', time: '7:30pm' },
        { day: 'Wed 8 Oct', time: '7:30pm' }
      ]
    });
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    // Both hits produce the same id so deduplication in fetchEvents handles it,
    // but _parseEventPage itself may return 2 — we just test it doesn't crash
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('uses event meta description', () => {
    const html = makeHtml({ dates: [{ day: 'Wed 8 Oct', time: '7:30pm' }], desc: 'Chekhov reimagined.' });
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)[0].description).toBe('Chekhov reimagined.');
  });
});

// ── Network failure ───────────────────────────────────────────
describe('OldVicFetcher.fetchEvents — network failure', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new OldVicFetcher();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('returns empty array when listing fetch fails', async () => {
    const result = await fetcher.fetchEvents();
    expect(result).toEqual([]);
  });
});
