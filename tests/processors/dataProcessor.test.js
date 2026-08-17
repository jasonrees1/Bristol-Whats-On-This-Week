const DataProcessor = require('../../src/processors/dataProcessor');

describe('DataProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new DataProcessor();
  });

  describe('deduplicate', () => {
    it('should remove duplicate events from different sources', () => {
      const events = [
        { name: 'Test Concert', date: '2026-05-30T19:00:00Z', source: 'ticketmaster' },
        { name: 'Test Concert', date: '2026-05-30', source: 'eventbrite' },
        { name: 'Different Event', date: '2026-06-01T20:00:00Z', source: 'ticketmaster' }
      ];
      const result = processor.deduplicate(events);
      expect(result.length).toBe(2);
      expect(result.some(e => e.name === 'Test Concert')).toBe(true);
      expect(result.some(e => e.name === 'Different Event')).toBe(true);
    });

    it('should keep duplicate events with different dates', () => {
      const events = [
        { name: 'Weekly Event', date: '2026-05-30T19:00:00Z', source: 'ticketmaster' },
        { name: 'Weekly Event', date: '2026-06-06T19:00:00Z', source: 'eventbrite' }
      ];
      const result = processor.deduplicate(events);
      expect(result.length).toBe(2);
    });

    it('should create consistent duplicate keys regardless of date format', () => {
      const event1 = { name: 'Concert', date: '2026-05-30T19:00:00Z' };
      const event2 = { name: 'Concert', date: '2026-05-30' };
      const key1 = processor.createDuplicateKey(event1);
      const key2 = processor.createDuplicateKey(event2);
      expect(key1).toBe(key2);
    });
  });

  describe('categorizeEvents', () => {
    it('should categorize concert events correctly', () => {
      const events = [{ name: 'Live Band Performance', description: 'concert' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Live Music');
    });

    it('should categorize festival events correctly', () => {
      const events = [{ name: 'Bristol Festival', description: 'annual fest' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Festival');
    });

    it('should categorize theater events correctly', () => {
      const events = [{ name: 'Comedy Show', description: 'theatre production' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Theater');
    });

    it('should categorize sports events correctly', () => {
      const events = [{ name: 'Bristol City Match', description: 'football game' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Sports');
    });

    it('should categorize food events correctly', () => {
      const events = [{ name: 'Street Food Market', description: 'pop-up food event' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Food');
    });

    it('should default to Other for unknown categories', () => {
      const events = [{ name: 'Random Event', description: 'something else' }];
      const result = processor.categorizeEvents(events);
      expect(result[0].category).toBe('Other');
    });
  });

  describe('sortByDate', () => {
    it('should sort events chronologically', () => {
      const events = [
        { name: 'Event 2', date: '2026-06-02' },
        { name: 'Event 1', date: '2026-05-30' },
        { name: 'Event 3', date: '2026-06-05' }
      ];
      const result = processor.sortByDate(events);
      expect(result[0].name).toBe('Event 1');
      expect(result[1].name).toBe('Event 2');
      expect(result[2].name).toBe('Event 3');
    });
  });

  describe('getThisWeekEvents', () => {
    it('should filter events to this week only', () => {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      const events = [
        { name: 'This Week', date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Next Week', date: nextWeek.toISOString() },
        { name: 'Last Week', date: lastWeek.toISOString() }
      ];

      const result = processor.getThisWeekEvents(events);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('This Week');
    });
  });

  describe('full process', () => {
    it('should process events end-to-end', () => {
      const now = new Date();
      const events = [
        {
          name: 'Test Concert',
          date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Live music event',
          source: 'ticketmaster'
        },
        {
          name: 'Test Concert',
          date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: 'concert',
          source: 'eventbrite'
        }
      ];

      const result = processor.process(events);
      expect(result.length).toBe(1);
      expect(result[0].category).toBe('Live Music');
    });
  });
});
