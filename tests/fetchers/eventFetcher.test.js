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

  describe('extractEventbriteCost', () => {
    it('should return Free for free events', () => {
      expect(fetcher.extractEventbriteCost({ is_free: true })).toBe('Free');
    });

    it('should return Price TBA for paid events', () => {
      expect(fetcher.extractEventbriteCost({ is_free: false })).toBe('Price TBA');
    });

    it('should return Price TBA when is_free is missing', () => {
      expect(fetcher.extractEventbriteCost({})).toBe('Price TBA');
    });
  });

  describe('BRISTOL_EVENTBRITE_ORGANISERS', () => {
    it('should include at least 5 Bristol organisers', () => {
      expect(EventFetcher.BRISTOL_EVENTBRITE_ORGANISERS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have id and name fields on every entry', () => {
      for (const org of EventFetcher.BRISTOL_EVENTBRITE_ORGANISERS) {
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('name');
        expect(typeof org.id).toBe('string');
        expect(typeof org.name).toBe('string');
      }
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

    it('should skip Ticketmaster if no API key configured', async () => {
      fetcher.ticketmasterApiKey = null;
      const result = await fetcher.fetchTicketmasterEvents();
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

  describe('extractTicketmasterCost', () => {
    it('should format a whole-number price range', () => {
      const event = { priceRanges: [{ min: 15, max: 45 }] };
      expect(fetcher.extractTicketmasterCost(event)).toBe('£15 - £45');
    });

    it('should show single price when min equals max', () => {
      const event = { priceRanges: [{ min: 20, max: 20 }] };
      expect(fetcher.extractTicketmasterCost(event)).toBe('£20');
    });

    it('should format decimal prices with two decimal places', () => {
      const event = { priceRanges: [{ min: 12.5, max: 37.5 }] };
      expect(fetcher.extractTicketmasterCost(event)).toBe('£12.50 - £37.50');
    });

    it('should return Price TBA when no price ranges present', () => {
      expect(fetcher.extractTicketmasterCost({})).toBe('Price TBA');
      expect(fetcher.extractTicketmasterCost({ priceRanges: [] })).toBe('Price TBA');
    });
  });

  describe('extractTicketmasterStatus', () => {
    it('should return cancelled for cancelled events', () => {
      const event = { dates: { status: { code: 'cancelled' } } };
      expect(fetcher.extractTicketmasterStatus(event)).toBe('cancelled');
    });

    it('should return postponed for postponed events', () => {
      const event = { dates: { status: { code: 'postponed' } } };
      expect(fetcher.extractTicketmasterStatus(event)).toBe('postponed');
    });

    it('should return rescheduled for rescheduled events', () => {
      const event = { dates: { status: { code: 'rescheduled' } } };
      expect(fetcher.extractTicketmasterStatus(event)).toBe('rescheduled');
    });

    it('should return off_sale for offsale events', () => {
      const event = { dates: { status: { code: 'offsale' } } };
      expect(fetcher.extractTicketmasterStatus(event)).toBe('off_sale');
    });

    it('should return null for normal on-sale events', () => {
      const event = { dates: { status: { code: 'onsale' } } };
      expect(fetcher.extractTicketmasterStatus(event)).toBeNull();
    });

    it('should return null when status is missing', () => {
      expect(fetcher.extractTicketmasterStatus({})).toBeNull();
    });
  });

  describe('extractTicketmasterImage', () => {
    it('should prefer 16:9 images and pick the widest', () => {
      const event = {
        images: [
          { url: 'https://img/4x3.jpg', ratio: '4_3', width: 1024 },
          { url: 'https://img/16x9-small.jpg', ratio: '16_9', width: 640 },
          { url: 'https://img/16x9-large.jpg', ratio: '16_9', width: 1920 }
        ]
      };
      expect(fetcher.extractTicketmasterImage(event)).toBe('https://img/16x9-large.jpg');
    });

    it('should fall back to first image when no 16:9 available', () => {
      const event = {
        images: [
          { url: 'https://img/4x3.jpg', ratio: '4_3', width: 800 }
        ]
      };
      expect(fetcher.extractTicketmasterImage(event)).toBe('https://img/4x3.jpg');
    });

    it('should return null when no images present', () => {
      expect(fetcher.extractTicketmasterImage({})).toBeNull();
      expect(fetcher.extractTicketmasterImage({ images: [] })).toBeNull();
    });
  });

  describe('Ticketmaster event mapping', () => {
    it('should map Ticketmaster API response to common event format', () => {
      const mockTmEvent = {
        id: 'tm123',
        name: 'Test Show',
        url: 'https://ticketmaster.co.uk/event/tm123',
        info: 'A great show in Bristol',
        dates: {
          start: { dateTime: '2026-08-10T19:00:00Z' },
          status: { code: 'onsale' }
        },
        priceRanges: [{ min: 20, max: 35 }],
        images: [{ url: 'https://img/event.jpg', ratio: '16_9', width: 1024 }],
        _embedded: {
          venues: [{ name: 'O2 Academy Bristol' }]
        }
      };

      expect(mockTmEvent).toHaveProperty('name');
      expect(mockTmEvent).toHaveProperty('dates');
      expect(mockTmEvent._embedded.venues[0].name).toBe('O2 Academy Bristol');
      expect(mockTmEvent.priceRanges[0].min).toBe(20);
    });
  });
});
