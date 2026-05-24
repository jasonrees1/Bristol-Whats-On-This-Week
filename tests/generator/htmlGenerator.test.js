const HtmlGenerator = require('../../src/generator/htmlGenerator');

describe('HtmlGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new HtmlGenerator();
  });

  describe('generate', () => {
    it('should generate valid HTML', () => {
      const events = [];
      const html = generator.generate(events);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('What\'s On in Bristol This Week');
      expect(html).toContain('</html>');
    });

    it('should display no events message when empty', () => {
      const events = [];
      const html = generator.generate(events);
      expect(html).toContain('No events found for this week.');
    });

    it('should render events with all details', () => {
      const events = [
        {
          name: 'Test Concert',
          venue: 'O2 Academy',
          date: '2026-05-30',
          cost: '£15',
          category: 'Concert',
          description: 'A test concert'
        }
      ];
      const html = generator.generate(events);
      expect(html).toContain('Test Concert');
      expect(html).toContain('O2 Academy');
      expect(html).toContain('£15');
      expect(html).toContain('Concert');
      expect(html).toContain('A test concert');
    });
  });

  describe('renderEvent', () => {
    it('should handle missing event details gracefully', () => {
      const event = { name: 'Minimal Event' };
      const html = generator.renderEvent(event);
      expect(html).toContain('Minimal Event');
      expect(html).toContain('Venue TBA');
      expect(html).toContain('Date TBA');
    });

    it('should not show cost if not provided', () => {
      const event = { name: 'Free Event', venue: 'Park', date: '2026-05-30' };
      const html = generator.renderEvent(event);
      expect(html).not.toContain('💷');
    });
  });
});
