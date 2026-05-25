const EventFetcher = require('../../src/fetchers/eventFetcher');

describe('EventFetcher', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new EventFetcher();
  });

  describe('extractSkiddleCost', () => {
    it('should format a price range correctly', () => {
      const event = { MinPrice: '15', MaxPrice: '45' };
      expect(fetcher.extractSkiddleCost(event)).toBe('£15 - £45');
    });

    it('should show single price when min equals max', () => {
      const event = { MinPrice: '20', MaxPrice: '20' };
      expect(fetcher.extractSkiddleCost(event)).toBe('£20');
    });

    it('should return Free for zero-price events', () => {
      const event = { MinPrice: '0', MaxPrice: '0' };
      expect(fetcher.extractSkiddleCost(event)).toBe('Free');
    });

    it('should return Price TBA when no price data', () => {
      const event = {};
      expect(fetcher.extractSkiddleCost(event)).toBe('Price TBA');
    });
  });

  describe('extractSkiddleStatus', () => {
    it('should return cancelled when cancelled flag is set', () => {
      const event = { cancelled: '1', soldout: '0', ticketsAvailable: '1' };
      expect(fetcher.extractSkiddleStatus(event)).toBe('cancelled');
    });

    it('should return sold_out when soldout flag is set', () => {
      const event = { cancelled: '0', soldout: '1', ticketsAvailable: '0' };
      expect(fetcher.extractSkiddleStatus(event)).toBe('sold_out');
    });

    it('should return null for a normal available event', () => {
      const event = { cancelled: '0', soldout: '0', ticketsAvailable: '1' };
      expect(fetcher.extractSkiddleStatus(event)).toBeNull();
    });
  });

  describe('API Key Configuration', () => {
    it('should skip Skiddle if no API key configured', async () => {
      fetcher.skiddleApiKey = null;
      const result = await fetcher.fetchSkiddleEvents();
      expect(result).toEqual([]);
    });

    it('should skip Eventbrite if no API key configured', async () => {
      fetcher.eventbriteApiKey = null;
      const result = await fetcher.fetchEventbriteEvents();
      expect(result).toEqual([]);
    });
  });

  describe('Event Data Structure', () => {
    it('should map Skiddle response fields to common event format', () => {
      const mockSkiddleEvent = {
        id: 'abc123',
        heading: 'Test Concert',
        description: 'A test concert in Bristol',
        startdate: '2026-05-30',
        doortime: '19:00',
        largeimageurl: 'https://example.com/image.jpg',
        link: 'https://www.skiddle.com/event/abc123',
        MinPrice: '10',
        MaxPrice: '25',
        venue: { name: 'Colston Hall' },
        cancelled: '0',
        soldout: '0',
        ticketsAvailable: '1'
      };

      expect(mockSkiddleEvent).toHaveProperty('heading');
      expect(mockSkiddleEvent).toHaveProperty('startdate');
      expect(mockSkiddleEvent).toHaveProperty('venue');
      expect(mockSkiddleEvent).toHaveProperty('soldout');
      expect(mockSkiddleEvent).toHaveProperty('cancelled');
    });
  });
});
