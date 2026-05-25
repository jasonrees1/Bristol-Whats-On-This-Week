class HtmlGenerator {
  constructor() {
    this.categoryColors = {
      'Concert': '#1E90FF',
      'Festival': '#FF69B4',
      'Theater': '#9B59B6',
      'Sports': '#2ECC71',
      'Art': '#E74C3C',
      'Food': '#E67E22',
      'Family': '#FF69B4',
      'Nightlife': '#2C3E50',
      'Conference': '#95A5A6',
      'Tour': '#A0826D',
      'Market': '#F39C12',
      'Other': '#7F8C8D'
    };

    this.mainCategories = ['Concert', 'Food', 'Sports', 'Theater', 'Art'];
    this.additionalCategories = ['Festival', 'Family', 'Nightlife', 'Conference', 'Tour', 'Market', 'Other'];
  }

  generate(events) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>What's On in Bristol This Week</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #f8f9fa;
          color: #333;
        }

        header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        header h1 { font-size: 2.5em; margin-bottom: 5px; }
        header p { font-size: 0.9em; opacity: 0.9; }

        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }

        /* Day Selector */
        .day-selector {
          display: flex;
          gap: 10px;
          margin: 30px 0;
          flex-wrap: wrap;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .day-btn {
          padding: 12px 20px;
          border: 2px solid #ddd;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1em;
          font-weight: 500;
          transition: all 0.3s ease;
          min-width: 100px;
          text-align: center;
        }

        .day-btn:hover { border-color: #667eea; color: #667eea; }
        .day-btn.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }
        .day-btn.today {
          border-color: #ff6b6b;
        }
        .day-badge {
          display: inline-block;
          background: #ff6b6b;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.7em;
          margin-left: 5px;
        }

        /* Category Filters */
        .category-filters {
          background: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .filter-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .filter-row:last-child { margin-bottom: 0; }

        .category-btn {
          padding: 10px 16px;
          border: 2px solid #ddd;
          background: white;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.9em;
          font-weight: 500;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .category-btn:hover { transform: translateY(-2px); }
        .category-btn.active {
          color: white;
          border-color: transparent;
        }

        /* Events Grid */
        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }

        .event-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }

        .event-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .event-content {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .event-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .event-time {
          font-size: 0.85em;
          font-weight: 600;
          color: #667eea;
        }

        .event-category {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75em;
          font-weight: 600;
          color: white;
          margin-left: auto;
        }

        .event-name {
          font-size: 1.3em;
          font-weight: bold;
          color: #333;
          margin: 10px 0;
          line-height: 1.3;
        }

        .event-meta {
          color: #666;
          font-size: 0.9em;
          margin: 8px 0;
          line-height: 1.5;
        }

        .event-meta-item {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
        }

        .event-meta-item:last-child { margin-bottom: 0; }

        .event-description {
          color: #555;
          font-size: 0.9em;
          margin: 12px 0;
          flex: 1;
          line-height: 1.5;
        }

        .event-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }

        .btn {
          flex: 1;
          padding: 10px 15px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9em;
          font-weight: 600;
          transition: all 0.3s ease;
          text-decoration: none;
          text-align: center;
          display: inline-block;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }
        .btn-primary:hover { background: #5568d3; }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #ddd;
        }
        .btn-secondary:hover { background: #e8e8e8; }

        /* Status badges */
        .event-card-wrapper {
          position: relative;
        }
        .status-banner {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 0.78em;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          z-index: 10;
          pointer-events: none;
        }
        .status-cancelled {
          background: #e74c3c;
          color: white;
        }
        .status-sold_out {
          background: #e67e22;
          color: white;
        }
        .status-postponed {
          background: #95a5a6;
          color: white;
        }
        .status-rescheduled {
          background: #8e44ad;
          color: white;
        }
        .status-off_sale {
          background: #95a5a6;
          color: white;
        }
        .event-card.is-cancelled {
          opacity: 0.6;
          filter: grayscale(60%);
        }
        .event-card.is-cancelled .btn-primary {
          background: #aaa;
          pointer-events: none;
        }
        .event-card.is-sold_out .btn-primary {
          background: #aaa;
          pointer-events: none;
          cursor: not-allowed;
        }

        .no-events {
          text-align: center;
          padding: 40px 20px;
          background: white;
          border-radius: 12px;
          color: #999;
        }

        .no-events p { font-size: 1.1em; margin-bottom: 10px; }

        footer {
          background: #2c3e50;
          color: white;
          text-align: center;
          padding: 20px;
          margin-top: 40px;
          font-size: 0.9em;
        }

        @media (max-width: 768px) {
          header h1 { font-size: 1.8em; }
          .day-selector { gap: 8px; }
          .day-btn { min-width: 80px; padding: 10px 15px; font-size: 0.9em; }
          .events-grid {
            grid-template-columns: 1fr;
          }
          .event-actions {
            flex-direction: column;
          }
        }
    </style>
</head>
<body>
    <header>
        <h1>🎭 What's On in Bristol This Week</h1>
        <p>Last updated: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </header>

    <div class="container">
        <!-- Day Selector -->
        <div class="day-selector" id="daySelector">
            ${this.generateDaySelectors()}
        </div>

        <!-- Category Filters -->
        <div class="category-filters">
          <div class="filter-row">
            ${this.generateCategoryButtons('main')}
          </div>
          <div class="filter-row">
            ${this.generateCategoryButtons('additional')}
          </div>
        </div>

        <!-- Events Display -->
        <div id="eventsContainer">
            ${events.length === 0 ?
              '<div class="no-events"><p>No events found for this week.</p></div>' :
              this.generateEventCards(events)
            }
        </div>
    </div>

    <footer>
        <p>Bristol What's On - Updated every Saturday at 10 AM UTC</p>
    </footer>

    <script>
        var events = ${JSON.stringify(events)};
        var eventsById = {};
        events.forEach(function(e) { eventsById[e.id] = e; });

        var selectedDay = new Date().toISOString().split('T')[0];
        var selectedCategories = {'Concert':1,'Festival':1,'Theater':1,'Sports':1,'Art':1,'Food':1,'Family':1,'Nightlife':1,'Conference':1,'Tour':1,'Market':1,'Other':1};

        var categoryColors = ${JSON.stringify(this.categoryColors)};

        function h(str) {
          return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        }

        function getDateKey(ds) {
          var d = new Date(ds);
          return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        }

        function darkenColor(color) {
          var num = parseInt(color.replace('#', ''), 16);
          var amt = Math.round(2.55 * -20);
          return '#' + (0x1000000 +
            (Math.max(0, Math.min(255, (num >> 16) + amt)) << 16) +
            (Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt)) << 8) +
            Math.max(0, Math.min(255, (num & 0x0000FF) + amt))).toString(16).slice(1);
        }

        function renderEventCard(ev) {
          var cc = categoryColors[ev.category] || '#7F8C8D';
          var imgHtml = ev.image
            ? '<img src="' + h(ev.image) + '" alt="' + h(ev.name) + '" class="event-image">'
            : '<div class="event-image" style="background:linear-gradient(135deg,' + cc + ' 0%,' + darkenColor(cc) + ' 100%);"></div>';
          var d = new Date(ev.date);
          var timeStr = isNaN(d.getTime()) ? 'Time TBA' : d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
          var status = ev.status || null;
          var statusMap = {cancelled:'Cancelled', sold_out:'Sold Out', postponed:'Postponed', rescheduled:'Rescheduled', off_sale:'Off Sale'};
          var banner = status ? '<div class="status-banner status-' + status + '">' + (statusMap[status] || status) + '</div>' : '';
          var cardCls = status ? ' is-' + status : '';
          var btn;
          if (status === 'cancelled') {
            btn = '<span class="btn btn-primary" style="cursor:default;">Cancelled</span>';
          } else if (status === 'sold_out') {
            btn = '<span class="btn btn-primary" style="cursor:default;">Sold Out</span>';
          } else {
            btn = '<a href="' + h(ev.url) + '" target="_blank" class="btn btn-primary">Learn More</a>';
          }
          var desc = ev.description ? (ev.description.length > 150 ? ev.description.substring(0, 150) + '...' : ev.description) : '';
          return '<div class="event-card-wrapper" style="position:relative;">' +
            banner +
            '<div class="event-card' + cardCls + '">' +
              imgHtml +
              '<div class="event-content">' +
                '<div class="event-header">' +
                  '<div class="event-time">🕐 ' + timeStr + '</div>' +
                  '<span class="event-category" style="background-color:' + cc + ';">' + h(ev.category || 'Other') + '</span>' +
                '</div>' +
                '<div class="event-name">' + h(ev.name) + '</div>' +
                '<div class="event-meta">' +
                  '<div class="event-meta-item">📍 ' + h(ev.venue || 'Venue TBA') + '</div>' +
                  (ev.cost ? '<div class="event-meta-item">💷 ' + h(ev.cost) + '</div>' : '') +
                '</div>' +
                (desc ? '<div class="event-description">' + h(desc) + '</div>' : '') +
                '<div class="event-actions">' +
                  btn +
                  '<button class="btn btn-secondary" onclick="addEventToCalendar(\\'' + h(ev.id) + '\\')">&#128197; Add to Calendar</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }

        function filterAndDisplayEvents() {
          var container = document.getElementById('eventsContainer');
          try {
            var filtered = events.filter(function(ev) {
              return selectedCategories[ev.category] && getDateKey(ev.date) === selectedDay;
            });
            if (filtered.length === 0) {
              container.innerHTML = '<div class="no-events"><p>No events found for this day and category selection.</p></div>';
            } else {
              container.innerHTML = filtered.map(renderEventCard).join('');
            }
          } catch(err) {
            container.innerHTML = '<div class="no-events"><p>Error loading events: ' + h(err.message) + '</p></div>';
            console.error('filterAndDisplayEvents error:', err);
          }
        }

        function addEventToCalendar(eventId) {
          var ev = eventsById[eventId];
          if (!ev) return;
          var startDate = new Date(ev.date);
          var endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
          var ical = 'BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nPRODID:-//Bristol Events//EN\\r\\nBEGIN:VEVENT\\r\\n' +
            'UID:' + ev.id + '\\r\\n' +
            'DTSTART:' + startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z\\r\\n' +
            'DTEND:' + endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z\\r\\n' +
            'SUMMARY:' + (ev.name || '') + '\\r\\n' +
            'DESCRIPTION:' + (ev.description || '') + '\\r\\n' +
            'LOCATION:' + (ev.venue || '') + '\\r\\n' +
            'END:VEVENT\\r\\nEND:VCALENDAR';
          var link = document.createElement('a');
          link.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ical);
          link.download = (ev.name || 'event') + '.ics';
          link.click();
        }

        document.querySelectorAll('.day-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            document.querySelectorAll('.day-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            selectedDay = this.dataset.date;
            filterAndDisplayEvents();
          });
        });

        document.querySelectorAll('.category-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var category = this.dataset.category;
            if (selectedCategories[category]) {
              delete selectedCategories[category];
              this.classList.remove('active');
            } else {
              selectedCategories[category] = 1;
              this.classList.add('active');
            }
            filterAndDisplayEvents();
          });
        });

        // Show today's events on load
        var todayKey = new Date().toISOString().split('T')[0];
        var todayBtn = document.querySelector('[data-date="' + todayKey + '"]');
        if (todayBtn) { todayBtn.classList.add('active'); }
        filterAndDisplayEvents();
    </script>
</body>
</html>
    `;
    return html;
  }

  generateDaySelectors() {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      days.push(`
        <button class="day-btn ${isToday ? 'today' : ''}" data-date="${dateStr}">
          ${dayName}
          ${isToday ? '<span class="day-badge">Today</span>' : ''}
        </button>
      `);
    }
    return days.join('');
  }

  generateCategoryButtons(type) {
    const categories = type === 'main' ? this.mainCategories : this.additionalCategories;
    return categories.map(cat => `
      <button class="category-btn active" data-category="${cat}" style="border-color: ${this.categoryColors[cat]}; color: ${this.categoryColors[cat]};">
        ${cat}
      </button>
    `).join('');
  }

  generateEventCards(events) {
    return events.map(event => this.generateEventCard(event)).join('');
  }

  renderEvent(event) {
    return this.generateEventCard(event);
  }

  generateEventCard(event) {
    const categoryColor = this.categoryColors[event.category] || '#7F8C8D';
    const imageHtml = event.image ? `<img src="${event.image}" alt="${event.name}" class="event-image">` : `<div class="event-image" style="background: linear-gradient(135deg, ${categoryColor} 0%, ${this.darkenColor(categoryColor)} 100%);"></div>`;
    const timeDisplay = event.date ? new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Date TBA';
    const status = event.status || null;
    const statusLabels = { cancelled: 'Cancelled', sold_out: 'Sold Out', postponed: 'Postponed', rescheduled: 'Rescheduled', off_sale: 'Off Sale' };
    const statusBanner = status ? `<div class="status-banner status-${status}">${statusLabels[status] || status}</div>` : '';
    const cardClass = status ? ` is-${status}` : '';
    const learnMoreBtn = status === 'cancelled'
      ? `<span class="btn btn-primary" style="cursor:default;">Cancelled</span>`
      : status === 'sold_out'
        ? `<span class="btn btn-primary" style="cursor:default;">Sold Out</span>`
        : `<a href="${event.url}" target="_blank" class="btn btn-primary">Learn More</a>`;

    return `
      <div class="event-card-wrapper" style="position:relative;">
        ${statusBanner}
        <div class="event-card${cardClass}">
          ${imageHtml}
          <div class="event-content">
            <div class="event-header">
              <div class="event-time">🕐 ${timeDisplay}</div>
              <span class="event-category" style="background-color: ${categoryColor};">${event.category || 'Other'}</span>
            </div>
            <div class="event-name">${event.name}</div>
            <div class="event-meta">
              <div class="event-meta-item">📍 ${event.venue || 'Venue TBA'}</div>
              ${event.cost ? `<div class="event-meta-item">💷 ${event.cost}</div>` : ''}
            </div>
            ${event.description ? `<div class="event-description">${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}</div>` : ''}
            <div class="event-actions">
              ${learnMoreBtn}
              <button class="btn btn-secondary" onclick="addEventToCalendar(${JSON.stringify(event).replace(/"/g, '&quot;')})">📅 Add to Calendar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  darkenColor(color) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * -20);
    return "#" + (0x1000000 + (Math.max(0, Math.min(255, (num >> 16) + amt)) << 16) +
      (Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt)) << 8) +
      Math.max(0, Math.min(255, (num & 0x0000FF) + amt))).toString(16).slice(1);
  }
}

module.exports = HtmlGenerator;

