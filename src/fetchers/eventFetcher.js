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

      const rawEvents = response.data._embedded.events;

      console.log(`Fetching individual details for ${rawEvents.length} Ticketmaster events...`);
      const detailsMap = await this.fetchTicketmasterDetailsInBatches(rawEvents.map(e => e.id));

      return rawEvents.map(event => ({
        id: `ticketmaster-${event.id}`,
        source: 'ticketmaster',
        name: event.name,
        description: event.description || event.info || '',
        date: event.dates.start.dateTime || event.dates.start.localDate,
        venue: event._embedded?.venues?.[0]?.name || 'Venue TBA',
        cost: this.extractCost(event),
        url: event.url,
        image: event.images?.[0]?.url || null,
        status: this.extractTicketmasterStatus(event, detailsMap.get(event.id))
      }));
    } catch (error) {
      console.error('Ticketmaster API error:', error.message);
      return [];
    }
  }

  async fetchTicketmasterDetailsInBatches(eventIds) {
    const BATCH_SIZE = 20;
    const detailsMap = new Map();

    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(id => this.fetchTicketmasterEventDetail(id)));
      results.forEach((detail, idx) => {
        if (detail) detailsMap.set(batch[idx], detail);
      });
      if (i + BATCH_SIZE < eventIds.length) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    return detailsMap;
  }

  async fetchTicketmasterEventDetail(eventId) {
    try {
      const response = await axios.get(
        `https://app.ticketmaster.com/discovery/v2/events/${eventId}.json`,
        { params: { apikey: this.ticketmasterApiKey } }
      );
      const d = response.data;
      console.log(`[TM detail] "${d.name}" status=${d.dates?.status?.code} ticketLimit=${JSON.stringify(d.ticketLimit)} salesEnd=${d.sales?.public?.endDateTime}`);
      return d;
    } catch (error) {
      return null;
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

  extractTicketmasterStatus(event, details) {
    // Check search-result status first (cancelled/postponed/rescheduled are reliable)
    const searchCode = event.dates?.status?.code;
    if (searchCode === 'cancelled') return 'cancelled';
    if (searchCode === 'postponed') return 'postponed';
    if (searchCode === 'rescheduled') return 'rescheduled';

    if (details) {
      const detailCode = details.dates?.status?.code;
      if (detailCode === 'cancelled') return 'cancelled';
      if (detailCode === 'postponed') return 'postponed';
      if (detailCode === 'rescheduled') return 'rescheduled';
      // offsale in individual detail = sale has ended (most likely sold out or withdrawn)
      if (detailCode === 'offsale') return 'sold_out';

      // Check ticketLimit.info text for explicit sold-out language
      const limitInfo = (details.ticketLimit?.info || '').toLowerCase();
      if (limitInfo.includes('sold out') || limitInfo.includes('sold-out')) return 'sold_out';
    }

    // offsale in search result only = off sale but not confirmed sold out
    if (searchCode === 'offsale') return 'off_sale';
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
