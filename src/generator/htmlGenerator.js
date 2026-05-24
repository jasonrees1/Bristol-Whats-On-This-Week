class HtmlGenerator {
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
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        header { background: #ff6b35; color: white; padding: 20px; text-align: center; }
        h1 { font-size: 2em; }
        .container { max-width: 1200px; margin: 20px auto; padding: 0 20px; }
        .event { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .event-title { font-size: 1.3em; font-weight: bold; color: #333; }
        .event-meta { color: #666; margin: 10px 0; font-size: 0.95em; }
        .event-category { display: inline-block; background: #ff6b35; color: white; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; margin: 5px 5px 5px 0; }
        .event-description { color: #555; margin: 10px 0; line-height: 1.5; }
        footer { background: #333; color: white; text-align: center; padding: 20px; margin-top: 40px; }
    </style>
</head>
<body>
    <header>
        <h1>🎭 What's On in Bristol This Week</h1>
        <p>Updated: ${new Date().toLocaleDateString()}</p>
    </header>

    <div class="container">
        ${events.length === 0 ? '<p>No events found for this week.</p>' : ''}
        ${events.map(event => this.renderEvent(event)).join('')}
    </div>

    <footer>
        <p>Bristol What's On - Updated Weekly</p>
    </footer>
</body>
</html>
    `;
    return html;
  }

  renderEvent(event) {
    return `
      <div class="event">
          <div class="event-title">${event.name || 'Untitled Event'}</div>
          <div class="event-meta">
              📍 ${event.venue || 'Venue TBA'} | 🕐 ${event.date || 'Date TBA'}
              ${event.cost ? `| 💷 ${event.cost}` : ''}
          </div>
          <div><span class="event-category">${event.category || 'Other'}</span></div>
          ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
      </div>
    `;
  }
}

module.exports = HtmlGenerator;
