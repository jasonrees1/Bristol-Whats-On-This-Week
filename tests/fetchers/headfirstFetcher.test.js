const { HeadfirstFetcher, getDayUrl, ordinal } = require('../../src/fetchers/headfirstFetcher');
const axios = require('axios');

describe('ordinal', () => {
  it('returns 1st for 1', () => expect(ordinal(1)).toBe('1st'));
  it('returns 2nd for 2', () => expect(ordinal(2)).toBe('2nd'));
  it('returns 3rd for 3', () => expect(ordinal(3)).toBe('3rd'));
  it('returns 4th for 4', () => expect(ordinal(4)).toBe('4th'));
  it('returns 11th for 11 (teens override)', () => expect(ordinal(11)).toBe('11th'));
  it('returns 12th for 12 (teens override)', () => expect(ordinal(12)).toBe('12th'));
  it('returns 13th for 13 (teens override)', () => expect(ordinal(13)).toBe('13th'));
  it('returns 21st for 21', () => expect(ordinal(21)).toBe('21st'));
  it('returns 22nd for 22', () => expect(ordinal(22)).toBe('22nd'));
  it('returns 23rd for 23', () => expect(ordinal(23)).toBe('23rd'));
  it('returns 31st for 31', () => expect(ordinal(31)).toBe('31st'));
});

describe('getDayUrl', () => {
  it('generates correct URL for a known date', () => {
    const date = new Date('2099-08-05T12:00:00Z'); // Tuesday 5th August 2099
    const url = getDayUrl(date);
    expect(url).toBe('https://www.headfirstbristol.co.uk/whats-on/tuesday-5th-august-2099');
  });

  it('generates correct URL for a Saturday with ordinal suffix', () => {
    const date = new Date('2099-08-01T12:00:00Z'); // Saturday 1st August 2099
    const url = getDayUrl(date);
    expect(url).toBe('https://www.headfirstbristol.co.uk/whats-on/saturday-1st-august-2099');
  });

  it('generates correct URL for 12th (teen override)', () => {
    const date = new Date('2099-08-12T12:00:00Z'); // Wednesday 12th August 2099
    const url = getDayUrl(date);
    expect(url).toBe('https://www.headfirstbristol.co.uk/whats-on/wednesday-12th-august-2099');
  });
});

describe('HeadfirstFetcher._parseDayEvents', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new HeadfirstFetcher();
  });

  const date = new Date('2099-10-15T12:00:00Z');

  const buildLink = ({ path, title, venueText = '' }) =>
    `<a href="${path}">${title}</a>${venueText}`;

  it('parses a basic event with venue from dash pattern', () => {
    const html = buildLink({
      path: '/whats-on/the-exchange/wed-15-oct-some-band-12345',
      title: 'Some Band',
      venueText: ' — The Exchange'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.id).toBe('headfirst-12345');
    expect(e.name).toBe('Some Band');
    expect(e.venue).toBe('The Exchange');
    expect(e.source).toBe('headfirst');
    expect(e.url).toBe('https://www.headfirstbristol.co.uk/whats-on/the-exchange/wed-15-oct-some-band-12345');
    expect(e.status).toBeNull();
  });

  it('falls back to title-cased venue slug when no dash pattern present', () => {
    const html = buildLink({
      path: '/whats-on/the-louisiana/fri-17-oct-jazz-night-99999',
      title: 'Jazz Night'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(1);
    expect(events[0].venue).toBe('The Louisiana');
  });

  it('marks cancelled events and strips the cancellation prefix', () => {
    const html = buildLink({
      path: '/whats-on/trinity/sat-18-oct-cancelled-gig-55555',
      title: '*GIG CANCELLED* The Big Show',
      venueText: ' — Trinity'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('The Big Show');
    expect(events[0].status).toBe('cancelled');
  });

  it('skips events where title is blank after stripping cancellation notice', () => {
    const html = buildLink({
      path: '/whats-on/somewhere/mon-13-oct-test-77777',
      title: '*GIG CANCELLED*'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(0);
  });

  it('skips events with very short titles', () => {
    const html = buildLink({
      path: '/whats-on/somewhere/mon-13-oct-ab-88888',
      title: 'AB'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(0);
  });

  it('deduplicates events with the same numeric ID', () => {
    const link = buildLink({
      path: '/whats-on/the-exchange/wed-15-oct-same-band-11111',
      title: 'Same Band',
      venueText: ' — The Exchange'
    });
    const html = link + link;

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(2); // _parseDayEvents itself does not deduplicate; fetchEvents does
  });

  it('sets event date to noon on the given date', () => {
    const html = buildLink({
      path: '/whats-on/the-fleece/tue-14-oct-gig-22222',
      title: 'Evening Gig'
    });

    const events = fetcher._parseDayEvents(html, date);
    const eventDate = new Date(events[0].date);
    expect(eventDate.getHours()).toBe(12);
    expect(eventDate.getMinutes()).toBe(0);
  });

  it('sets cost to Price TBA', () => {
    const html = buildLink({
      path: '/whats-on/strange-brew/thu-16-oct-night-33333',
      title: 'Night Out'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events[0].cost).toBe('Price TBA');
  });

  it('sets image to null', () => {
    const html = buildLink({
      path: '/whats-on/strange-brew/thu-16-oct-night-44444',
      title: 'Night Out'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events[0].image).toBeNull();
  });

  it('returns empty array for HTML with no matching links', () => {
    const html = '<p>No events today</p>';
    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(0);
  });

  it('parses multiple events from the same HTML', () => {
    const html = [
      buildLink({ path: '/whats-on/venue-a/wed-15-oct-band-one-10001', title: 'Band One', venueText: ' — Venue A' }),
      buildLink({ path: '/whats-on/venue-b/wed-15-oct-band-two-10002', title: 'Band Two', venueText: ' — Venue B' }),
      buildLink({ path: '/whats-on/venue-c/wed-15-oct-band-three-10003', title: 'Band Three', venueText: ' — Venue C' })
    ].join('\n');

    const events = fetcher._parseDayEvents(html, date);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.name)).toEqual(['Band One', 'Band Two', 'Band Three']);
  });

  it('decodes HTML entities in title', () => {
    const html = buildLink({
      path: '/whats-on/somewhere/fri-17-oct-test-66666',
      title: 'AC&amp;DC Tribute'
    });

    const events = fetcher._parseDayEvents(html, date);
    expect(events[0].name).toBe('AC&DC Tribute');
  });
});

describe('HeadfirstFetcher.fetchEvents — network failure handling', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new HeadfirstFetcher();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty array when all day fetches fail', async () => {
    const result = await fetcher.fetchEvents();
    expect(result).toEqual([]);
  });
});

describe('HeadfirstFetcher.fetchEvents — deduplication across days', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new HeadfirstFetcher();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deduplicates events with the same ID appearing on two days', async () => {
    const makeHtml = () =>
      `<a href="/whats-on/the-exchange/wed-15-oct-band-99999">Repeat Band</a> — The Exchange`;

    jest.spyOn(axios, 'get').mockResolvedValue({ data: makeHtml() });

    const result = await fetcher.fetchEvents();
    const exchangeEvents = result.filter(e => e.id === 'headfirst-99999');
    expect(exchangeEvents).toHaveLength(1);
  });
});
