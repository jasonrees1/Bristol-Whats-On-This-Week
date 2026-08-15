const { HippodromeFetcher, normalizeMonth } = require('../../src/fetchers/hippodromeFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9am UTC
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

// ── normalizeMonth ─────────────────────────────────────────────
describe('normalizeMonth', () => {
  it('returns 9 for Oct', () => expect(normalizeMonth('Oct')).toBe(9));
  it('returns 9 for October', () => expect(normalizeMonth('October')).toBe(9));
  it('returns 0 for January', () => expect(normalizeMonth('January')).toBe(0));
  it('returns undefined for nonsense', () => expect(normalizeMonth('Xyz')).toBeUndefined());
});

// ── _parseDateRange ───────────────────────────────────────────
describe('HippodromeFetcher._parseDateRange', () => {
  let fetcher;
  beforeEach(() => { fetcher = new HippodromeFetcher(); });

  it('parses a single date', () => {
    const r = fetcher._parseDateRange('Sat 11 Oct 2099');
    expect(r.start.getFullYear()).toBe(2099);
    expect(r.start.getMonth()).toBe(9);
    expect(r.start.getDate()).toBe(11);
    expect(r.end.getDate()).toBe(11);
  });

  it('parses a date range within the same month', () => {
    const r = fetcher._parseDateRange('Tue 6 Oct - Sat 11 Oct 2099');
    expect(r.start.getDate()).toBe(6);
    expect(r.end.getDate()).toBe(11);
    expect(r.end.getMonth()).toBe(9);
    expect(r.end.getFullYear()).toBe(2099);
  });

  it('parses a date range spanning two months', () => {
    const r = fetcher._parseDateRange('Fri 26 Sep - Sun 4 Oct 2099');
    expect(r.start.getMonth()).toBe(8); // September
    expect(r.end.getMonth()).toBe(9);   // October
  });

  it('parses a date range spanning two years', () => {
    const r = fetcher._parseDateRange('Fri 4 Dec 2099 - Sun 3 Jan 2100');
    expect(r.start.getFullYear()).toBe(2099);
    expect(r.end.getFullYear()).toBe(2100);
  });

  it('returns null for unrecognised format', () => {
    expect(fetcher._parseDateRange('Coming soon')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(fetcher._parseDateRange('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(fetcher._parseDateRange(null)).toBeNull();
  });
});

// ── _parseShowCards ───────────────────────────────────────────
describe('HippodromeFetcher._parseShowCards', () => {
  let fetcher;
  beforeEach(() => { fetcher = new HippodromeFetcher(); });

  function makeListingHtml(shows) {
    return shows.map(({ slug, title, dateStr }) => `
      <div class="show-card">
        <a href="/shows/${slug}/bristol-hippodrome/"><img src="https://res.cloudinary.com/atg/image/${slug}.jpg"></a>
        <h3>${title}</h3>
        <p>Musicals</p>
        <p>Bristol Hippodrome</p>
        <p>${dateStr}</p>
        <a href="/shows/${slug}/bristol-hippodrome/calendar/">Buy tickets</a>
        <a href="/shows/${slug}/bristol-hippodrome/">More info</a>
      </div>
    `).join('\n');
  }

  it('extracts a single show card', () => {
    const html = makeListingHtml([
      { slug: 'back-to-the-future', title: 'Back to the Future', dateStr: 'Tue 6 Oct - Sat 11 Oct 2099' }
    ]);
    const shows = fetcher._parseShowCards(html);
    expect(shows).toHaveLength(1);
    expect(shows[0].title).toBe('Back to the Future');
    expect(shows[0].slug).toBe('back-to-the-future');
    expect(shows[0].url).toBe('https://www.atgtickets.com/shows/back-to-the-future/bristol-hippodrome/');
    expect(shows[0].dateStr).toMatch(/6 Oct/);
  });

  it('extracts multiple show cards', () => {
    const html = makeListingHtml([
      { slug: 'show-a', title: 'Show A', dateStr: 'Sat 4 Oct 2099' },
      { slug: 'show-b', title: 'Show B', dateStr: 'Mon 13 Oct - Sat 18 Oct 2099' }
    ]);
    expect(fetcher._parseShowCards(html)).toHaveLength(2);
  });

  it('deduplicates shows that appear more than once', () => {
    const show = { slug: 'my-show', title: 'My Show', dateStr: 'Sat 4 Oct 2099' };
    const html = makeListingHtml([show, show]);
    expect(fetcher._parseShowCards(html)).toHaveLength(1);
  });

  it('extracts the image URL', () => {
    const html = makeListingHtml([
      { slug: 'my-show', title: 'My Show', dateStr: 'Sat 4 Oct 2099' }
    ]);
    expect(fetcher._parseShowCards(html)[0].image).toContain('cloudinary');
  });

  it('returns empty array for HTML with no show cards', () => {
    expect(fetcher._parseShowCards('<p>Nothing here</p>')).toHaveLength(0);
  });
});

// ── _extractPrimaryTime ───────────────────────────────────────
describe('HippodromeFetcher._extractPrimaryTime', () => {
  let fetcher;
  beforeEach(() => { fetcher = new HippodromeFetcher(); });

  it('extracts a 19:30 evening time', () => {
    const html = '<p>Mon-Sat: 19:30</p><p>Wed, Thu, Sat, Sun: 14:30 (matinee)</p>';
    const t = fetcher._extractPrimaryTime(html);
    expect(t).toEqual({ hour: 19, minute: 30 });
  });

  it('extracts a 20:00 evening time', () => {
    const html = '<p>Evening performances: 20:00</p>';
    expect(fetcher._extractPrimaryTime(html)).toEqual({ hour: 20, minute: 0 });
  });

  it('returns null when no evening time is found', () => {
    const html = '<p>Matinees: 14:30</p>';
    expect(fetcher._extractPrimaryTime(html)).toBeNull();
  });

  it('returns null for page with no times at all', () => {
    expect(fetcher._extractPrimaryTime('<p>No times listed here</p>')).toBeNull();
  });
});

// ── Integration: fetchEvents filters by week ──────────────────
describe('HippodromeFetcher.fetchEvents', () => {
  let fetcher;

  afterEach(() => { jest.restoreAllMocks(); });

  function makeListingHtml(shows) {
    return shows.map(({ slug, title, dateStr }) => `
      <div>
        <a href="/shows/${slug}/bristol-hippodrome/"><img src="https://res.cloudinary.com/img/${slug}.jpg"></a>
        <h3>${title}</h3>
        <p>${dateStr}</p>
        <a href="/shows/${slug}/bristol-hippodrome/calendar/">Buy tickets</a>
        <a href="/shows/${slug}/bristol-hippodrome/">More info</a>
      </div>
    `).join('\n');
  }

  function makeShowPageHtml(description = 'An incredible show.') {
    return `
      <html>
      <head><meta name="description" content="${description}"></head>
      <body>
        <h1>The Show</h1>
        <p>Mon-Sat: 19:30</p>
        <p>Wed, Thu, Sat, Sun: 14:30 (matinee)</p>
      </body>
      </html>
    `;
  }

  it('returns events for shows running this week', async () => {
    fetcher = new HippodromeFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml([
        { slug: 'my-show', title: 'My Show', dateStr: 'Mon 6 Oct - Fri 10 Oct 2099' }
      ])})
      .mockResolvedValueOnce({ data: makeShowPageHtml('A great show.') });

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Show');
    expect(result[0].venue).toBe('Bristol Hippodrome');
    expect(result[0].source).toBe('hippodrome');
    expect(new Date(result[0].date).getHours()).toBe(19);
    expect(new Date(result[0].date).getMinutes()).toBe(30);
  });

  it('excludes shows whose run does not overlap this week', async () => {
    fetcher = new HippodromeFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml([
        { slug: 'future-show', title: 'Future Show', dateStr: 'Mon 20 Oct - Sat 25 Oct 2099' }
      ])});

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when listing page fetch fails', async () => {
    fetcher = new HippodromeFetcher();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('still returns event when show page fetch fails (uses defaults)', async () => {
    fetcher = new HippodromeFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml([
        { slug: 'my-show', title: 'My Show', dateStr: 'Sat 4 Oct 2099' }
      ])})
      .mockRejectedValueOnce(new Error('Show page failed'));

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('');
    expect(new Date(result[0].date).getHours()).toBe(19); // default
  });
});
