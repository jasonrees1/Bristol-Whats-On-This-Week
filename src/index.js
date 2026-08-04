const EventFetcher = require('./fetchers/eventFetcher');
const ArnolfiniFetcher = require('./fetchers/arnolfiniFetcher');
const Ents24Fetcher = require('./fetchers/ents24Fetcher');
const { HeadfirstFetcher } = require('./fetchers/headfirstFetcher');
const { StGeorgesFetcher } = require('./fetchers/stGeorgesFetcher');
const { WatershedFetcher } = require('./fetchers/watershedFetcher');
const { WethecuriousFetcher } = require('./fetchers/wethecuriousFetcher');
const ManualFetcher = require('./fetchers/manualFetcher');
const DataProcessor = require('./processors/dataProcessor');
const HtmlGenerator = require('./generator/htmlGenerator');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    console.log('Starting event fetch for Bristol...');

    const manualEvents = new ManualFetcher().fetchEvents();

    const [apiEvents, arnolfiniEvents, ents24Events, headfirstEvents, stGeorgesEvents, watershedEvents, wtcEvents] = await Promise.all([
      new EventFetcher().fetchAll(),
      new ArnolfiniFetcher().fetchEvents(),
      new Ents24Fetcher().fetchEvents(),
      new HeadfirstFetcher().fetchEvents(),
      new StGeorgesFetcher().fetchEvents(),
      new WatershedFetcher().fetchEvents(),
      new WethecuriousFetcher().fetchEvents()
    ]);

    const rawEvents = [...manualEvents, ...apiEvents, ...arnolfiniEvents, ...ents24Events, ...headfirstEvents, ...stGeorgesEvents, ...watershedEvents, ...wtcEvents];
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
