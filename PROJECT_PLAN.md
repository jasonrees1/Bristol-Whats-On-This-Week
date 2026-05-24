# Bristol Events Project - Clear Plan

## 🎯 Core Objective
Create an automated, weekly-updated website that displays all events happening in Bristol for the upcoming 7 days, with accurate, up-to-date information sourced from reliable APIs.

## 📋 What We're Building

### Website Features
- **Single HTML page** hosted on GitHub Pages
- **Weekly automatic updates** (every Sunday at 10 AM)
- **Event details displayed:**
  - Event name
  - Venue location
  - Date & time
  - Cost/ticket price
  - Brief description
  - Event category/type

### Event Categories to Include
1. **Live Music** (concerts, bands, DJ sets, performances)
2. **Festivals** (multi-day, community events)
3. **Theater & Comedy** (plays, stand-up, musicals)
4. **Sports Events** (matches, tournaments, races)
5. **Art & Exhibitions** (gallery shows, installations)
6. **Conferences & Workshops** (talks, training, seminars)
7. **Food Events** (pop-ups, tastings, markets, food festivals)
8. **Nightlife & Clubs** (club nights, dance events)
9. **Family & Kids** (activities, shows, workshops for children)
10. **Tours & Attractions** (walking tours, guided experiences)
11. **Markets & Fairs** (craft markets, farmers markets)

## 🛠️ How It Works

### Architecture Flow
1. **GitHub Actions Trigger** → Runs every Saturday at 10 AM UTC (or manual)
2. **Data Fetcher** → Calls multiple APIs to get Bristol events
3. **Data Processor** → Filters events to this week, categorizes, sorts by date
4. **HTML Generator** → Creates beautiful HTML page from processed data
5. **Git Commit & Push** → Commits changes to repo
6. **GitHub Pages** → Automatically serves updated index.html
7. **Error Notification** → Sends email if anything fails

### Data Quality Requirements
- ✅ Events must be **within the current week only** (today → 7 days)
- ✅ Must filter to **Bristol area only**
- ✅ Data must be **accurate and current** (APIs should have real-time updates)
- ✅ **No duplicates** across different API sources
- ✅ Must include **venue, time, and cost** where available

## 🔑 Success Criteria

**The project is successful when:**
1. ✅ A live website shows current Bristol events
2. ✅ It automatically updates every Sunday
3. ✅ All major event types are included
4. ✅ Events are accurate (from reputable sources)
5. ✅ If update fails, you receive an email notification
6. ✅ Unit tests pass (data processing works correctly)
7. ✅ Hosted on GitHub Pages (free hosting)

## 📊 Current Status

| Component | Status |
|-----------|--------|
| Project Structure | ✅ Complete |
| Unit Tests Setup | ✅ Complete |
| GitHub Actions Workflow | ✅ Complete (needs APIs) |
| API Research | ⏳ **In Progress** |
| API Implementation | ⏳ Pending |
| GitHub Secrets Config | ⏳ Pending |
| Email Setup | ⏳ Pending |
| Live Deployment | ⏳ Pending |

## ❓ Does This Match Your Requirements?

Please confirm:
- [ ] Is this the scope you want?
- [ ] Are the event categories right?
- [ ] Weekly updates sufficient (or need more frequently)?
- [ ] Email notifications the right alert method?

**Once you confirm, I'll proceed with detailed API research.**
