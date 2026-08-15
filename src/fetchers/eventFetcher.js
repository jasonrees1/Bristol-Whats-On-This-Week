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

  // Eventbrite removed location-based search in Feb 2020.
  // We query known Bristol organisers by ID instead.
  static get BRISTOL_EVENTBRITE_ORGANISERS() {
    return [
      { id: '32724125543', name: 'Bristol City Council' },
      { id: '31140565679', name: 'Tobacco Factory' },
      { id: '30072911048', name: 'Watershed' },
      { id: '8288549531',  name: 'Bristol Beacon' },
      { id: '16913320250', name: 'The Fleece' },
      { id: '210213264',   name: 'Theatre Bristol' },
      { id: '11348031029', name: 'Bristol Creative Industries' },
      { id: '11179795567', name: 'Bristol Libraries' },
    ];
  }

  async fetchEventbriteEvents() {
    if (!this.eventbriteApiKey) {
      console.log('Eventbrite API key not configured, skipping...');
      return [];
    }

    console.log('Fetching from Eventbrite API (organiser queries)...');

    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startRange = today.toISOString();
    const endRange = nextWeek.toISOString();

    const settled = await Promise.allSettled(
      EventFetcher.BRISTOL_EVENTBRITE_ORGANISERS.map(({ id, name }) =>
        axios.get(`https://www.eventbriteapi.com/v3/organizers/${id}/events/`, {
          params: {
            status: 'live',
            'start_date.range_start': startRange,
            'start_date.range_end': endRange,
            expand: 'venue',
          },
          headers: { 'Authorization': `Bearer ${this.eventbriteApiKey}` }
        }).then(r => ({ organiserName: name, events: r.data.events || [] }))
      )
    );

    const events = [];
    for (const result of settled) {
      if (result.status === 'rejected') {
        console.error('Eventbrite organiser fetch failed:', result.reason?.message);
        continue;
      }
      const { organiserName, events: orgEvents } = result.value;
      for (const event of orgEvents) {
        events.push({
          id: `eventbrite-${event.id}`,
          source: 'eventbrite',
          name: event.name?.text || null,
          description: event.description?.text || '',
          date: event.start?.utc || event.start?.local,
          venue: event.venue?.name || organiserName,
          cost: this.extractEventbriteCost(event),
          url: event.url,
          image: event.logo?.original?.url || null,
          status: this.extractEventbriteStatus(event)
        });
      }
    }

    console.log(`Eventbrite: ${events.length} events from ${EventFetcher.BRISTOL_EVENTBRITE_ORGANISERS.length} organisers`);
    return events.filter(e => e.name);
  }

  extractEventbriteCost(event) {
    if (event.is_free) return 'Free';
    return 'Price TBA';
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
      }))
        .filter(event => event.name)
        .filter(event => !this.isTicketmasterFootballFixture(event));
    } catch (error) {
      console.error('Ticketmaster API error:', error.message);
      return [];
    }
  }

  // Ticketmaster football fixture data is unreliable — opponents and dates are
  // often wrong. We scrape ashtongatestadium.co.uk and bristolrovers.co.uk for
  // authoritative fixture data instead.
  isTicketmasterFootballFixture(event) {
    const FOOTBALL_GROUNDS = ['ashton gate', 'memorial stadium'];
    const venueLower = (event.venue || '').toLowerCase();
    const isFootballGround = FOOTBALL_GROUNDS.some(g => venueLower.includes(g));
    const isFixture = /\b(?:v|vs|versus)\b/i.test(event.name || '');
    return isFootballGround && isFixture;
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

  // Venues API lookup + targeted events query for Bristol Hippodrome.
  // ATG sells concerts/comedy through Ticketmaster but not all their shows.
  // The city-wide query may miss Hippodrome events if the result set is large,
  // so this dedicated query guarantees we capture everything ATG lists on TM.
  async fetchTicketmasterHippodromeEvents() {
    if (!this.ticketmasterApiKey) return [];

    try {
      // Step 1: resolve the API-format venue ID dynamically
      const venueRes = await axios.get('https://app.ticketmaster.com/discovery/v2/venues.json', {
        params: {
          apikey: this.ticketmasterApiKey,
          keyword: 'Bristol Hippodrome',
          countryCode: 'GB',
          size: 5
        }
      });

      const venues = venueRes.data?._embedded?.venues || [];
      const hippodrome = venues.find(v =>
        v.name?.toLowerCase().includes('hippodrome') &&
        v.city?.name?.toLowerCase() === 'bristol'
      );

      if (!hippodrome) {
        console.log('Ticketmaster Hippodrome: venue not found, skipping');
        return [];
      }

      // Step 2: fetch events at that venue for the next 7 days
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const eventsRes = await axios.get('https://app.ticketmaster.com/discovery/v2/events.json', {
        params: {
          apikey: this.ticketmasterApiKey,
          venueId: hippodrome.id,
          startDateTime: today.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          endDateTime: nextWeek.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          size: 100,
          sort: 'date,asc'
        }
      });

      const events = eventsRes.data?._embedded?.events || [];
      console.log(`Ticketmaster Hippodrome: ${events.length} events`);

      return events.map(event => ({
        id: `ticketmaster-${event.id}`,
        source: 'ticketmaster',
        name: event.name,
        description: event.info || event.pleaseNote || '',
        date: event.dates?.start?.dateTime || event.dates?.start?.localDate,
        venue: event._embedded?.venues?.[0]?.name || 'Bristol Hippodrome',
        cost: this.extractTicketmasterCost(event),
        url: event.url,
        image: this.extractTicketmasterImage(event),
        status: this.extractTicketmasterStatus(event)
      })).filter(e => e.name);
    } catch (err) {
      console.error('Ticketmaster Hippodrome fetch failed:', err.message);
      return [];
    }
  }

  async fetchAll() {
    const [skiddle, eventbrite, ticketmaster, hippodrome] = await Promise.all([
      this.fetchSkiddleEvents(),
      this.fetchEventbriteEvents(),
      this.fetchTicketmasterEvents(),
      this.fetchTicketmasterHippodromeEvents()
    ]);

    const total = skiddle.length + eventbrite.length + ticketmaster.length + hippodrome.length;
    console.log(`Fetched: ${skiddle.length} Skiddle, ${eventbrite.length} Eventbrite, ${ticketmaster.length} Ticketmaster, ${hippodrome.length} Hippodrome (${total} total)`);

    return [...skiddle, ...eventbrite, ...ticketmaster, ...hippodrome];
  }
}

module.exports = EventFetcher;
