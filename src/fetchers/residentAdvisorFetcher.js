const axios = require('axios');

// Resident Advisor is a Next.js SSR app — event data lives in __NEXT_DATA__ JSON
// embedded in the server-rendered HTML. We extract it directly, bypassing the
// JavaScript cookie banner that appears in browsers.
class ResidentAdvisorFetcher {
  async fetchEvents(now = new Date()) {
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      const response = await axios.get('https://ra.co/events/gb/bristol', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9'
        },
        timeout: 20000
      });

      const html = response.data || '';
      console.log(`Resident Advisor: fetched events page (${html.length} bytes)`);

      const events = this._parseNextData(html, now, endDate);
      console.log(`Resident Advisor: ${events.length} events this week`);
      return events;
    } catch (err) {
      console.error('Resident Advisor fetch failed:', err.message);
      return [];
    }
  }

  _parseNextData(html, now, endDate) {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    if (!m) {
      console.log('Resident Advisor: no __NEXT_DATA__ found — site may have changed');
      return [];
    }

    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      console.error('Resident Advisor: JSON parse error:', e.message);
      return [];
    }

    const pageProps = data.props?.pageProps || {};

    // Try known RA data paths (structure can vary by build)
    const listings =
      pageProps.data?.eventListings?.data ||
      pageProps.eventListings?.data ||
      pageProps.initialData?.eventListings?.data ||
      [];

    if (!Array.isArray(listings) || !listings.length) {
      console.log('Resident Advisor: no listings found. pageProps keys:', Object.keys(pageProps).join(', '));
      return [];
    }

    return listings
      .filter(listing => {
        const d = new Date(listing.startTime);
        return !isNaN(d.getTime()) && d >= now && d <= endDate;
      })
      .map(listing => this._mapEvent(listing))
      .filter(e => e.name);
  }

  _mapEvent(listing) {
    const ev = listing.event || {};
    const images = ev.images || [];
    const img = images.find(i => /FLYER_FRONT|main/i.test(i.type || '')) || images[0];
    const imgUrl = img?.filename
      ? (img.filename.startsWith('http') ? img.filename : `https://images.ra.co/${img.filename}`)
      : null;

    return {
      id: `ra-${listing.id}`,
      source: 'residentadvisor',
      name: ev.title || ev.name || '',
      description: ev.content || ev.blurb || '',
      date: listing.startTime,
      venue: ev.venue?.name || 'Venue TBA',
      cost: 'Price TBA',
      url: `https://ra.co/events/${listing.id}`,
      image: imgUrl,
      status: null
    };
  }
}

module.exports = { ResidentAdvisorFetcher };
