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
    const name = event.name.toLowerCase().trim();
    const date = new Date(event.date).toISOString().split('T')[0];
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

    const categories = {
      'Concert': ['concert', 'live music', 'band', 'performance', 'musician'],
      'Festival': ['festival', 'fest'],
      'Theater': ['theater', 'theatre', 'play', 'comedy', 'stand-up', 'show'],
      'Sports': ['sports', 'match', 'game', 'football', 'rugby', 'cricket'],
      'Art': ['art', 'gallery', 'exhibition', 'museum', 'visual art'],
      'Food': ['food', 'market', 'pop-up', 'tasting', 'restaurant', 'cafe'],
      'Family': ['family', 'kids', 'children', 'youth'],
      'Nightlife': ['club', 'nightlife', 'dj', 'disco', 'party'],
      'Conference': ['conference', 'workshop', 'seminar', 'talk', 'conference'],
      'Tour': ['tour', 'walking tour', 'sightseeing', 'guided']
    };

    for (const [category, keywords] of Object.entries(categories)) {
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
