const axios = require('axios');

class EventFetcher {
  constructor() {
    this.skiddleApiKey = process.env.SKIDDLE_KEY;
    this.eventbriteApiKey = process.env.EVENTBRITE_API_KEY;
  }

  async fetchSkiddleEvents() {
    if (!this.skiddleApiKey) {
      console.log('Skiddle API key not configured, skipping...');
      return [];
    }

    try {
      console.log('Fetching from Skiddle API...');
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const response = await axios.get('https://www.skiddle.com/api/v1/events/search/', {
        params: {
          api_key: this.skiddleApiKey,
          latitude: 51.4545,
          longitude: -2.5879,
          radius: 10,
          order: 'date',
          limit: 100,
          startDate,
          endDate
        }
      });

      if (!response.data.results || response.data.results.length === 0) {
        return [];
      }

      return response.data.results.map(event => ({
        id: `skiddle-${event.id}`,
        source: 'skiddle',
        name: event.heading,
        description: event.description || '',
        date: event.startdate + (event.doortime ? `T${event.doortime}:00` : ''),
        venue: event.venue?.name || 'Venue TBA',
        cost: this.extractSkiddleCost(event),
        url: event.link,
        image: event.largeimageurl || event.imageurl || null,
        status: this.extractSkiddleStatus(event)
      }));
    } catch (error) {
      console.error('Skiddle API error:', error.message);
      return [];
    }
  }

  extractSkiddleCost(event) {
    const min = parseFloat(event.MinPrice);
    const max = parseFloat(event.MaxPrice);
    if (isNaN(min) && isNaN(max)) return 'Price TBA';
    if (min === 0 && (isNaN(max) || max === 0)) return 'Free';
    if (!isNaN(min) && !isNaN(max) && min !== max) return `£${min} - £${max}`;
    if (!isNaN(min)) return `£${min}`;
    return 'Price TBA';
  }

  extractSkiddleStatus(event) {
    if (event.cancelled === '1') return 'cancelled';
    if (event.soldout === '1') return 'sold_out';
    if (event.ticketsAvailable === '0' && event.soldout !== '0') return 'off_sale';
    return null;
  }

  async fetchEventbriteEvents() {
    if (!this.eventbriteApiKey) {
      console.log('Eventbrite API key not configured, skipping...');
      return [];
    }

    try {
      console.log('Fetching from Eventbrite API...');
      const response = await axios.get('https://www.eventbriteapi.com/v3/events/search/', {
        params: {
          'location.address': 'Bristol, UK',
          'sort_by': 'date',
          'token': this.eventbriteApiKey
        },
        headers: {
          'Authorization': `Bearer ${this.eventbriteApiKey}`
        }
      });

      if (!response.data.events) {
        return [];
      }

      return response.data.events.map(event => ({
        id: `eventbrite-${event.id}`,
        source: 'eventbrite',
        name: event.name.text,
        description: event.description?.text || '',
        date: event.start.utc,
        venue: event.venue_id ? `Venue ${event.venue_id}` : 'Venue TBA',
        cost: event.ticket_classes?.[0]?.cost?.display || 'Price TBA',
        url: event.url,
        image: event.logo?.original?.url || null,
        status: this.extractEventbriteStatus(event)
      }));
    } catch (error) {
      console.error('Eventbrite API error:', error.message);
      return [];
    }
  }

  extractEventbriteStatus(event) {
    if (event.status === 'canceled') return 'cancelled';
    if (event.ticket_availability?.is_sold_out) return 'sold_out';
    return null;
  }

  async fetchAll() {
    const events = [];

    events.push(...await this.fetchSkiddleEvents());
    events.push(...await this.fetchEventbriteEvents());

    return events;
  }
}

module.exports = EventFetcher;
