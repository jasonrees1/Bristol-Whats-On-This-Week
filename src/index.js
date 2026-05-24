const EventFetcher = require('./fetchers/eventFetcher');
const DataProcessor = require('./processors/dataProcessor');
const HtmlGenerator = require('./generator/htmlGenerator');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('Starting event fetch for Bristol...');

    // Fetch events from APIs
    const fetcher = new EventFetcher();
    const rawEvents = await fetcher.fetchAll();
    console.log(`Fetched ${rawEvents.length} raw events`);

    // Process and filter events
    const processor = new DataProcessor();
    const processedEvents = processor.process(rawEvents);
    console.log(`Processed to ${processedEvents.length} events`);

    // Generate HTML
    const generator = new HtmlGenerator();
    const html = generator.generate(processedEvents);

    // Save to file
    const outputPath = path.join(__dirname, '../index.html');
    fs.writeFileSync(outputPath, html);
    console.log(`HTML generated at ${outputPath}`);

    process.exit(0);
  } catch (error) {
    console.error('Error during event fetch:', error);
    process.exit(1);
  }
}

main();
