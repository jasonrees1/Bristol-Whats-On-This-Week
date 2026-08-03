const { StGeorgesFetcher, parseDate } = require('../../src/fetchers/stGeorgesFetcher');
const axios = require('axios');

// All test events use 2099 so they never expire relative to a real "now"
const NOW = new Date('2099-10-01T10:00:00Z');
const IN_WINDOW = new Date('2099-10-05T12:00:00Z');
const OUT_OF_WINDOW = new Date('2099-10-15T12:00:00Z');

function card({ slug, title, date, status = '' }) {
  return `
<div>
<img src="https://images.stgeorgesbristol.co.uk/uploads/img.jpg" alt="">
<span>Classical</span>
<span>${date}</span>
<h4>${title}</h4>
<a href="https://www.stgeorgesbristol.co.uk/whats-on/${slug}/">View event</a>
${status ? `<span>${status}</span>` : ''}
</div>`;
}

describe('parseDate', () => {
  it('parses a standard date', () => {
    const d = parseDate('7', 'August', '2099');
    expect(d.getFullYear()).toBe(2099);
    expect(d.getMonth()).toBe(7); // August = index 7
    expect(d.getDate()).toBe(7);
  });

  it('defaults to 19:30', () => {
    const d = parseDate('1', 'January', '2099');
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
  });

  it('returns null for an unrecognised month', () => {
    expect(parseDate('1', 'Octember', '2099')).toBeNull();
  });

  it('handles case-insensitive month names', () => {
    const d = parseDate('15', 'march', '2099');
    expect(d).not.toBeNull();
    expect(d.getMonth()).toBe(2);
  });
});

describe('StGeorgesFetcher._parseEvents', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new StGeorgesFetcher();
  });

  it('parses a single event card correctly', () => {
    const html = card({ slug: 'some-concert', title: 'Some Concert', date: 'Fri 5 October 2099' });
    const events = fetcher._parseEvents(html);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.id).toBe('stgeorges-some-concert');
    expect(e.name).toBe('Some Concert');
    expect(e.venue).toBe("St George's Bristol");
    expect(e.source).toBe('stgeorges');
    expect(e.url).toBe('https://www.stgeorgesbristol.co.uk/whats-on/some-concert/');
    expect(e.cost).toBe('Price TBA');
    expect(e.image).toBeNull();
    expect(e.status).toBeNull();
  });

  it('parses multiple event cards', () => {
    const html = [
      card({ slug: 'event-one', title: 'Event One', date: 'Sat 6 October 2099' }),
      card({ slug: 'event-two', title: 'Event Two', date: 'Sun 7 October 2099' }),
      card({ slug: 'event-three', title: 'Event Three', date: 'Mon 8 October 2099' })
    ].join('\n');
    const events = fetcher._parseEvents(html);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.name)).toEqual(['Event One', 'Event Two', 'Event Three']);
  });

  it('picks the closest date when two dates appear in the look-back context', () => {
    // Card 1 date will bleed into the 600-char context window for card 2
    const html = [
      card({ slug: 'card-one', title: 'Card One', date: 'Thu 3 October 2099' }),
      card({ slug: 'card-two', title: 'Card Two', date: 'Fri 4 October 2099' })
    ].join('\n');
    const events = fetcher._parseEvents(html);
    expect(events[0].name).toBe('Card One');
    expect(new Date(events[0].date).getDate()).toBe(3);
    expect(events[1].name).toBe('Card Two');
    expect(new Date(events[1].date).getDate()).toBe(4);
  });

  it('skips a card with no date in context', () => {
    const html = `
<div>
<h4>Mystery Event</h4>
<a href="https://www.stgeorgesbristol.co.uk/whats-on/mystery-event/">View event</a>
</div>`;
    expect(fetcher._parseEvents(html)).toHaveLength(0);
  });

  it('skips a card with no h4 title', () => {
    const html = `
<div>
<span>Wed 9 October 2099</span>
<a href="https://www.stgeorgesbristol.co.uk/whats-on/no-title/">View event</a>
</div>`;
    expect(fetcher._parseEvents(html)).toHaveLength(0);
  });

  it('does not match Book Now links as event cards', () => {
    const html = `
<div>
<span>Sat 6 October 2099</span>
<h4>Ticketed Show</h4>
<a href="https://www.stgeorgesbristol.co.uk/whats-on/ticketed-show/">View event</a>
<a href="https://www.stgeorgesbristol.co.uk/whats-on/ticketed-show/book/9999">Book Now</a>
</div>`;
    const events = fetcher._parseEvents(html);
    expect(events).toHaveLength(1);
    expect(events[0].url).toBe('https://www.stgeorgesbristol.co.uk/whats-on/ticketed-show/');
  });

  it('decodes HTML entities in titles', () => {
    const html = card({ slug: 'entity-test', title: 'Bach &amp; Friends', date: 'Tue 7 October 2099' });
    const events = fetcher._parseEvents(html);
    expect(events[0].name).toBe('Bach & Friends');
  });

  it('returns empty array for HTML with no event cards', () => {
    expect(fetcher._parseEvents('<p>No events this week.</p>')).toHaveLength(0);
  });

  it('sets date to 19:30 local time', () => {
    const html = card({ slug: 'evening-gig', title: 'Evening Concert', date: 'Wed 8 October 2099' });
    const events = fetcher._parseEvents(html);
    const d = new Date(events[0].date);
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
  });
});

describe('StGeorgesFetcher.fetchEvents — date filtering', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new StGeorgesFetcher();
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: [
        card({ slug: 'in-window', title: 'In Window', date: 'Sun 5 October 2099' }),
        card({ slug: 'out-of-window', title: 'Out Of Window', date: 'Wed 15 October 2099' })
      ].join('\n')
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns only events within the 7-day window', async () => {
    const result = await fetcher.fetchEvents(NOW);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('In Window');
  });
});

describe('StGeorgesFetcher.fetchEvents — network failure', () => {
  let fetcher;

  beforeEach(() => {
    fetcher = new StGeorgesFetcher();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns [] on fetch failure', async () => {
    expect(await fetcher.fetchEvents(NOW)).toEqual([]);
  });
});
