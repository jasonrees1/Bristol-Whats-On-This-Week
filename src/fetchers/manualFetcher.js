const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/manual-events.json');

class ManualFetcher {
  fetchEvents(now = new Date()) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = raw
        .filter(entry => !entry._comment && !entry._format)
        .map((entry, i) => {
          const date = entry.date ? new Date(entry.date) : null;
          return {
            id: `manual-${i}-${entry.name?.replace(/\s+/g, '-').toLowerCase()}`,
            source: 'manual',
            name: entry.name || null,
            description: entry.description || '',
            date: date ? date.toISOString() : null,
            venue: entry.venue || 'Venue TBA',
            cost: entry.cost || 'Price TBA',
            url: entry.url || null,
            image: entry.image || null,
            status: null
          };
        })
        .filter(e => {
          if (!e.name || !e.date) return false;
          const d = new Date(e.date);
          return d >= now && d <= endDate;
        });

      if (events.length > 0) {
        console.log(`Manual events: ${events.length} this week`);
      }
      return events;
    } catch (err) {
      console.error('Manual events fetch failed:', err.message);
      return [];
    }
  }
}

module.exports = ManualFetcher;
