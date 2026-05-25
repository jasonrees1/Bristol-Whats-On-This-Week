const axios = require('axios');

class EventFetcher {
  constructor() {
    this.ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
    this.eventbriteApiKey = process.env.EVENTBRITE_API_KEY;
  }

  async fetchTicketmasterEvents() {
    if (!this.ticketmasterApiKey) {
      console.log('Ticketmaster API key not configured, skipping...');
      return [];
    }

    try {
      console.log('Fetching from Ticketmaster API...');
      const response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
        params: {
          city: 'Bristol',
          countryCode: 'GB',
          apikey: this.ticketmasterApiKey,
          size: 200
        }
      });

      if (!response.data._embedded || !response.data._embedded.events) {
        return [];
      }

      return response.data._embedded.events.map(event => ({
        id: `ticketmaster-${event.id}`,
        source: 'ticketmaster',
        name: event.name,
        description: event.description || event.info || '',
        date: event.dates.start.dateTime || event.dates.start.localDate,
        venue: event._embedded?.venues?.[0]?.name || 'Venue TBA',
        cost: this.extractCost(event),
        url: event.url,
        image: event.images?.[0]?.url || null,
        status: this.extractTicketmasterStatus(event)
      }));
    } catch (error) {
      console.error('Ticketmaster API error:', error.message);
      return [];
    }
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

  extractTicketmasterStatus(event) {
    const code = event.dates?.status?.code;
    if (code === 'cancelled') return 'cancelled';
    if (code === 'postponed') return 'postponed';
    if (code === 'rescheduled') return 'rescheduled';
    if (code === 'offsale') return 'sold_out';
    return null;
  }

  extractEventbriteStatus(event) {
    if (event.status === 'canceled') return 'cancelled';
    if (event.ticket_availability?.is_sold_out) return 'sold_out';
    return null;
  }

  extractCost(event) {
    if (!event.priceRanges || event.priceRanges.length === 0) {
      return 'Price TBA';
    }
    const price = event.priceRanges[0];
    return `£${price.min} - £${price.max}`;
  }

  async fetchAll() {
    const events = [];

    events.push(...await this.fetchTicketmasterEvents());
    events.push(...await this.fetchEventbriteEvents());

    return events;
  }
}

module.exports = EventFetcher;
