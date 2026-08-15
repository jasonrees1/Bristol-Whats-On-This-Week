const { AshtonGateFetcher, normalizeMonth } = require('../../src/fetchers/ashtonGateFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9am UTC
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

// ── normalizeMonth ─────────────────────────────────────────────
describe('normalizeMonth', () => {
  it('returns 9 for Oct',     () => expect(normalizeMonth('Oct')).toBe(9));
  it('returns 9 for October', () => expect(normalizeMonth('October')).toBe(9));
  it('returns 0 for January', () => expect(normalizeMonth('January')).toBe(0));
  it('returns undefined for nonsense', () => expect(normalizeMonth('Xyz')).toBeUndefined());
});

// ── _parseSlugs ────────────────────────────────────────────────
describe('AshtonGateFetcher._parseSlugs', () => {
  let fetcher;
  beforeEach(() => { fetcher = new AshtonGateFetcher(); });

  it('extracts slugs from tribe event links', () => {
    const html = `
      <a href="https://www.ashtongatestadium.co.uk/event/bristol-city-vs-millwall/">Bristol City</a>
      <a href="https://www.ashtongatestadium.co.uk/events/coldplay-concert/">Coldplay</a>
    `;
    const slugs = fetcher._parseSlugs(html);
    expect(slugs.map(s => s.slug)).toContain('bristol-city-vs-millwall');
    expect(slugs.map(s => s.slug)).toContain('coldplay-concert');
  });

  it('deduplicates slugs', () => {
    const html = `
      <a href="https://www.ashtongatestadium.co.uk/event/my-show/">link1</a>
      <a href="https://www.ashtongatestadium.co.uk/event/my-show/">link2</a>
    `;
    expect(fetcher._parseSlugs(html)).toHaveLength(1);
  });

  it('returns empty array for HTML with no event links', () => {
    expect(fetcher._parseSlugs('<p>Nothing here</p>')).toHaveLength(0);
  });
});

// ── _parseEventPage ────────────────────────────────────────────
describe('AshtonGateFetcher._parseEventPage', () => {
  let fetcher;
  beforeEach(() => { fetcher = new AshtonGateFetcher(); });

  const slug = 'bristol-city-vs-millwall';
  const url  = 'https://www.ashtongatestadium.co.uk/event/bristol-city-vs-millwall/';

  function makeHtmlJsonLd(startDate, title = 'Bristol City vs Millwall') {
    return `
      <html>
      <head>
        <title>${title}</title>
        <meta name="description" content="Championship football at Ashton Gate.">
        <script type="application/ld+json">
          {"@type":"Event","name":"${title}","startDate":"${startDate}","location":{"name":"Ashton Gate Stadium"}}
        </script>
      </head>
      <body><h1>${title}</h1></body>
      </html>
    `;
  }

  function makeHtmlText(dateStr, timeStr, title = 'Bristol City vs Millwall') {
    return `
      <html>
      <head><meta name="description" content="Championship football."></head>
      <body>
        <h1>${title}</h1>
        <p>${dateStr}</p>
        <p>Kick-off: ${timeStr}</p>
      </body>
      </html>
    `;
  }

  it('parses an event via JSON-LD structured data', () => {
    const html = makeHtmlJsonLd('2099-10-08T15:00:00');
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.name).toBe('Bristol City vs Millwall');
    expect(e.source).toBe('ashtongate');
    expect(e.venue).toBe('Ashton Gate Stadium');
    const d = new Date(e.date);
    expect(d.getDate()).toBe(8);
    expect(d.getMonth()).toBe(9); // October
  });

  it('filters JSON-LD events outside the 7-day window', () => {
    const html = makeHtmlJsonLd('2099-10-20T15:00:00'); // beyond END
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('parses an event via HTML text date patterns as fallback', () => {
    const html = makeHtmlText('Saturday 8 October 2099', '15:00');
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    expect(new Date(events[0].date).getHours()).toBe(15);
  });

  it('returns empty array when no h1 title found', () => {
    const html = '<p>Saturday 8 October 2099</p><p>15:00</p>';
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('returns empty array when event is outside the window', () => {
    const html = makeHtmlText('Saturday 1 November 2099', '15:00');
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });
});

// ── Integration: fetchEvents ───────────────────────────────────
describe('AshtonGateFetcher.fetchEvents', () => {
  let fetcher;

  afterEach(() => { jest.restoreAllMocks(); });

  function makeListingHtml(slugs) {
    return slugs.map(s =>
      `<a href="https://www.ashtongatestadium.co.uk/event/${s}/">Event</a>`
    ).join('\n');
  }

  function makeEventHtml(title, startDate) {
    return `<html><head><meta name="description" content="Great event.">
      <script type="application/ld+json">{"@type":"Event","name":"${title}","startDate":"${startDate}"}</script>
    </head><body><h1>${title}</h1></body></html>`;
  }

  it('returns events for this week', async () => {
    fetcher = new AshtonGateFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml(['bristol-city-vs-millwall']) })
      .mockResolvedValueOnce({ data: makeEventHtml('Bristol City vs Millwall', '2099-10-08T15:00:00') });

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bristol City vs Millwall');
    expect(result[0].source).toBe('ashtongate');
    expect(result[0].venue).toBe('Ashton Gate Stadium');
  });

  it('excludes events outside the week window', async () => {
    fetcher = new AshtonGateFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml(['future-event']) })
      .mockResolvedValueOnce({ data: makeEventHtml('Future Show', '2099-11-01T19:30:00') });

    expect(await fetcher.fetchEvents(NOW)).toHaveLength(0);
  });

  it('returns empty array when listing page fetch fails', async () => {
    fetcher = new AshtonGateFetcher();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('skips individual event page fetch failures gracefully', async () => {
    fetcher = new AshtonGateFetcher();
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makeListingHtml(['event-a', 'event-b']) })
      .mockResolvedValueOnce({ data: makeEventHtml('Event A', '2099-10-08T15:00:00') })
      .mockRejectedValueOnce(new Error('Event B page failed'));

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Event A');
  });
});
