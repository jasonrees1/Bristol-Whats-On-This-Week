class HtmlGenerator {
  generate(events) {
    const eventsJson = JSON.stringify(events);
    const generatedOn = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What's On in Bristol This Week</title>
  <style>${this._css()}</style>
</head>
<body>

<header class="site-header">
  <div class="header-brand">
    <span class="brand-city">Bristol</span>
    <h1 class="brand-title">What's On</h1>
  </div>
  <div class="header-right">
    <span class="week-label" id="weekLabel"></span>
    <button class="theme-toggle" id="themeBtn">Light</button>
  </div>
</header>

<nav class="day-strip" aria-label="Browse by day">
  <div class="day-tabs" id="dayTabs"></div>
</nav>

<div class="cat-strip" role="group" aria-label="Filter by category">
  <div class="cat-pills" id="catPills"></div>
</div>

<div class="coverage-bar" id="coverageBar">
  <button class="coverage-toggle" id="coverageToggle" aria-expanded="false" aria-controls="coverageBody">
    <span class="coverage-icon">ⓘ</span>
    <span class="coverage-label">About this guide &amp; coverage gaps</span>
    <span class="coverage-caret">›</span>
  </button>
  <div class="coverage-body" id="coverageBody" role="region" aria-label="Coverage information">
    <div class="coverage-content">
      <div class="coverage-col">
        <h4 class="coverage-col-title">What we cover</h4>
        <ul class="coverage-list">
          <li>Ticketed gigs &amp; concerts — Headfirst, Resident Advisor, Skiddle, Ticketmaster</li>
          <li>Club nights &amp; electronic music — Resident Advisor, Headfirst</li>
          <li>Rock, pop, folk, jazz &amp; comedy — Bristol Beacon</li>
          <li>Theatre &amp; comedy — Bristol Old Vic, Bristol Hippodrome, Ticketmaster</li>
          <li>Arts, film &amp; science — Arnolfini, Watershed, We The Curious</li>
          <li>Classical, folk &amp; world music — St George's Bristol, Bristol Beacon</li>
          <li>Bristol City FC home fixtures — Ashton Gate Stadium (official source)</li>
          <li>Independent &amp; community events — Eventbrite, Headfirst</li>
        </ul>
      </div>
      <div class="coverage-col">
        <h4 class="coverage-col-title">What might be missing</h4>
        <ul class="coverage-list">
          <li><strong>Walk-in pub gigs</strong> — many Bristol pubs host bands without listing them on any platform; check the pub's own social media or give them a call</li>
          <li><strong>Mid-week additions</strong> — this guide refreshes every Saturday; events announced after that won't appear until next week's update</li>
          <li><strong>Bristol Rovers fixtures</strong> — Memorial Stadium is not yet integrated</li>
          <li><strong>Hyper-local events</strong> — open mics, community nights, and events advertised only by flyer or in Facebook groups</li>
          <li><strong>Private &amp; members-only events</strong> — not publicly listed</li>
        </ul>
      </div>
    </div>
    <p class="coverage-updated">Last updated: ${generatedOn} &middot; Refreshes every Saturday at 10 AM</p>
  </div>
</div>

<main class="main">
  <div class="top-heading" id="topHeading">
    <div class="day-heading">
      <h2 id="dayHeading">Today</h2>
      <span class="tally" id="tally"></span>
    </div>
  </div>
  <div id="eventsGrid"></div>
</main>

<footer class="site-footer">
  <strong>What's On Bristol</strong> &mdash; Updated every Saturday &middot;
  Sources: Ticketmaster &middot; Eventbrite &middot; Headfirst &middot; Resident Advisor &middot; Bristol Beacon &middot; Ashton Gate &middot; Bristol Old Vic &middot; Bristol Hippodrome &middot; St&nbsp;George's &middot; Watershed &middot; We The Curious &middot; Arnolfini
</footer>

<script>
var EVENTS = ${eventsJson};
// Normalise American/British spelling
EVENTS.forEach(function(ev) {
  if (ev.category === 'Theater') ev.category = 'Theatre';
});
${this._buildScript()}
</script>
</body>
</html>`;
  }

  _css() {
    return `
  /* ── Tokens: dark (default) ─────────────────────────────── */
  :root {
    --bg:        #0B1823;
    --strip:     #0F2236;
    --amber:     #CF9010;
    --amber-h:   #E8A81A;
    --ink:       #E4E0D8;
    --ink-2:     #6898BC;
    --mist:      #3A5E7E;
    --rule:      #172E46;
    --card-bd:   rgba(255,255,255,0.07);
    --card-sh:   0 2px 10px rgba(0,0,0,0.35);
    --card-sh-h: 0 10px 30px rgba(0,0,0,0.55);
    --cat-bg:    transparent;
    --cat-bd:    transparent;
  }

  /* ── Tokens: light ──────────────────────────────────────── */
  :root[data-theme="light"] {
    --bg:        #E8EEF6;
    --strip:     #FFFFFF;
    --amber:     #B87809;
    --amber-h:   #D4940E;
    --ink:       #1A2535;
    --ink-2:     #3D5168;
    --mist:      #8BA3BA;
    --rule:      #CDD6E6;
    --card-bd:   #CDD6E6;
    --card-sh:   0 1px 4px rgba(0,0,0,0.06);
    --card-sh-h: 0 6px 22px rgba(0,0,0,0.1);
    --cat-bg:    var(--bg);
    --cat-bd:    var(--rule);
  }

  /* ── Reset ──────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    transition: background 0.25s, color 0.25s;
  }
  a { color: inherit; text-decoration: none; }
  button { font-family: inherit; cursor: pointer; border: none; background: none; }
  button:focus-visible, a:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
    border-radius: 3px;
  }

  /* ── Header ─────────────────────────────────────────────── */
  .site-header {
    background: var(--strip);
    border-bottom: 1px solid var(--rule);
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    transition: background 0.25s, border-color 0.25s;
  }
  .header-brand { display: flex; align-items: baseline; gap: 10px; }
  .brand-city {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--amber);
  }
  .brand-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    font-weight: bold;
    color: var(--ink);
    line-height: 1;
  }
  .header-right { display: flex; align-items: center; gap: 14px; }
  .week-label {
    font-size: 13px;
    color: var(--ink-2);
    white-space: nowrap;
    display: none;
  }
  @media (min-width: 580px) { .week-label { display: block; } }
  .theme-toggle {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--mist);
    padding: 5px 10px;
    border: 1px solid var(--rule);
    border-radius: 6px;
    transition: border-color 0.15s, color 0.15s;
  }
  .theme-toggle:hover { border-color: var(--amber); color: var(--amber); }

  /* ── Day strip ──────────────────────────────────────────── */
  .day-strip {
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--strip);
    border-bottom: 2px solid var(--rule);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    transition: background 0.25s, border-color 0.25s;
  }
  .day-strip::-webkit-scrollbar { display: none; }
  .day-tabs { display: flex; min-width: max-content; }

  .day-tab {
    flex: 0 0 auto;
    min-width: 80px;
    padding: 12px 16px 10px;
    text-align: center;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    transition: border-color 0.18s;
    user-select: none;
  }
  @media (min-width: 600px) { .day-tab { min-width: 94px; padding: 12px 20px 10px; } }
  .week-tab { min-width: 96px; border-right: 1px solid var(--rule); }
  @media (min-width: 600px) { .week-tab { min-width: 110px; } }
  .day-tab:hover .tab-num { color: var(--amber-h); }
  .day-tab.active { border-bottom-color: var(--amber); }
  .day-tab.active .tab-num  { color: var(--amber); }
  .day-tab.active .tab-name { color: var(--ink-2); }

  .tab-name {
    display: block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--mist);
    margin-bottom: 2px;
    transition: color 0.18s;
  }
  .tab-num {
    display: block;
    font-family: Georgia, serif;
    font-size: 30px;
    font-weight: bold;
    line-height: 1;
    color: var(--ink-2);
    transition: color 0.18s;
  }
  .tab-count {
    display: block;
    font-family: "Courier New", Courier, monospace;
    font-size: 10px;
    color: var(--mist);
    margin-top: 3px;
  }

  /* ── Category strip ─────────────────────────────────────── */
  .cat-strip {
    background: var(--cat-bg);
    border-bottom: 1px solid var(--cat-bd);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    padding: 12px 20px;
    transition: background 0.25s;
  }
  .cat-strip::-webkit-scrollbar { display: none; }
  .cat-pills { display: flex; gap: 7px; min-width: max-content; }
  .cat-pill {
    padding: 5px 14px;
    border: 1.5px solid var(--rule);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-2);
    white-space: nowrap;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .cat-pill:hover { border-color: var(--ink-2); color: var(--ink); }
  .cat-pill.active { background: var(--amber); border-color: var(--amber); color: #fff; }

  /* ── Main ───────────────────────────────────────────────── */
  .main { max-width: 1240px; margin: 0 auto; padding: 26px 18px 64px; }
  @media (min-width: 640px) { .main { padding: 30px 26px 72px; } }

  .day-heading { display: flex; align-items: baseline; gap: 12px; margin-bottom: 22px; }
  .day-heading h2 { font-family: Georgia, serif; font-size: 24px; font-weight: bold; color: var(--ink); }
  .tally { font-family: "Courier New", monospace; font-size: 13px; color: var(--ink-2); }

  /* ── Grid ───────────────────────────────────────────────── */
  .events-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
  @media (min-width: 620px)  { .events-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 980px)  { .events-grid { grid-template-columns: repeat(3, 1fr); } }

  /* ── Card — always white ────────────────────────────────── */
  .event-card {
    background: #FFFFFF;
    border-radius: 10px;
    border: 1px solid var(--card-bd);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: var(--card-sh);
    transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
  }
  @media (prefers-reduced-motion: no-preference) {
    .event-card:hover {
      box-shadow: var(--card-sh-h);
      border-color: rgba(255,255,255,0.18);
      transform: translateY(-2px);
    }
  }

  .card-img {
    position: relative;
    width: 100%;
    padding-top: 54%;
    overflow: hidden;
  }
  .card-img > * { position: absolute; }
  .card-img img {
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
  }
  .card-time-badge {
    bottom: 10px; left: 12px;
    background: rgba(10,22,38,0.78);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: #E8E4DC;
    font-family: "Courier New", Courier, monospace;
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 0.03em;
    padding: 4px 9px;
    border-radius: 5px;
  }
  .card-status-badge {
    top: 10px; left: 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 4px;
    color: #fff;
  }

  .card-body { padding: 14px 15px 2px; display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .card-cat  { font-size: 10px; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; }
  .card-title { font-family: Georgia, serif; font-size: 17px; font-weight: bold; line-height: 1.3; color: #1A2535; text-wrap: balance; }
  .card-venue { font-size: 13px; color: #3D5168; }
  .card-price { font-family: "Courier New", monospace; font-size: 11.5px; color: #8BA3BA; }
  .card-desc  {
    font-size: 13px; line-height: 1.55; color: #3D5168; flex: 1;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }

  .card-footer { padding: 10px 15px 13px; }
  .card-cta {
    display: block; text-align: center;
    padding: 9px 14px;
    background: var(--amber); color: #fff;
    border-radius: 7px; font-size: 13.5px; font-weight: 600;
    transition: background 0.15s; width: 100%;
  }
  .card-cta:hover { background: var(--amber-h); }
  .card-cta.unavailable { background: #8BA3BA; opacity: 0.65; cursor: not-allowed; pointer-events: none; }

  /* ── Week-view sections ─────────────────────────────────── */
  .week-section { margin-bottom: 52px; }
  .week-section:last-child { margin-bottom: 0; }
  .week-section-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 14px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--rule);
  }
  .week-section-header h2 { font-family: Georgia, serif; font-size: 22px; font-weight: bold; color: var(--ink); }
  .week-section-header .tally { font-family: "Courier New", monospace; font-size: 13px; color: var(--ink-2); }

  /* ── No events ──────────────────────────────────────────── */
  .no-events { grid-column: 1 / -1; text-align: center; padding: 52px 24px; }
  .no-events-title { font-family: Georgia, serif; font-size: 19px; color: var(--ink-2); margin-bottom: 8px; }
  .no-events-sub   { font-size: 14px; color: var(--mist); }

  /* ── Footer ─────────────────────────────────────────────── */
  .site-footer {
    background: var(--strip);
    border-top: 1px solid var(--rule);
    padding: 16px 24px;
    text-align: center;
    font-size: 12px;
    color: var(--mist);
    line-height: 1.65;
    transition: background 0.25s;
    /* iOS home-bar clearance */
    padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
  }
  .site-footer strong { color: var(--ink-2); font-weight: 600; }

  /* ── Coverage bar ───────────────────────────────────────── */
  .coverage-bar {
    border-bottom: 1px solid var(--rule);
    background: var(--bg);
    transition: background 0.25s, border-color 0.25s;
  }
  .coverage-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--ink-2);
    text-align: left;
    min-height: 40px;
    transition: color 0.15s;
  }
  .coverage-toggle:hover { color: var(--amber); }
  .coverage-icon {
    font-size: 14px;
    line-height: 1;
    color: var(--amber);
    flex-shrink: 0;
  }
  .coverage-label { flex: 1; }
  .coverage-caret {
    font-size: 16px;
    color: var(--mist);
    transition: transform 0.25s ease;
    display: inline-block;
  }
  .coverage-bar.is-open .coverage-caret { transform: rotate(90deg); }

  .coverage-body {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.32s ease;
  }
  .coverage-body.open { max-height: 900px; }

  .coverage-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px 36px;
    padding: 4px 20px 14px;
  }
  @media (max-width: 560px) {
    .coverage-content { grid-template-columns: 1fr; gap: 18px; }
  }

  .coverage-col-title {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--amber);
    margin-bottom: 9px;
  }
  .coverage-list {
    list-style: none;
    padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 6px;
  }
  .coverage-list li {
    font-size: 12px;
    color: var(--ink-2);
    line-height: 1.5;
    padding-left: 14px;
    position: relative;
  }
  .coverage-list li::before { content: '·'; position: absolute; left: 0; color: var(--mist); }
  .coverage-list strong { color: var(--ink); font-weight: 600; }

  .coverage-updated {
    padding: 0 20px 14px;
    font-size: 11px;
    font-family: "Courier New", Courier, monospace;
    color: var(--mist);
    border-top: 1px solid var(--rule);
    margin-top: 4px;
    padding-top: 10px;
  }

  @media (max-width: 380px) {
    .coverage-toggle  { padding: 10px 14px; }
    .coverage-content { padding: 4px 14px 12px; }
    .coverage-updated { padding: 10px 14px 12px; }
  }

  /* ── Mobile & touch optimisation ───────────────────────── */
  /* Remove tap flash on iOS */
  * { -webkit-tap-highlight-color: transparent; }
  /* Prevent accidental horizontal page scroll */
  html, body { overflow-x: hidden; }

  /* Minimum 36–44 px touch targets */
  .cat-pill {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
  }
  .card-cta {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .theme-toggle { min-height: 36px; min-width: 44px; }

  /* Guard against very long event names causing layout breaks */
  .card-title { overflow-wrap: break-word; }
  .card-venue { overflow-wrap: break-word; white-space: normal; }

  /* Very small screens: iPhone SE 2nd gen (375 px), budget Androids (360 px) */
  @media (max-width: 380px) {
    .site-header  { height: 50px; padding: 0 14px; }
    .brand-title  { font-size: 17px; }
    .day-tab      { min-width: 68px; padding: 10px 12px 8px; }
    .tab-num      { font-size: 26px; }
    .cat-strip    { padding: 10px 14px; }
    .cat-pill     { font-size: 12px; padding: 5px 10px; }
    .main         { padding: 16px 12px 52px; }
    .day-heading h2             { font-size: 20px; }
    .week-section-header h2     { font-size: 19px; }
    .card-title                 { font-size: 15px; }
    .card-body                  { padding: 12px 13px 2px; }
    .card-footer                { padding: 8px 13px 11px; }
  }
    `;
  }

  _buildScript() {
    /* All browser-side JS. No ES6 template literals here — string concatenation only,
       so this method's own template literal needs no escaping. */
    return `
// ── Category colours & gradients ──────────────────────────────
var CC = {
  Concert:'#1D6FBF', Festival:'#7B2FBE', Theatre:'#B03060',
  Sports:'#1A7A4A', Art:'#C03A1D', Food:'#B06010',
  Family:'#0891B2', Nightlife:'#1E2A3A', Conference:'#5C6B7A',
  Tour:'#7B5E2A', Market:'#6B7A2A', Other:'#6B7280'
};
var CG = {
  Concert:   'linear-gradient(150deg,#04111E 0%,#0A2548 100%)',
  Festival:  'linear-gradient(150deg,#120618 0%,#34105A 100%)',
  Theatre:   'linear-gradient(150deg,#1C0612 0%,#580A2A 100%)',
  Sports:    'linear-gradient(150deg,#021008 0%,#073420 100%)',
  Art:       'linear-gradient(150deg,#1C0400 0%,#5A0E00 100%)',
  Food:      'linear-gradient(150deg,#130A00 0%,#4E2400 100%)',
  Family:    'linear-gradient(150deg,#020C18 0%,#034558 100%)',
  Nightlife: 'linear-gradient(150deg,#040406 0%,#0C0E16 100%)',
  Conference:'linear-gradient(150deg,#08101A 0%,#1A2A38 100%)',
  Tour:      'linear-gradient(150deg,#0A0602 0%,#2A1A06 100%)',
  Market:    'linear-gradient(150deg,#060A02 0%,#1A2A06 100%)',
  Other:     'linear-gradient(150deg,#0C0C0E 0%,#1C1C24 100%)'
};

// ── SVG illustrations ─────────────────────────────────────────
var _sa = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" aria-hidden="true" style="position:absolute;top:0;left:0;width:100%;height:100%"';
var ILLUS = {
  Concert:
    '<svg ' + _sa + '>' +
    '<rect x="18" y="32" width="13" height="36" rx="3" fill="rgba(255,255,255,.22)"/>' +
    '<rect x="38" y="16" width="13" height="68" rx="3" fill="rgba(255,255,255,.27)"/>' +
    '<rect x="58" y="24" width="13" height="52" rx="3" fill="rgba(255,255,255,.22)"/>' +
    '<rect x="78" y="8"  width="13" height="84" rx="3" fill="rgba(255,255,255,.31)"/>' +
    '<rect x="98" y="19" width="13" height="62" rx="3" fill="rgba(255,255,255,.22)"/>' +
    '<rect x="118" y="12" width="13" height="76" rx="3" fill="rgba(255,255,255,.27)"/>' +
    '<rect x="138" y="28" width="13" height="44" rx="3" fill="rgba(255,255,255,.22)"/>' +
    '<rect x="158" y="38" width="13" height="24" rx="3" fill="rgba(255,255,255,.17)"/>' +
    '</svg>',
  Festival:
    '<svg ' + _sa + '>' +
    '<g transform="translate(100,50)" stroke="rgba(255,255,255,.22)" stroke-width="2.5" stroke-linecap="round">' +
    '<line x1="0" y1="-42" x2="0" y2="-14"/>' +
    '<line x1="0" y1="14" x2="0" y2="42"/>' +
    '<line x1="-42" y1="0" x2="-14" y2="0"/>' +
    '<line x1="14" y1="0" x2="42" y2="0"/>' +
    '<line x1="-30" y1="-30" x2="-10" y2="-10"/>' +
    '<line x1="10" y1="10" x2="30" y2="30"/>' +
    '<line x1="30" y1="-30" x2="10" y2="-10"/>' +
    '<line x1="-10" y1="10" x2="-30" y2="30"/>' +
    '</g>' +
    '<circle cx="100" cy="50" r="9" fill="rgba(255,255,255,.3)"/>' +
    '<circle cx="100" cy="8"  r="3" fill="rgba(255,255,255,.38)"/>' +
    '<circle cx="100" cy="92" r="3" fill="rgba(255,255,255,.38)"/>' +
    '<circle cx="58"  cy="50" r="3" fill="rgba(255,255,255,.38)"/>' +
    '<circle cx="142" cy="50" r="3" fill="rgba(255,255,255,.38)"/>' +
    '<circle cx="71"  cy="21" r="2.5" fill="rgba(255,255,255,.32)"/>' +
    '<circle cx="129" cy="79" r="2.5" fill="rgba(255,255,255,.32)"/>' +
    '<circle cx="129" cy="21" r="2.5" fill="rgba(255,255,255,.32)"/>' +
    '<circle cx="71"  cy="79" r="2.5" fill="rgba(255,255,255,.32)"/>' +
    '</svg>',
  Theatre:
    '<svg ' + _sa + '>' +
    '<rect x="0" y="0" width="200" height="11" fill="rgba(255,255,255,.2)"/>' +
    '<path d="M0,0 Q58,52 14,100 L0,100 Z"      fill="rgba(255,255,255,.14)"/>' +
    '<path d="M200,0 Q142,52 186,100 L200,100 Z" fill="rgba(255,255,255,.14)"/>' +
    '<path d="M100,11 L62,100 L138,100 Z"         fill="rgba(255,255,255,.06)"/>' +
    '<circle cx="100" cy="5.5" r="5" fill="rgba(255,255,255,.35)"/>' +
    '</svg>',
  Sports:
    '<svg ' + _sa + '>' +
    '<line x1="52" y1="14" x2="52" y2="88" stroke="rgba(255,255,255,.28)" stroke-width="5" stroke-linecap="round"/>' +
    '<line x1="148" y1="14" x2="148" y2="88" stroke="rgba(255,255,255,.28)" stroke-width="5" stroke-linecap="round"/>' +
    '<line x1="52" y1="14" x2="148" y2="14" stroke="rgba(255,255,255,.28)" stroke-width="5" stroke-linecap="round"/>' +
    '<line x1="52" y1="26" x2="72"  y2="88" stroke="rgba(255,255,255,.1)"  stroke-width="1.5"/>' +
    '<line x1="52" y1="44" x2="90"  y2="88" stroke="rgba(255,255,255,.1)"  stroke-width="1.5"/>' +
    '<line x1="52" y1="62" x2="108" y2="88" stroke="rgba(255,255,255,.1)"  stroke-width="1.5"/>' +
    '<line x1="52" y1="80" x2="126" y2="88" stroke="rgba(255,255,255,.1)"  stroke-width="1.5"/>' +
    '<line x1="72"  y1="14" x2="140" y2="88" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>' +
    '<line x1="92"  y1="14" x2="148" y2="70" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>' +
    '<line x1="112" y1="14" x2="148" y2="52" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>' +
    '<line x1="132" y1="14" x2="148" y2="32" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>' +
    '</svg>',
  Art:
    '<svg ' + _sa + '>' +
    '<path d="M15,72 Q70,18 185,38"  stroke="rgba(255,255,255,.26)" stroke-width="13" fill="none" stroke-linecap="round"/>' +
    '<path d="M10,86 Q85,60 180,78"  stroke="rgba(255,255,255,.14)" stroke-width="8"  fill="none" stroke-linecap="round"/>' +
    '<path d="M25,55 Q100,8 190,28"  stroke="rgba(255,255,255,.11)" stroke-width="5"  fill="none" stroke-linecap="round"/>' +
    '</svg>',
  Food:
    '<svg ' + _sa + '>' +
    '<line x1="77" y1="10" x2="77" y2="38" stroke="rgba(255,255,255,.25)" stroke-width="2.5" stroke-linecap="round"/>' +
    '<line x1="84" y1="10" x2="84" y2="38" stroke="rgba(255,255,255,.25)" stroke-width="2.5" stroke-linecap="round"/>' +
    '<line x1="91" y1="10" x2="91" y2="38" stroke="rgba(255,255,255,.25)" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M77,38 Q84,50 91,38" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none"/>' +
    '<line x1="84" y1="48" x2="84" y2="90" stroke="rgba(255,255,255,.28)" stroke-width="3.5" stroke-linecap="round"/>' +
    '<line x1="116" y1="10" x2="116" y2="90" stroke="rgba(255,255,255,.28)" stroke-width="3.5" stroke-linecap="round"/>' +
    '<path d="M116,10 C124,22 126,38 116,50" stroke="rgba(255,255,255,.18)" stroke-width="2" fill="rgba(255,255,255,.1)"/>' +
    '</svg>',
  Family:
    '<svg ' + _sa + '>' +
    '<circle cx="70"  cy="26" r="13" fill="rgba(255,255,255,.24)"/>' +
    '<rect   x="57"  y="42" width="26" height="46" rx="11" fill="rgba(255,255,255,.18)"/>' +
    '<circle cx="130" cy="26" r="13" fill="rgba(255,255,255,.24)"/>' +
    '<rect   x="117" y="42" width="26" height="46" rx="11" fill="rgba(255,255,255,.18)"/>' +
    '<circle cx="100" cy="40" r="9"  fill="rgba(255,255,255,.28)"/>' +
    '<rect   x="91"  y="52" width="18" height="33" rx="8"  fill="rgba(255,255,255,.2)"/>' +
    '</svg>',
  Nightlife:
    '<svg ' + _sa + '>' +
    '<rect x="0"   y="62" width="26" height="38" fill="rgba(255,255,255,.13)"/>' +
    '<rect x="24"  y="44" width="18" height="56" fill="rgba(255,255,255,.17)"/>' +
    '<rect x="40"  y="58" width="14" height="42" fill="rgba(255,255,255,.13)"/>' +
    '<rect x="52"  y="32" width="22" height="68" fill="rgba(255,255,255,.2)"/>' +
    '<rect x="72"  y="52" width="16" height="48" fill="rgba(255,255,255,.14)"/>' +
    '<rect x="86"  y="20" width="20" height="80" fill="rgba(255,255,255,.23)"/>' +
    '<rect x="104" y="46" width="15" height="54" fill="rgba(255,255,255,.15)"/>' +
    '<rect x="117" y="36" width="18" height="64" fill="rgba(255,255,255,.17)"/>' +
    '<rect x="133" y="55" width="13" height="45" fill="rgba(255,255,255,.13)"/>' +
    '<rect x="144" y="42" width="16" height="58" fill="rgba(255,255,255,.15)"/>' +
    '<rect x="158" y="60" width="20" height="40" fill="rgba(255,255,255,.13)"/>' +
    '<rect x="176" y="48" width="24" height="52" fill="rgba(255,255,255,.14)"/>' +
    '<path d="M152,22 A12,12 0 1,1 162,10 A9,9 0 1,0 152,22 Z" fill="rgba(255,255,255,.22)"/>' +
    '</svg>',
  Conference:
    '<svg ' + _sa + '>' +
    '<rect x="38" y="10" width="124" height="68" rx="4" stroke="rgba(255,255,255,.22)" stroke-width="3" fill="rgba(255,255,255,.05)"/>' +
    '<line x1="52" y1="28" x2="148" y2="28" stroke="rgba(255,255,255,.2)"  stroke-width="2.5" stroke-linecap="round"/>' +
    '<line x1="52" y1="42" x2="122" y2="42" stroke="rgba(255,255,255,.16)" stroke-width="2"   stroke-linecap="round"/>' +
    '<line x1="52" y1="54" x2="132" y2="54" stroke="rgba(255,255,255,.16)" stroke-width="2"   stroke-linecap="round"/>' +
    '<line x1="52" y1="66" x2="108" y2="66" stroke="rgba(255,255,255,.16)" stroke-width="2"   stroke-linecap="round"/>' +
    '<line x1="100" y1="78" x2="100" y2="92" stroke="rgba(255,255,255,.2)" stroke-width="3"   stroke-linecap="round"/>' +
    '<line x1="76"  y1="92" x2="124" y2="92" stroke="rgba(255,255,255,.2)" stroke-width="3"   stroke-linecap="round"/>' +
    '</svg>',
  Other:
    '<svg ' + _sa + '>' +
    '<path d="M100,6 L58,96 L142,96 Z" fill="rgba(255,255,255,.07)"/>' +
    '<circle cx="100" cy="6" r="7" fill="rgba(255,255,255,.3)"/>' +
    '<ellipse cx="100" cy="96" rx="38" ry="5.5" stroke="rgba(255,255,255,.16)" stroke-width="1.5" fill="none"/>' +
    '<ellipse cx="100" cy="96" rx="22" ry="3.5" stroke="rgba(255,255,255,.12)" stroke-width="1.5" fill="none"/>' +
    '</svg>'
};

// ── State & helpers ────────────────────────────────────────────
var activeDay = 'week';
var activeCat = null;
var userInteracted = false;

function todayKey() { return new Date().toISOString().split('T')[0]; }
function dateKey(iso) { return iso ? iso.split('T')[0] : ''; }
function safe(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(iso) {
  if (!iso) return 'Time TBA';
  var d = new Date(iso);
  return isNaN(d.getTime()) ? 'Time TBA' : d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}
function fmtDay(d) {
  return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'});
}

// After a user-initiated tab or category switch, scroll back to the top so
// they see the fresh set of events from the beginning rather than mid-list.
function scrollToMain() {
  if (!userInteracted) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

var DAYS = (function() {
  var arr = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date();
    d.setDate(d.getDate() + i);
    var key = d.toISOString().split('T')[0];
    arr.push({ key: key, date: d, count: EVENTS.filter(function(e) { return dateKey(e.date) === key; }).length });
  }
  return arr;
})();

// ── Week label ─────────────────────────────────────────────────
(function() {
  var s = DAYS[0].date, e = DAYS[6].date;
  function mo(d) { return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'}); }
  document.getElementById('weekLabel').textContent = mo(s) + ' - ' + mo(e) + ' ' + s.getFullYear();
})();

// ── Renders ────────────────────────────────────────────────────
function renderDayTabs() {
  var el = document.getElementById('dayTabs');
  var weekTotal = activeCat
    ? EVENTS.filter(function(e) { return e.category === activeCat; }).length
    : EVENTS.length;
  var weekActive = activeDay === 'week';
  var html = '<button class="day-tab week-tab' + (weekActive ? ' active' : '') + '" data-key="week" aria-pressed="' + weekActive + '">' +
    '<span class="tab-name">This Week</span>' +
    '<span class="tab-num">' + weekTotal + '</span>' +
    '<span class="tab-count">all 7 days</span>' +
    '</button>';
  DAYS.forEach(function(d) {
    var nm = d.date.toLocaleDateString('en-GB',{weekday:'short'}).toUpperCase().replace('.','');
    var active = d.key === activeDay;
    var c = d.count === 0 ? '-' : d.count + (d.count === 1 ? ' event' : ' events');
    html += '<button class="day-tab' + (active ? ' active' : '') + '" data-key="' + d.key + '" aria-pressed="' + active + '">' +
      '<span class="tab-name">' + nm + '</span>' +
      '<span class="tab-num">' + d.date.getDate() + '</span>' +
      '<span class="tab-count">' + c + '</span>' +
      '</button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.day-tab').forEach(function(b) {
    b.addEventListener('click', function() {
      userInteracted = true;
      activeDay = b.dataset.key;
      activeCat = null;
      renderAll();
    });
  });
}

var CATS = ['All','Concert','Festival','Theatre','Art','Food','Nightlife','Sports','Family','Conference','Tour','Market','Other'];
function renderCatPills() {
  var el = document.getElementById('catPills');
  el.innerHTML = CATS.map(function(c) {
    var active = c === 'All' ? !activeCat : activeCat === c;
    return '<button class="cat-pill' + (active ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
  }).join('');
  el.querySelectorAll('.cat-pill').forEach(function(b) {
    b.addEventListener('click', function() {
      userInteracted = true;
      activeCat = b.dataset.cat === 'All' ? null : b.dataset.cat;
      renderAll();
    });
  });
}

function renderCard(ev) {
  var cat = ev.category || 'Other';
  var color = CC[cat] || CC.Other;
  var grad  = CG[cat] || CG.Other;
  var illus = ILLUS[cat] || ILLUS.Other;
  var SL = {cancelled:'Cancelled',sold_out:'Sold Out',postponed:'Postponed',rescheduled:'Rescheduled'};
  var SB = {cancelled:'#A01818',sold_out:'#B05010',postponed:'#4C5A68',rescheduled:'#5A2880'};
  var badge = ev.status ? '<span class="card-status-badge" style="background:' + (SB[ev.status]||'#777') + '">' + (SL[ev.status]||ev.status) + '</span>' : '';
  var isUnavail = ev.status === 'cancelled' || ev.status === 'sold_out';
  var ctaLabel = ev.status === 'cancelled' ? 'Cancelled' : ev.status === 'sold_out' ? 'Sold Out' : 'Get Tickets';
  var cta = isUnavail
    ? '<span class="card-cta unavailable">' + ctaLabel + '</span>'
    : '<a href="' + safe(ev.url) + '" target="_blank" rel="noopener noreferrer" class="card-cta">' + ctaLabel + '</a>';

  var imgHtml = ev.image
    ? '<img src="' + safe(ev.image) + '" alt="' + safe(ev.name) + '" loading="lazy"/>'
    : illus;

  var desc = ev.description || '';

  return '<article class="event-card">' +
    '<div class="card-img" style="background:' + grad + ';">' +
      imgHtml + badge +
      '<span class="card-time-badge">' + safe(fmtTime(ev.date)) + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<span class="card-cat" style="color:' + color + '">' + safe(cat) + '</span>' +
      '<h3 class="card-title">' + safe(ev.name) + '</h3>' +
      '<span class="card-venue">' + safe(ev.venue || 'Venue TBA') + '</span>' +
      '<span class="card-price">' + safe(ev.cost || 'Price TBA') + '</span>' +
      (desc ? '<p class="card-desc">' + safe(desc) + '</p>' : '') +
    '</div>' +
    '<div class="card-footer">' + cta + '</div>' +
    '</article>';
}

function renderWeekView() {
  var grid = document.getElementById('eventsGrid');
  document.getElementById('topHeading').style.display = 'none';
  grid.className = '';

  var sections = DAYS.map(function(d) {
    var ev = EVENTS.filter(function(e) { return dateKey(e.date) === d.key; });
    if (activeCat) ev = ev.filter(function(e) { return e.category === activeCat; });
    ev.sort(function(a,b) { return new Date(a.date) - new Date(b.date); });
    return { key: d.key, date: d.date, events: ev };
  }).filter(function(s) { return s.events.length > 0; });

  if (!sections.length) {
    var hint = activeCat
      ? 'No ' + activeCat + ' events this week.'
      : 'No events found for this week.';
    grid.innerHTML = '<div class="no-events"><p class="no-events-title">Nothing to show.</p><p class="no-events-sub">' + hint + '</p></div>';
    return;
  }

  grid.innerHTML = sections.map(function(s) {
    var label = s.key === todayKey() ? 'Today' : fmtDay(s.date);
    var c = s.events.length;
    return '<div class="week-section">' +
      '<div class="week-section-header">' +
        '<h2>' + safe(label) + '</h2>' +
        '<span class="tally">' + c + ' event' + (c === 1 ? '' : 's') + '</span>' +
      '</div>' +
      '<div class="events-grid">' + s.events.map(renderCard).join('') + '</div>' +
      '</div>';
  }).join('');
}

function renderEvents() {
  if (activeDay === 'week') { renderWeekView(); return; }

  var grid = document.getElementById('eventsGrid');
  var h2   = document.getElementById('dayHeading');
  var tally = document.getElementById('tally');
  document.getElementById('topHeading').style.display = '';
  grid.className = 'events-grid';

  var ev = EVENTS.filter(function(e) { return dateKey(e.date) === activeDay; });
  if (activeCat) ev = ev.filter(function(e) { return e.category === activeCat; });
  ev.sort(function(a,b) { return new Date(a.date) - new Date(b.date); });

  var day = DAYS.find ? DAYS.find(function(d) { return d.key === activeDay; }) : null;
  if (!day) { for (var i = 0; i < DAYS.length; i++) { if (DAYS[i].key === activeDay) { day = DAYS[i]; break; } } }
  h2.textContent = activeDay === todayKey() ? 'Today' : (day ? fmtDay(day.date) : '');
  tally.textContent = ev.length ? ev.length + (ev.length === 1 ? ' event' : ' events') : '';

  if (!ev.length) {
    var dt = EVENTS.filter(function(e) { return dateKey(e.date) === activeDay; }).length;
    var hint = dt && activeCat
      ? 'There are ' + dt + ' other event' + (dt === 1 ? '' : 's') + ' this day.'
      : 'Try a different day or category.';
    grid.innerHTML = '<div class="no-events"><p class="no-events-title">Nothing here' + (activeCat ? ' for ' + activeCat : '') + '.</p><p class="no-events-sub">' + hint + '</p></div>';
    return;
  }
  grid.innerHTML = ev.map(renderCard).join('');
}

function renderAll() { renderDayTabs(); renderCatPills(); renderEvents(); scrollToMain(); }

// ── Coverage bar ───────────────────────────────────────────────
(function() {
  var bar = document.getElementById('coverageBar');
  var btn = document.getElementById('coverageToggle');
  var body = document.getElementById('coverageBody');
  if (!bar || !btn || !body) return;

  var open = false;
  try { open = localStorage.getItem('coverageOpen') === '1'; } catch(e) {}

  function apply(state) {
    open = state;
    if (state) {
      bar.classList.add('is-open');
      body.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    } else {
      bar.classList.remove('is-open');
      body.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    try { localStorage.setItem('coverageOpen', state ? '1' : '0'); } catch(e) {}
  }

  apply(open);
  btn.addEventListener('click', function() { apply(!open); });
}());

// ── Theme ──────────────────────────────────────────────────────
var theme = 'dark';
function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeBtn').textContent = t === 'dark' ? 'Light' : 'Dark';
}
document.getElementById('themeBtn').addEventListener('click', function() {
  applyTheme(theme === 'dark' ? 'light' : 'dark');
});
applyTheme('dark');

// ── Init ───────────────────────────────────────────────────────
renderAll();
    `;
  }

  renderEvent(event) {
    var name = event.name || '';
    var venue = event.venue || 'Venue TBA';
    var category = event.category || 'Other';
    var cost = event.cost || '';
    var description = event.description
      ? (event.description.length > 150 ? event.description.substring(0, 150) + '...' : event.description)
      : '';
    var timeStr = event.date
      ? (function() {
          try {
            var d = new Date(event.date);
            return isNaN(d.getTime()) ? 'Date TBA' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            return 'Date TBA';
          }
        }())
      : 'Date TBA';
    var status = event.status || null;
    var url = event.url || '#';
    var cta = status === 'cancelled'
      ? '<span class="card-cta unavailable">Cancelled</span>'
      : status === 'sold_out'
        ? '<span class="card-cta unavailable">Sold Out</span>'
        : '<a href="' + url + '" target="_blank" class="card-cta">Get Tickets</a>';

    return '<article class="event-card">' +
      '<div class="card-img">' +
        '<span class="card-time-badge">' + timeStr + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<span class="card-cat">' + category + '</span>' +
        '<h3 class="card-title">' + name + '</h3>' +
        '<span class="card-venue">' + venue + '</span>' +
        (cost ? '<span class="card-price">' + cost + '</span>' : '') +
        (description ? '<p class="card-desc">' + description + '</p>' : '') +
      '</div>' +
      '<div class="card-footer">' + cta + '</div>' +
      '</article>';
  }

  generateEventCard(event) { return this.renderEvent(event); }
  generateEventCards(events) { return events.map(e => this.renderEvent(e)).join(''); }
}

module.exports = HtmlGenerator;
