const ManualFetcher = require('../../src/fetchers/manualFetcher');
const fs = require('fs');

const NOW = new Date('2099-10-04T09:00:00Z');

function mockFile(entries) {
  jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(entries));
}

afterEach(() => jest.restoreAllMocks());

describe('ManualFetcher.fetchEvents', () => {
  let fetcher;
  beforeEach(() => { fetcher = new ManualFetcher(); });

  it('returns an event within the 7-day window', () => {
    mockFile([{
      name: 'Waitress',
      date: '2099-10-07T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://www.atgtickets.com/shows/waitress/bristol-hippodrome/',
      cost: '£20 - £75'
    }]);

    const result = fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    const e = result[0];
    expect(e.name).toBe('Waitress');
    expect(e.venue).toBe('Bristol Hippodrome');
    expect(e.cost).toBe('£20 - £75');
    expect(e.source).toBe('manual');
    expect(e.status).toBeNull();
  });

  it('excludes events before now', () => {
    mockFile([{
      name: 'Past Show',
      date: '2099-10-03T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    expect(fetcher.fetchEvents(NOW)).toHaveLength(0);
  });

  it('excludes events more than 7 days away', () => {
    mockFile([{
      name: 'Future Show',
      date: '2099-10-20T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    expect(fetcher.fetchEvents(NOW)).toHaveLength(0);
  });

  it('skips entries with no name', () => {
    mockFile([{
      date: '2099-10-07T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    expect(fetcher.fetchEvents(NOW)).toHaveLength(0);
  });

  it('skips entries with no date', () => {
    mockFile([{
      name: 'Dateless Show',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    expect(fetcher.fetchEvents(NOW)).toHaveLength(0);
  });

  it('ignores metadata entries with _comment or _format fields', () => {
    mockFile([
      { _comment: 'Add events here.' },
      { _format: { name: 'required' } },
      { name: 'Real Show', date: '2099-10-06T19:30:00', venue: 'Bristol Hippodrome', url: 'https://example.com' }
    ]);
    const result = fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Real Show');
  });

  it('defaults cost to Price TBA when not provided', () => {
    mockFile([{
      name: 'Show Without Price',
      date: '2099-10-06T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    expect(fetcher.fetchEvents(NOW)[0].cost).toBe('Price TBA');
  });

  it('defaults description and image to empty/null when not provided', () => {
    mockFile([{
      name: 'Minimal Show',
      date: '2099-10-06T19:30:00',
      venue: 'Bristol Hippodrome',
      url: 'https://example.com'
    }]);
    const e = fetcher.fetchEvents(NOW)[0];
    expect(e.description).toBe('');
    expect(e.image).toBeNull();
  });

  it('returns [] on file read error', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('ENOENT'); });
    expect(fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('returns [] on malformed JSON', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{ not valid json }');
    expect(fetcher.fetchEvents(NOW)).toEqual([]);
  });

  it('returns multiple events in the same week', () => {
    mockFile([
      { name: 'Show A', date: '2099-10-05T14:30:00', venue: 'Hippodrome', url: 'https://a.com' },
      { name: 'Show B', date: '2099-10-07T19:30:00', venue: 'Hippodrome', url: 'https://b.com' },
      { name: 'Show C', date: '2099-10-09T19:30:00', venue: 'Hippodrome', url: 'https://c.com' }
    ]);
    expect(fetcher.fetchEvents(NOW)).toHaveLength(3);
  });
});
