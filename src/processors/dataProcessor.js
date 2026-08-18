class DataProcessor {
  process(rawEvents) {
    // Deduplicate events from multiple sources
    const deduplicated = this.deduplicate(rawEvents);

    // Filter to only events this week
    const thisWeek = this.getThisWeekEvents(deduplicated);

    // Categorize events
    const categorized = this.categorizeEvents(thisWeek);

    // Sort by date
    const sorted = this.sortByDate(categorized);

    return sorted;
  }

  deduplicate(events) {
    const seen = new Map();
    const deduplicated = [];

    for (const event of events) {
      const key = this.createDuplicateKey(event);
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicated.push(event);
      } else {
        console.log(`Filtered duplicate: ${event.name}`);
      }
    }

    console.log(`Deduplicated ${events.length} events to ${deduplicated.length}`);
    return deduplicated;
  }

  createDuplicateKey(event) {
    const name = (event.name || '').toLowerCase().trim();
    const d = new Date(event.date);
    const date = isNaN(d.getTime()) ? 'unknown' : d.toISOString().split('T')[0];
    return `${name}-${date}`;
  }

  getThisWeekEvents(events) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // start of today so afternoon runs don't drop same-day events
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= today && eventDate <= weekFromNow;
    });
  }

  categorizeEvents(events) {
    return events.map(event => ({
      ...event,
      category: this.determineCategory(event.name, event.description, event.venue)
    }));
  }

  // Known Bristol live music venues — used as a fallback signal when name/description
  // contain no genre keywords (e.g. a band name alone gives no category signal).
  static MUSIC_VENUES = new Set([
    'exchange', 'strange brew', 'thekla', 'louisiana', 'fleece', 'grain barge',
    'marble factory', 'rough trade', 'o2 academy', 'anson rooms', 'crofters rights',
    'stokes croft music hall', 'surrey vaults', 'the lanes', 'motion', 'lakota',
    'trinity centre', 'bristol beacon', 'st george', 'colston hall'
  ]);

  determineCategory(name, description, venue = '') {
    const text = `${name} ${description}`.toLowerCase();

    // Ordered: most specific / most common Bristol event types first.
    // Avoid short words that appear as substrings ('art' in 'party', etc.)
    const categories = [
      ['Festival',    ['festival']],
      ['Nightlife',   ['rave', 'club night', 'nightclub', 'dj set', 'dnb', 'drum and bass', 'drum n bass', 'house music', 'techno', 'grime', 'bass music', 'after dark', 'after-dark', 'disco', 'party', 'nightlife', 'dj']],
      ['Live Music',  ['concert', 'live music', 'live band', 'live act', 'open mic', 'musician',
                       'orchestra', 'choir', 'jam night', 'sound system', 'gig', 'music',
                       'jazz', 'blues', 'soul', 'funk', 'folk', 'rock', 'indie', 'punk',
                       'hip-hop', 'hip hop', 'r&b', 'rnb', 'reggae', 'acoustic', 'afrobeats',
                       'singer-songwriter', 'world music', 'classical', 'ambient']],
      ['Theater',     ['theatre', 'theater', 'comedy', 'pantomime', 'stand-up', 'improv', 'comedian', 'cabaret', 'burlesque']],
      ['Sports',      ['football', 'rugby', 'cricket', 'tennis', 'boxing', 'marathon', 'athletics', 'triathlon', 'cycling', 'sports', 'tournament', 'wrestling']],
      ['Art',         ['gallery', 'exhibition', 'visual art', 'art show', 'art fair', 'life drawing', 'painting class', 'printmaking', 'sculpture', 'ceramics', 'museum']],
      ['Family',      ['family', 'kids', 'children', 'toddler', 'youth']],
      ['Food',        ['restaurant', 'food', 'cafe', 'tasting', 'supper club', 'street food', 'pop-up dining']],
      ['Market',      ['craft market', 'food market', 'farmers market', 'craft fair', 'artisan fair', 'flea market', 'boot sale', 'street market']],
      ['Conference',  ['conference', 'workshop', 'seminar', 'networking', 'meetup', 'webinar']],
      ['Tour',        ['walking tour', 'guided tour', 'sightseeing']],
    ];

    for (const [category, keywords] of categories) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    // Venue-based fallback: if no keywords matched and the venue is a known Bristol
    // live music venue, the event is almost certainly a gig.
    if (venue) {
      const venueLower = venue.toLowerCase();
      for (const v of DataProcessor.MUSIC_VENUES) {
        if (venueLower.includes(v)) return 'Live Music';
      }
    }

    return 'Other';
  }

  sortByDate(events) {
    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}

module.exports = DataProcessor;
