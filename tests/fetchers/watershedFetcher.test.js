const { WatershedFetcher, inferYear } = require('../../src/fetchers/watershedFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9am

describe('inferYear', () => {
  it('returns current year for a date later this month', () => {
    const now = new Date('2099-10-04T09:00:00Z');
    expect(inferYear(10, 9, now)).toBe(2099); // Oct 10 2099 — in the future
  });

  it('returns next year for a date more than 60 days in the past', () => {
    const now = new Date('2099-10-04T09:00:00Z');
    expect(inferYear(1, 6, now)).toBe(2100); // Jul 1 2099 — 95 days ago
  });

  it('returns current year for a date a few days ago', () => {
    const now = new Date('2099-10-04T09:00:00Z');
    expect(inferYear(1, 9, now)).toBe(2099); // Oct 1 2099 — 3 days ago
  });
});

describe('WatershedFetcher._parseListingUrls', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WatershedFetcher(); });

  it('extracts event URLs from listing HTML', () => {
    const html = `
      <a href="/whatson/14226/life-support">Life Support</a>
      <a href="/whatson/14181/ish">Ish</a>
    `;
    const urls = fetcher._parseListingUrls(html);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe('https://www.watershed.co.uk/whatson/14226/life-support');
    expect(urls[1]).toBe('https://www.watershed.co.uk/whatson/14181/ish');
  });

  it('deduplicates URLs that appear multiple times', () => {
    const html = `
      <a href="/whatson/14226/life-support">View</a>
      <a href="/whatson/14226/life-support">Book</a>
    `;
    expect(fetcher._parseListingUrls(html)).toHaveLength(1);
  });

  it('does not match URLs without a numeric ID', () => {
    const html = `<a href="/whatson/about">About</a><a href="/whatson/14111/david-byrne">Event</a>`;
    const urls = fetcher._parseListingUrls(html);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('david-byrne');
  });

  it('returns empty array when no event links present', () => {
    expect(fetcher._parseListingUrls('<p>Nothing here</p>')).toHaveLength(0);
  });
});

describe('WatershedFetcher._parseScreenings', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WatershedFetcher(); });

  const eventUrl = 'https://www.watershed.co.uk/whatson/14226/life-support';
  const endDate = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

  function makeHtml(screenings) {
    const rows = screenings.map(s => `<p>${s}</p>`).join('\n');
    return `<h1>Life Support</h1>${rows}`;
  }

  it('parses a single screening', () => {
    const html = makeHtml(['Tue 7 Oct: 20:20 (ends 22:05)']);
    const events = fetcher._parseScreenings(html, eventUrl, NOW, endDate);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.name).toBe('Life Support');
    expect(e.venue).toBe('Watershed');
    expect(e.source).toBe('watershed');
    const d = new Date(e.date);
    expect(d.getDate()).toBe(7);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(20);
  });

  it('parses multiple screenings on different days', () => {
    const html = makeHtml([
      'Tue 7 Oct: 20:20 (ends 22:05)',
      'Wed 8 Oct: 18:30 (ends 20:15)',
      'Thu 9 Oct: 20:20 (ends 22:05)'
    ]);
    const events = fetcher._parseScreenings(html, eventUrl, NOW, endDate);
    expect(events).toHaveLength(3);
    expect(events.map(e => new Date(e.date).getDate())).toEqual([7, 8, 9]);
  });

  it('excludes screenings before now', () => {
    const html = makeHtml(['Fri 3 Oct: 14:00 (ends 15:45)']); // 3 Oct < NOW (4 Oct)
    expect(fetcher._parseScreenings(html, eventUrl, NOW, endDate)).toHaveLength(0);
  });

  it('excludes screenings after the 7-day window', () => {
    const html = makeHtml(['Sat 15 Oct: 20:20 (ends 22:05)']); // beyond 7 days
    expect(fetcher._parseScreenings(html, eventUrl, NOW, endDate)).toHaveLength(0);
  });

  it('generates a unique ID per screening using event ID, date, and time', () => {
    const html = makeHtml(['Tue 7 Oct: 20:20 (ends 22:05)']);
    const events = fetcher._parseScreenings(html, eventUrl, NOW, endDate);
    expect(events[0].id).toBe('watershed-14226-20991007-2020');
  });

  it('returns empty array when HTML has no h1 title', () => {
    const html = '<p>Tue 7 Oct: 20:20 (ends 22:05)</p>';
    expect(fetcher._parseScreenings(html, eventUrl, NOW, endDate)).toHaveLength(0);
  });

  it('returns empty array for HTML with no screenings', () => {
    expect(fetcher._parseScreenings('<h1>Life Support</h1><p>No dates yet</p>', eventUrl, NOW, endDate)).toHaveLength(0);
  });

  it('decodes HTML entities in the title', () => {
    const html = `<h1>Bach &amp; Friends</h1><p>Tue 7 Oct: 19:30 (ends 21:00)</p>`;
    const events = fetcher._parseScreenings(html, eventUrl, NOW, endDate);
    expect(events[0].name).toBe('Bach & Friends');
  });
});

describe('WatershedFetcher.fetchEvents — error handling', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WatershedFetcher(); });
  afterEach(() => jest.restoreAllMocks());

  it('returns [] when listing page fetch fails', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('returns screenings from successful event pages even if some fail', async () => {
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({
        data: '<a href="/whatson/111/event-one">E1</a><a href="/whatson/222/event-two">E2</a>'
      }) // listing page
      .mockResolvedValueOnce({
        data: '<h1>Event One</h1><p>Mon 6 Oct: 19:30 (ends 21:00)</p>'
      }) // event 1 succeeds
      .mockRejectedValueOnce(new Error('404')); // event 2 fails

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Event One');
  });
});
