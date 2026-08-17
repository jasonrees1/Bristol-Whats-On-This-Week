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
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= weekFromNow;
    });
  }

  categorizeEvents(events) {
    return events.map(event => ({
      ...event,
      category: this.determineCategory(event.name, event.description)
    }));
  }

  determineCategory(name, description) {
    const text = `${name} ${description}`.toLowerCase();

    // Ordered: most specific / most common Bristol event types first.
    // Avoid short words that appear as substrings ('art' in 'party', 'show' in descriptions, etc.)
    const categories = [
      ['Festival',    ['festival']],
      ['Nightlife',   ['rave', 'club night', 'nightclub', 'dj set', 'dnb', 'drum and bass', 'drum n bass', 'house music', 'techno', 'grime', 'bass music', 'after dark', 'after-dark', 'disco', 'party', 'nightlife', 'dj']],
      ['Live Music',  ['concert', 'live music', 'live band', 'live act', 'open mic', 'musician', 'orchestra', 'choir', 'jam night', 'sound system', 'gig', 'music']],
      ['Theater',     ['theatre', 'theater', 'comedy', 'pantomime', 'stand-up', 'improv', 'comedian', 'cabaret', 'burlesque']],
      ['Sports',      ['football', 'rugby', 'cricket', 'tennis', 'boxing', 'marathon', 'athletics', 'triathlon', 'cycling', 'sports', 'tournament']],
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

    return 'Other';
  }

  sortByDate(events) {
    return events.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
}

module.exports = DataProcessor;
