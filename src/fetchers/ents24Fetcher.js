const axios = require('axios');

class Ents24Fetcher {
  constructor() {
    this.clientId = process.env.ENTS24_CLIENT_ID;
    this.clientSecret = process.env.ENTS24_CLIENT_SECRET;
  }

  async _getAccessToken() {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    const response = await axios.post('https://api.ents24.com/auth/token', params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
  }

  async fetchEvents() {
    if (!this.clientId || !this.clientSecret) {
      console.log('Ents24 credentials not configured, skipping...');
      return [];
    }

    try {
      console.log('Fetching from Ents24 API...');
      const token = await this._getAccessToken();

      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dateFrom = today.toISOString().split('T')[0];
      const dateTo = nextWeek.toISOString().split('T')[0];

      const response = await axios.get('https://api.ents24.com/event/list', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          location: 'name:Bristol',
          date_from: dateFrom,
          date_to: dateTo,
          results_per_page: 100,
          incl_image: 1,
          image_size: 'medium',
          incl_tickets: 1
        }
      });

      // API may return array directly or wrap in a data property
      const raw = response.data;
      const items = Array.isArray(raw) ? raw
        : Array.isArray(raw?.data) ? raw.data
        : Object.values(raw || {}).filter(v => typeof v === 'object' && v !== null && v.id);

      const events = items.map(event => ({
        id: `ents24-${event.id}`,
        source: 'ents24',
        name: event.title || event.name || null,
        description: event.description || '',
        date: event.startDateTime || event.start_date || event.startDate || null,
        venue: event.venue?.name || 'Venue TBA',
        cost: this._extractCost(event),
        url: event.webLink || event.web_link || `https://www.ents24.com/event/${event.id}`,
        image: event.images?.[0]?.url || event.image?.url || null,
        status: null
      })).filter(e => e.name);

      console.log(`Ents24: ${events.length} Bristol events`);
      return events;
    } catch (error) {
      console.error('Ents24 API error:', error.message);
      return [];
    }
  }

  _extractCost(event) {
    const prices = event.ticketPrices || event.ticket_prices || event.prices;
    if (!prices) return 'Price TBA';
    const from = parseFloat(prices.from ?? prices.min ?? NaN);
    const to = parseFloat(prices.to ?? prices.max ?? NaN);
    if (isNaN(from) && isNaN(to)) return 'Price TBA';
    if (from === 0 && (isNaN(to) || to === 0)) return 'Free';
    if (!isNaN(from) && !isNaN(to) && from !== to) return `£${from} - £${to}`;
    if (!isNaN(from)) return `£${from}`;
    return 'Price TBA';
  }
}

module.exports = Ents24Fetcher;
