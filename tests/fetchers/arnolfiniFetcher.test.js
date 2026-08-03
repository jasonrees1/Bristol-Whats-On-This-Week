const ArnolfiniFetcher = require('../../src/fetchers/arnolfiniFetcher');

// Fixed "now" — 2099-06-10 (far future so tests never expire)
const NOW = new Date('2099-06-10T12:00:00Z');

// Helper: build minimal HTML containing a /whatson/ link + date text
function makeHtml(slug, title, dateText) {
  return `<a href="/whatson/${slug}/">${title}</a><p>${dateText}</p>`;
}

describe('ArnolfiniFetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new ArnolfiniFetcher();
  });

  // ── _parseDateContext ──────────────────────────────────────────────────────

  describe('_parseDateContext', () => {
    it('parses a single-date event', () => {
      const { startDate, endDate } = fetcher._parseDateContext('10 June 2099');
      expect(startDate).not.toBeNull();
      expect(startDate.getFullYear()).toBe(2099);
      expect(startDate.getMonth()).toBe(5); // June = 5
      expect(startDate.getDate()).toBe(10);
      expect(endDate.getDate()).toBe(10);
    });

    it('parses a date range', () => {
      const { startDate, endDate } = fetcher._parseDateContext('01 June 2099 - 30 September 2099');
      expect(startDate.getMonth()).toBe(5);  // June
      expect(endDate.getMonth()).toBe(8);    // September
      expect(endDate.getFullYear()).toBe(2099);
    });

    it('parses a range where start has no year', () => {
      const { startDate, endDate } = fetcher._parseDateContext('01 June - 30 September 2099');
      expect(startDate.getFullYear()).toBe(2099); // inherits end year
      expect(endDate.getFullYear()).toBe(2099);
    });

    it('parses a From date as open-ended', () => {
      const { startDate, endDate } = fetcher._parseDateContext('From 22 July 2024');
      expect(startDate).not.toBeNull();
      expect(endDate.getTime()).toBe(new Date(8640000000000000).getTime());
    });

    it('returns null startDate when no date present', () => {
      const { startDate } = fetcher._parseDateContext('No date information here at all');
      expect(startDate).toBeNull();
    });
  });

  // ── _parseEvents filtering ────────────────────────────────────────────────

  describe('_parseEvents', () => {
    it('includes a single-date event on a day this week', () => {
      const html = makeHtml('test-event', 'Test Event', '12 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('Test Event');
    });

    it('excludes a single-date event outside this week', () => {
      const html = makeHtml('past-event', 'Past Event', '01 January 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(0);
    });

    it('includes an ongoing exhibition whose range spans this week', () => {
      const html = makeHtml('exhibition', 'Big Exhibition', '01 June 2099 - 30 September 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(1);
    });

    it('excludes an exhibition whose end date is before this week', () => {
      const html = makeHtml('old-show', 'Old Show', '01 January 2099 - 05 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(0);
    });

    it('excludes an exhibition that has not started yet this week', () => {
      const html = makeHtml('future-show', 'Future Show', '01 July 2099 - 30 September 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(0);
    });

    it('uses today as eventDate when an ongoing exhibition started before this week', () => {
      const html = makeHtml('ongoing', 'Ongoing Show', '01 January 2099 - 30 September 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(1);
      const eventDate = new Date(events[0].date);
      expect(eventDate.toISOString().split('T')[0]).toBe('2099-06-10');
    });

    it('deduplicates events with the same slug', () => {
      const html =
        makeHtml('slug', 'Event One', '12 June 2099') +
        makeHtml('slug', 'Event One Again', '12 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events).toHaveLength(1);
    });

    it('sets source to arnolfini', () => {
      const html = makeHtml('source-test', 'Source Test', '12 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events[0].source).toBe('arnolfini');
    });

    it('sets venue to Arnolfini, Bristol', () => {
      const html = makeHtml('venue-test', 'Venue Test', '12 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events[0].venue).toBe('Arnolfini, Bristol');
    });

    it('returns [] when no events in HTML', () => {
      const events = fetcher._parseEvents('<html><body>Nothing here</body></html>', NOW);
      expect(events).toEqual([]);
    });

    it('decodes HTML entities in event titles', () => {
      const html = makeHtml('entity-test', 'Art &#124; Culture', '12 June 2099');
      const events = fetcher._parseEvents(html, NOW);
      expect(events[0].name).toBe('Art | Culture');
    });
  });

  // ── fetchEvents error handling ────────────────────────────────────────────

  describe('fetchEvents', () => {
    it('returns [] when HTTP request fails', async () => {
      jest.spyOn(require('axios'), 'get').mockRejectedValueOnce(new Error('Network error'));
      const events = await fetcher.fetchEvents();
      expect(events).toEqual([]);
    });
  });
});
