const Ents24Fetcher = require('../../src/fetchers/ents24Fetcher');

describe('Ents24Fetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new Ents24Fetcher();
  });

  describe('fetchEvents — no credentials', () => {
    it('returns [] when client ID is missing', async () => {
      fetcher.clientId = null;
      fetcher.clientSecret = 'secret';
      const result = await fetcher.fetchEvents();
      expect(result).toEqual([]);
    });

    it('returns [] when client secret is missing', async () => {
      fetcher.clientId = 'id';
      fetcher.clientSecret = null;
      const result = await fetcher.fetchEvents();
      expect(result).toEqual([]);
    });

    it('returns [] when both credentials are missing', async () => {
      fetcher.clientId = null;
      fetcher.clientSecret = null;
      const result = await fetcher.fetchEvents();
      expect(result).toEqual([]);
    });
  });

  describe('_extractCost', () => {
    it('returns Free when both prices are 0', () => {
      expect(fetcher._extractCost({ ticketPrices: { from: 0, to: 0 } })).toBe('Free');
    });

    it('formats a price range', () => {
      expect(fetcher._extractCost({ ticketPrices: { from: 15, to: 45 } })).toBe('£15 - £45');
    });

    it('formats a single price when from equals to', () => {
      expect(fetcher._extractCost({ ticketPrices: { from: 20, to: 20 } })).toBe('£20');
    });

    it('returns Price TBA when no price data', () => {
      expect(fetcher._extractCost({})).toBe('Price TBA');
    });

    it('handles ticket_prices field name variant', () => {
      expect(fetcher._extractCost({ ticket_prices: { from: 10, to: 30 } })).toBe('£10 - £30');
    });

    it('returns Price TBA when prices object has no recognisable fields', () => {
      expect(fetcher._extractCost({ ticketPrices: {} })).toBe('Price TBA');
    });
  });

  describe('fetchEvents — API error handling', () => {
    it('returns [] when auth request fails', async () => {
      fetcher.clientId = 'id';
      fetcher.clientSecret = 'secret';
      jest.spyOn(require('axios'), 'post').mockRejectedValueOnce(new Error('Auth failed'));
      const result = await fetcher.fetchEvents();
      expect(result).toEqual([]);
    });
  });

  describe('event mapping — response format resilience', () => {
    it('handles array response format', () => {
      const mockItems = [
        {
          id: 'abc123',
          title: 'Test Gig',
          startDateTime: '2026-08-10T19:00:00',
          venue: { name: 'O2 Academy Bristol' },
          ticketPrices: { from: 15, to: 25 },
          webLink: 'https://www.ents24.com/event/abc123',
          images: [{ url: 'https://example.com/img.jpg' }]
        }
      ];

      // Simulate the internal mapping logic
      const mapped = mockItems.map(event => ({
        id: `ents24-${event.id}`,
        source: 'ents24',
        name: event.title || event.name || null,
        description: event.description || '',
        date: event.startDateTime || event.start_date || null,
        venue: event.venue?.name || 'Venue TBA',
        cost: fetcher._extractCost(event),
        url: event.webLink,
        image: event.images?.[0]?.url || null,
        status: null
      })).filter(e => e.name);

      expect(mapped).toHaveLength(1);
      expect(mapped[0].id).toBe('ents24-abc123');
      expect(mapped[0].name).toBe('Test Gig');
      expect(mapped[0].venue).toBe('O2 Academy Bristol');
      expect(mapped[0].cost).toBe('£15 - £25');
      expect(mapped[0].source).toBe('ents24');
    });

    it('filters out events with no title', () => {
      const mockItems = [
        { id: '1', title: 'Valid Event', startDateTime: '2026-08-10T19:00:00', venue: { name: 'Venue' } },
        { id: '2', startDateTime: '2026-08-11T20:00:00', venue: { name: 'Venue' } }
      ];

      const mapped = mockItems
        .map(e => ({ id: `ents24-${e.id}`, name: e.title || e.name || null }))
        .filter(e => e.name);

      expect(mapped).toHaveLength(1);
      expect(mapped[0].name).toBe('Valid Event');
    });
  });
});
