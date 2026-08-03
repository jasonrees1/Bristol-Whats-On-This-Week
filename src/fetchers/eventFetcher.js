const axios = require('axios');

class EventFetcher {
  constructor() {
    this.skiddleApiKey = process.env.SKIDDLE_KEY;
    this.eventbriteApiKey = process.env.EVENTBRITE_API_KEY;
    this.ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;
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

      return response.data.results
        .map(event => ({
          id: `skiddle-${event.id}`,
          source: 'skiddle',
          name: event.heading || event.title || event.eventname || null,
          description: event.description || '',
          date: event.startdate + (event.doortime ? `T${event.doortime}:00` : ''),
          venue: event.venue?.name || 'Venue TBA',
          cost: this.extractSkiddleCost(event),
          url: event.link,
          image: event.largeimageurl || event.imageurl || null,
          status: this.extractSkiddleStatus(event)
        }))
        .filter(event => event.name);
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

  async fetchTicketmasterEvents() {
    if (!this.ticketmasterApiKey) {
      console.log('Ticketmaster API key not configured, skipping...');
      return [];
    }

    try {
      console.log('Fetching from Ticketmaster API...');
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const startDateTime = today.toISOString().replace(/\.\d{3}Z$/, 'Z');
      const endDateTime = nextWeek.toISOString().replace(/\.\d{3}Z$/, 'Z');

      const response = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
        params: {
          apikey: this.ticketmasterApiKey,
          city: 'Bristol',
          countryCode: 'GB',
          startDateTime,
          endDateTime,
          size: 200,
          sort: 'date,asc'
        }
      });

      const events = response.data?._embedded?.events || [];

      return events.map(event => ({
        id: `ticketmaster-${event.id}`,
        source: 'ticketmaster',
        name: event.name,
        description: event.info || event.pleaseNote || '',
        date: event.dates?.start?.dateTime || event.dates?.start?.localDate,
        venue: event._embedded?.venues?.[0]?.name || 'Venue TBA',
        cost: this.extractTicketmasterCost(event),
        url: event.url,
        image: this.extractTicketmasterImage(event),
        status: this.extractTicketmasterStatus(event)
      })).filter(event => event.name);
    } catch (error) {
      console.error('Ticketmaster API error:', error.message);
      return [];
    }
  }

  extractTicketmasterCost(event) {
    const ranges = event.priceRanges;
    if (!ranges || ranges.length === 0) return 'Price TBA';
    const range = ranges[0];
    const fmt = (n) => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
    if (range.min === range.max) return fmt(range.min);
    return `${fmt(range.min)} - ${fmt(range.max)}`;
  }

  extractTicketmasterImage(event) {
    const images = event.images || [];
    const wideImages = images
      .filter(img => img.ratio === '16_9')
      .sort((a, b) => b.width - a.width);
    return wideImages[0]?.url || images[0]?.url || null;
  }

  extractTicketmasterStatus(event) {
    const code = event.dates?.status?.code;
    if (code === 'cancelled') return 'cancelled';
    if (code === 'postponed') return 'postponed';
    if (code === 'rescheduled') return 'rescheduled';
    if (code === 'offsale') return 'off_sale';
    return null;
  }

  async fetchAll() {
    const [skiddle, eventbrite, ticketmaster] = await Promise.all([
      this.fetchSkiddleEvents(),
      this.fetchEventbriteEvents(),
      this.fetchTicketmasterEvents()
    ]);

    const total = skiddle.length + eventbrite.length + ticketmaster.length;
    console.log(`Fetched: ${skiddle.length} Skiddle, ${eventbrite.length} Eventbrite, ${ticketmaster.length} Ticketmaster (${total} total)`);

    return [...skiddle, ...eventbrite, ...ticketmaster];
  }
}

module.exports = EventFetcher;
