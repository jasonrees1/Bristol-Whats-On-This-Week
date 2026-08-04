const { WethecuriousFetcher, parseMonthStr, parseAmPm, inferYear } = require('../../src/fetchers/wethecuriousFetcher');
const axios = require('axios');

const NOW = new Date('2099-10-04T09:00:00Z'); // Saturday 4 Oct 2099, 9am
const END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);

describe('parseMonthStr', () => {
  it('parses short abbreviations', () => {
    expect(parseMonthStr('Aug')).toBe(7);
    expect(parseMonthStr('Jan')).toBe(0);
    expect(parseMonthStr('Dec')).toBe(11);
  });
  it('parses "Sept" (4-char variant)', () => {
    expect(parseMonthStr('Sept')).toBe(8);
  });
  it('parses full month names', () => {
    expect(parseMonthStr('September')).toBe(8);
    expect(parseMonthStr('October')).toBe(9);
  });
  it('is case-insensitive', () => {
    expect(parseMonthStr('august')).toBe(7);
    expect(parseMonthStr('NOVEMBER')).toBe(10);
  });
  it('returns null for unrecognised strings', () => {
    expect(parseMonthStr('Octember')).toBeNull();
  });
});

describe('parseAmPm', () => {
  it('converts 6pm to 18:00', () => {
    expect(parseAmPm('6', null, 'pm')).toEqual({ hour: 18, minute: 0 });
  });
  it('converts 12pm (noon) to 12:00', () => {
    expect(parseAmPm('12', null, 'pm')).toEqual({ hour: 12, minute: 0 });
  });
  it('converts 12am (midnight) to 0:00', () => {
    expect(parseAmPm('12', null, 'am')).toEqual({ hour: 0, minute: 0 });
  });
  it('handles minutes', () => {
    expect(parseAmPm('7', '15', 'pm')).toEqual({ hour: 19, minute: 15 });
  });
  it('handles 10am', () => {
    expect(parseAmPm('10', null, 'am')).toEqual({ hour: 10, minute: 0 });
  });
});

describe('WethecuriousFetcher._parseListingSlugs', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WethecuriousFetcher(); });

  it('extracts event slugs from listing HTML', () => {
    const html = `
      <a href="/whats-on/events/summer-imagination">Summer</a>
      <a href="/whats-on/events/pink-floyds-dark-side-moon">Pink Floyd</a>
    `;
    const slugs = fetcher._parseListingSlugs(html);
    expect(slugs).toContain('summer-imagination');
    expect(slugs).toContain('pink-floyds-dark-side-moon');
  });

  it('deduplicates repeated slugs', () => {
    const html = `
      <a href="/whats-on/events/summer-imagination">View</a>
      <a href="/whats-on/events/summer-imagination">Book</a>
    `;
    expect(fetcher._parseListingSlugs(html)).toHaveLength(1);
  });

  it('ignores links with query strings (pagination links)', () => {
    const html = `
      <a href="/whats-on/events?page=1">Next</a>
      <a href="/whats-on/events/real-event">Event</a>
    `;
    const slugs = fetcher._parseListingSlugs(html);
    expect(slugs).toHaveLength(1);
    expect(slugs[0]).toBe('real-event');
  });

  it('returns empty array for HTML with no event links', () => {
    expect(fetcher._parseListingSlugs('<p>No events</p>')).toHaveLength(0);
  });
});

describe('WethecuriousFetcher._parseEventPage — specific performances', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WethecuriousFetcher(); });

  const slug = 'pink-floyds-dark-side-moon';
  const url = `https://www.wethecurious.org/whats-on/events/${slug}`;

  it('parses a specific performance with time', () => {
    const html = `<h1>Pink Floyd Dark Side</h1>
<p>Thursday 9th Oct: 6pm</p>`;
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.name).toBe('Pink Floyd Dark Side');
    expect(e.venue).toBe('We The Curious');
    expect(e.source).toBe('wethecurious');
    const d = new Date(e.date);
    expect(d.getDate()).toBe(9);
    expect(d.getMonth()).toBe(9); // October
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(0);
  });

  it('parses multiple times on the same day', () => {
    const html = `<h1>Pink Floyd Dark Side</h1>
<p>Thursday 9th Oct: 6pm, 7:15pm, 8:30pm</p>`;
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(3);
    const hours = events.map(e => new Date(e.date).getHours());
    expect(hours).toEqual([18, 19, 20]);
  });

  it('parses the Wed DD Mon - HHam format', () => {
    const html = `<h1>Aardman on the Big Screen</h1>
<p>Wed 8 Oct - 10am</p>`;
    const events = fetcher._parseEventPage(html, 'aardman-big-screen', url, NOW, END);
    expect(events).toHaveLength(1);
    const d = new Date(events[0].date);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(10);
  });

  it('excludes performances before now', () => {
    const html = `<h1>Event</h1><p>Friday 3rd Oct: 7pm</p>`; // 3 Oct < NOW (4 Oct)
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('excludes performances after the 7-day window', () => {
    const html = `<h1>Event</h1><p>Monday 20th Oct: 7pm</p>`;
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('generates unique IDs per performance', () => {
    const html = `<h1>Event</h1><p>Thursday 9th Oct: 6pm</p>`;
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events[0].id).toBe('wtc-pink-floyds-dark-side-moon-20991009-1800');
  });
});

describe('WethecuriousFetcher._parseEventPage — date range fallback', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WethecuriousFetcher(); });

  const slug = 'summer-imagination';
  const url = `https://www.wethecurious.org/whats-on/events/${slug}`;

  it('includes an ongoing exhibition when range end is after now', () => {
    const html = `<h1>Summer of Imagination</h1><p>1 – 28 Oct 2099</p>`;
    const events = fetcher._parseEventPage(html, slug, url, NOW, END);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(`wtc-${slug}`);
    expect(events[0].name).toBe('Summer of Imagination');
  });

  it('excludes an exhibition whose range ended before now', () => {
    const html = `<h1>Past Exhibition</h1><p>1 – 30 Sep 2099</p>`;
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('returns empty array when no dates are found at all', () => {
    const html = `<h1>Mystery Event</h1><p>Coming soon.</p>`;
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });

  it('returns empty array when h1 title is missing', () => {
    const html = `<p>1 – 28 Oct 2099</p>`;
    expect(fetcher._parseEventPage(html, slug, url, NOW, END)).toHaveLength(0);
  });
});

describe('WethecuriousFetcher.fetchEvents — error handling', () => {
  let fetcher;
  beforeEach(() => { fetcher = new WethecuriousFetcher(); });
  afterEach(() => jest.restoreAllMocks());

  it('returns [] when listing pages fail', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
    expect(await fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('returns events from successful pages when some event pages fail', async () => {
    jest.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: '<a href="/whats-on/events/good-event">Good</a><a href="/whats-on/events/bad-event">Bad</a>' }) // page 0
      .mockResolvedValueOnce({ data: '' }) // page 1
      .mockResolvedValueOnce({ data: '<h1>Good Event</h1><p>Tuesday 7th Oct: 6pm</p>' }) // good-event page
      .mockRejectedValueOnce(new Error('404')); // bad-event page fails

    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good Event');
  });
});
