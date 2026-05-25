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
        const events = ${JSON.stringify(events)};
        let selectedDay = new Date().toISOString().split('T')[0];
        let selectedCategories = new Set(['Concert', 'Festival', 'Theater', 'Sports', 'Art', 'Food', 'Family', 'Nightlife', 'Conference', 'Tour', 'Market', 'Other']);

        function getDateKey(dateString) {
          return new Date(dateString).toISOString().split('T')[0];
        }

        function getDayName(dateString) {
          const date = new Date(dateString + 'T00:00:00Z');
          return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' });
        }

        function filterAndDisplayEvents() {
          const filtered = events.filter(event => {
            const eventDay = getDateKey(event.date);
            const categoryMatch = selectedCategories.has(event.category);
            const dayMatch = eventDay === selectedDay;
            return categoryMatch && dayMatch;
          });

          const container = document.getElementById('eventsContainer');
          if (filtered.length === 0) {
            container.innerHTML = '<div class="no-events"><p>No events found for this day and category selection.</p></div>';
          } else {
            container.innerHTML = filtered.map(e => this.generateEventCard(e)).join('');
          }
        }

        function addEventToCalendar(event) {
          const startDate = new Date(event.date);
          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

          const ical = 'BEGIN:VCALENDAR\\nVERSION:2.0\\nPRODID:-//Bristol Events//EN\\nBEGIN:VEVENT\\nUID:' + event.id + '\\nDTSTART:' + startDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z\\nDTEND:' + endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z\\nSUMMARY:' + event.name + '\\nDESCRIPTION:' + (event.description || '') + '\\nLOCATION:' + event.venue + '\\nEND:VEVENT\\nEND:VCALENDAR';

          const link = document.createElement('a');
          link.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ical);
          link.download = event.name + '.ics';
          link.click();
        }

        document.querySelectorAll('.day-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedDay = this.dataset.date;
            filterAndDisplayEvents();
          });
        });

        document.querySelectorAll('.category-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const category = this.dataset.category;
            if (selectedCategories.has(category)) {
              selectedCategories.delete(category);
              this.classList.remove('active');
            } else {
              selectedCategories.add(category);
              this.classList.add('active');
            }
            filterAndDisplayEvents();
          });
        });

        // Set today as active day on load
        const today = new Date().toISOString().split('T')[0];
        document.querySelector('[data-date="' + today + '"]')?.classList.add('active');
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

  generateEventCard(event) {
    const categoryColor = this.categoryColors[event.category] || '#7F8C8D';
    const imageHtml = event.image ? `<img src="${event.image}" alt="${event.name}" class="event-image">` : `<div class="event-image" style="background: linear-gradient(135deg, ${categoryColor} 0%, ${this.darkenColor(categoryColor)} 100%);"></div>`;

    return `
      <div class="event-card">
        ${imageHtml}
        <div class="event-content">
          <div class="event-header">
            <div class="event-time">🕐 ${new Date(event.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            <span class="event-category" style="background-color: ${categoryColor};">${event.category}</span>
          </div>
          <div class="event-name">${event.name}</div>
          <div class="event-meta">
            <div class="event-meta-item">📍 ${event.venue}</div>
            ${event.cost ? `<div class="event-meta-item">💷 ${event.cost}</div>` : ''}
          </div>
          ${event.description ? `<div class="event-description">${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}</div>` : ''}
          <div class="event-actions">
            <a href="${event.url}" target="_blank" class="btn btn-primary">Learn More</a>
            <button class="btn btn-secondary" onclick="addEventToCalendar(${JSON.stringify(event).replace(/"/g, '&quot;')})">📅 Add to Calendar</button>
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

