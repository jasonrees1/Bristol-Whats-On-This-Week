# Bristol What's On - UX Design Plan

## Current Issues
- Single long list of all events for the week
- No filtering by day
- No filtering by category
- Limited visual hierarchy
- No way to quickly scan for specific interests

## User Goals
Users should be able to:
1. ✅ Quickly see what's happening today
2. ✅ Browse events by specific day of the week
3. ✅ Filter by event type/category (concerts, sports, food, etc.)
4. ✅ View event details clearly (time, venue, cost, description)
5. ✅ Easily navigate between days/filters

## Proposed UX Design

### Layout Structure
```
┌─────────────────────────────────────────────────┐
│  HEADER - "What's On in Bristol This Week"      │
│  Last updated: [date]                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  DAY SELECTOR TABS (sticky at top)              │
│  [TODAY] [MON] [TUE] [WED] [THU] [FRI] [SAT]   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  CATEGORY FILTER BUTTONS (optional)             │
│  [All] [Music] [Sports] [Food] [Theater] [Art]  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  EVENT RESULTS SECTION                          │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 7:00 PM - Concert at O2 Academy         │   │
│  │ Tickets: £20-30 | Music                 │   │
│  │ [Learn More] [Add to Calendar]          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 2:00 PM - Street Food Market            │   │
│  │ Free | Food                             │   │
│  │ [Learn More] [Add to Calendar]          │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [No events found] (if applicable)              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  FOOTER                                         │
│  Auto-updates every Saturday at 10 AM UTC      │
└─────────────────────────────────────────────────┘
```

### Feature Breakdown

#### 1. Day Selector Tabs
- **Display:** Horizontal tabs for each day (Mon-Sun)
- **Behavior:** Click day → shows only events for that day
- **Styling:** Active day highlighted, "TODAY" badge on current day
- **Sticky:** Stays visible when scrolling

#### 2. Category Filter Buttons
- **Display:** Pills/buttons for each category
- **Options:** All, Music, Sports, Food, Theater, Art, Family, Nightlife, Conferences, Tours, Markets
- **Behavior:** Click category → filters events by type
- **Combination:** Users can filter by day AND category together
- **Mobile:** Horizontal scroll on small screens

#### 3. Event Cards
- **Layout:** Clean card design with:
  - Time (prominent, left side)
  - Event name (bold, large)
  - Category badge (colored pill)
  - Venue name
  - Price/cost
  - Brief description
  - Action buttons: "Learn More" (external link), "Add to Calendar"

#### 4. Empty State
- **Message:** "No events found for [Day] in [Category]"
- **Suggestion:** "Try a different day or category"

#### 5. Responsive Design
- **Desktop:** Full layout as described
- **Tablet:** 2-column event grid
- **Mobile:** Single column, full-width buttons

## Technical Implementation

### Frontend Changes
1. **HTML Structure:**
   - Add day selector div with data attributes
   - Add category filter div
   - Add event display area with dynamic rendering

2. **CSS:**
   - Modern, clean design
   - Color-coding for categories
   - Hover effects on cards
   - Sticky navigation
   - Responsive grid/flexbox layout

3. **JavaScript (Client-side):**
   - Filter events by selected day
   - Filter events by selected category
   - Combine filters (day + category)
   - Highlight active day/category
   - Dynamic event card rendering
   - "Add to Calendar" functionality (iCal format)

### Data Format
Events need to include:
- `date` - ISO format for day detection
- `time` - Event start time (HH:MM)
- `category` - Standardized category name
- `name` - Event name
- `venue` - Venue name
- `cost` - Price/free
- `description` - Brief description
- `url` - Link to event details
- `image` - Event image (optional)

## Color Scheme & Categories

```
🎵 Music      → Blue    (#1E90FF)
⚽ Sports     → Green   (#2ECC71)
🍔 Food       → Orange  (#E67E22)
🎭 Theater    → Purple  (#9B59B6)
🎨 Art        → Red     (#E74C3C)
👨‍👩‍👧‍👦 Family     → Pink    (#FF69B4)
🌙 Nightlife  → Dark    (#2C3E50)
💼 Conference → Gray    (#95A5A6)
🚶 Tour       → Brown   (#A0826D)
🛍️ Market     → Yellow  (#F39C12)
```

## Implementation Priority

### Phase 1 (Essential - Week 1)
- [x] Day selector tabs
- [x] Category filter buttons
- [x] Filter events by day + category
- [x] Clean event card design
- [x] Mobile responsive

### Phase 2 (Nice to Have - Week 2)
- [ ] "Add to Calendar" iCal export
- [ ] Event images
- [ ] Search functionality
- [ ] Favorites/bookmarking
- [ ] Share event buttons

### Phase 3 (Future Enhancement)
- [ ] Map view showing venues
- [ ] Time-based filtering (morning/afternoon/evening)
- [ ] Email signup for weekly digest
- [ ] Social media integration
- [ ] User reviews/ratings

## Expected User Experience

**Scenario 1:** "I want to see what's on Friday"
- User lands on page
- Clicks "FRI" tab
- Sees all Friday events
- 2-3 seconds, done ✅

**Scenario 2:** "I'm looking for concerts this week"
- User lands on page
- Clicks "Music" filter
- Sees concerts across all days
- Or combines: Clicks "Music" + "WED"
- Sees concerts on Wednesday only
- 3-4 seconds, done ✅

**Scenario 3:** "I want tonight's recommendations"
- User lands on page
- "TODAY" tab is auto-selected (highlighted)
- All categories shown
- 1-2 seconds, done ✅

## Success Metrics
- ✅ Page loads in under 2 seconds
- ✅ Users can filter to single day in 1 click
- ✅ Users can filter by category in 1 click
- ✅ Mobile-friendly on all devices
- ✅ Information hierarchy clear (time → event → venue → cost)

## Questions for User
1. Should we show **all events across all categories** by default, or only certain types?
2. Should the page **auto-select TODAY** when loaded, or show all week?
3. Do you want an **image for each event** (requires more API data)?
4. Should we include an **"Add to Calendar"** button?
5. Any **specific color scheme preferences** instead of the suggested one?
