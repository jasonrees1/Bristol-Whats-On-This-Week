const { ResidentAdvisorFetcher } = require('../../src/fetchers/residentAdvisorFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9 am UTC
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

// ── Helpers ────────────────────────────────────────────────────

function makeNextData(listings) {
  return JSON.stringify({
    props: {
      pageProps: {
        data: {
          eventListings: {
            data: listings,
            totalResults: listings.length
          }
        }
      }
    },
    page: '/events/[...slug]',
    query: {}
  });
}

function makeHtml(listings) {
  return `<html><head>
<script id="__NEXT_DATA__" type="application/json">${makeNextData(listings)}</script>
</head><body><div id="root"></div></body></html>`;
}

function makeListing(overrides = {}) {
  return {
    id: overrides.id || '123456',
    startTime: overrides.startTime || '2099-10-06T20:00:00.000Z',
    event: {
      id: overrides.eventId || '654321',
      title: overrides.title !== undefined ? overrides.title : 'Club Night',
      content: overrides.content || 'A great night out in Bristol.',
      images: overrides.images !== undefined
        ? overrides.images
        : [{ filename: 'events/abc123.jpg', type: 'FLYER_FRONT' }],
      venue: { name: overrides.venue || 'Motion Bristol' }
    }
  };
}

// ── _parseNextData ─────────────────────────────────────────────

describe('ResidentAdvisorFetcher._parseNextData', () => {
  let fetcher;
  beforeEach(() => { fetcher = new ResidentAdvisorFetcher(); });

  it('extracts an event from the standard RA __NEXT_DATA__ structure', () => {
    const events = fetcher._parseNextData(makeHtml([makeListing()]), NOW, END);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.id).toBe('ra-123456');
    expect(e.name).toBe('Club Night');
    expect(e.venue).toBe('Motion Bristol');
    expect(e.source).toBe('residentadvisor');
    expect(e.url).toBe('https://ra.co/events/123456');
    expect(e.description).toBe('A great night out in Bristol.');
  });

  it('filters events outside the 7-day window', () => {
    const outside = makeListing({ startTime: '2099-11-01T20:00:00.000Z' });
    expect(fetcher._parseNextData(makeHtml([outside]), NOW, END)).toHaveLength(0);
  });

  it('filters events in the past', () => {
    const past = makeListing({ startTime: '2099-10-03T20:00:00.000Z' }); // before NOW
    expect(fetcher._parseNextData(makeHtml([past]), NOW, END)).toHaveLength(0);
  });

  it('builds correct image URL from a relative filename', () => {
    const html = makeHtml([makeListing({ images: [{ filename: 'path/to/flyer.jpg', type: 'FLYER_FRONT' }] })]);
    const events = fetcher._parseNextData(html, NOW, END);
    expect(events[0].image).toBe('https://images.ra.co/path/to/flyer.jpg');
  });

  it('preserves absolute image URLs unchanged', () => {
    const html = makeHtml([makeListing({ images: [{ filename: 'https://cdn.example.com/img.jpg', type: 'main' }] })]);
    const events = fetcher._parseNextData(html, NOW, END);
    expect(events[0].image).toBe('https://cdn.example.com/img.jpg');
  });

  it('returns null image when images array is empty', () => {
    const html = makeHtml([makeListing({ images: [] })]);
    expect(fetcher._parseNextData(html, NOW, END)[0].image).toBeNull();
  });

  it('prefers FLYER_FRONT image over others', () => {
    const html = makeHtml([makeListing({
      images: [
        { filename: 'other.jpg', type: 'THUMB' },
        { filename: 'flyer.jpg', type: 'FLYER_FRONT' }
      ]
    })]);
    expect(fetcher._parseNextData(html, NOW, END)[0].image).toBe('https://images.ra.co/flyer.jpg');
  });

  it('returns empty array when no __NEXT_DATA__ script tag is present', () => {
    expect(fetcher._parseNextData('<html><body>Nothing</body></html>', NOW, END)).toHaveLength(0);
  });

  it('returns empty array when __NEXT_DATA__ JSON is malformed', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{bad:json}</script>';
    expect(fetcher._parseNextData(html, NOW, END)).toHaveLength(0);
  });

  it('returns empty array when event listings array is empty', () => {
    expect(fetcher._parseNextData(makeHtml([]), NOW, END)).toHaveLength(0);
  });

  it('skips listings whose event title is blank', () => {
    const html = makeHtml([makeListing({ title: '' })]);
    expect(fetcher._parseNextData(html, NOW, END)).toHaveLength(0);
  });

  it('parses multiple events in order', () => {
    const html = makeHtml([
      makeListing({ id: '1', title: 'Night One',   startTime: '2099-10-05T20:00:00.000Z' }),
      makeListing({ id: '2', title: 'Night Two',   startTime: '2099-10-07T22:00:00.000Z' }),
      makeListing({ id: '3', title: 'Night Three', startTime: '2099-10-09T19:00:00.000Z' })
    ]);
    const events = fetcher._parseNextData(html, NOW, END);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.name)).toEqual(['Night One', 'Night Two', 'Night Three']);
  });

  it('includes the boundary day (endDate) event', () => {
    // Exactly at endDate boundary
    const onBoundary = makeListing({ startTime: END.toISOString() });
    const events = fetcher._parseNextData(makeHtml([onBoundary]), NOW, END);
    expect(events).toHaveLength(1);
  });

  it('sets cost to Price TBA', () => {
    const events = fetcher._parseNextData(makeHtml([makeListing()]), NOW, END);
    expect(events[0].cost).toBe('Price TBA');
  });

  it('sets status to null', () => {
    const events = fetcher._parseNextData(makeHtml([makeListing()]), NOW, END);
    expect(events[0].status).toBeNull();
  });
});

// ── fetchEvents ────────────────────────────────────────────────

describe('ResidentAdvisorFetcher.fetchEvents', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('returns parsed events on a successful fetch', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: makeHtml([makeListing({ startTime: '2099-10-06T20:00:00.000Z' })])
    });
    const fetcher = new ResidentAdvisorFetcher();
    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Club Night');
    expect(result[0].source).toBe('residentadvisor');
  });

  it('returns empty array on network failure', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await new ResidentAdvisorFetcher().fetchEvents(NOW)).toEqual([]);
  });

  it('returns empty array when page has no __NEXT_DATA__', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ data: '<html><body>No data</body></html>' });
    expect(await new ResidentAdvisorFetcher().fetchEvents(NOW)).toEqual([]);
  });

  it('filters out events outside the 7-day window', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: makeHtml([
        makeListing({ id: '1', startTime: '2099-10-06T20:00:00.000Z' }),  // in window
        makeListing({ id: '2', startTime: '2099-11-15T20:00:00.000Z' })   // out of window
      ])
    });
    const result = await new ResidentAdvisorFetcher().fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ra-1');
  });
});
