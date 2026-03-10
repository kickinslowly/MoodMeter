# Features Inventory

Authority on *what exists* in MoodMeter. Updated as features are added.

## Games

### Make67
Math puzzle: use +, -, *, / to combine 4 cards to make 67. Earn solves as currency.
- Puzzle generation, validation, solve tracking
- 56 ranks (0-5500 solves) with unique CSS effects per rank
- Rank-up celebrations with tier-based flavor text, particles, emojis
- 5 visual themes (auto-applied by score)
- 9 user-selectable color themes (unlocked 1500+)
- 20 unlock sounds (every 200 solves)
- Empowerment system (--emp CSS variable scales with progress)
- Shop with 9 items (Sneaky Dust, Boost, Mud, Divine Shield, Reverse Card, Clown Horn, Banana Peel, Double or Nothing, Earthquake)
- 4-slot inventory with long-press to use
- Effects system (invisible, boost, mud, shield) with DB-backed timers
- Banana peel one-shot debuff (in-memory tracking)
- Reverse Card passive trap (auto-triggers on mud, consumed from inventory)
- Clown Horn social trolling (emoji rain on target screen)
- Double or Nothing gambling (+6/-3 solves, 50/50)
- Earthquake mass chaos (screen shake broadcast to all)
- Toast notification system for real-time events
- Live chat (unlocked at 50+ solves, SSE streaming)
- Real-time leaderboard with presence detection
- Events polling for real-time item effects from other players
- Snowball throwing feature

### Make 6 or 7
Variant game with shared backend architecture (parameterized handlers).
- Same shop, effects, inventory system as Make67 (all 9 items)
- Events polling for real-time effects (clown horn, earthquake, etc.)
- Own chat system (ChatMessage6or7 model)
- Own leaderboard and solve tracking
- Own all-time solves counter

## Mood Meter
Core mood tracking tool for students.
- 2D mood grid (x/y axes) with labeled cells
- Click to submit mood, tracks user/IP/timestamp
- Last entry display with relative time formatting
- CSV-backed grid labels (Mood_Meter_DataFrame.csv)

## Dashboards

### Student Dashboard
- Most common mood, best hour, best month
- Heatmap overlay
- Date range and time-of-day filters (UTC)

### Teacher Dashboard
- Group selection
- Most common mood, best/worst hour/month/day-of-week
- Heatmap view
- Individual student view section
- Group management (create, delete, add/remove members)

## Auth & Users
- Google OAuth via Authlib
- Flask-Login session management
- Roles: student, teacher (set via /role endpoint)
- User model with game counters, effect timestamps, cheater flag

## API Routes (~30 routes)

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Home page |
| `/moodmeter` | GET | Mood meter page |
| `/make67` | GET | Make67 game page |
| `/make6or7` | GET | Make 6 or 7 game page |
| `/moodmeter/click` | POST | Record mood submission |
| `/moodmeter/api/last-entry` | GET | Get last mood entry |
| `/moodmeter/api/cell-entries` | GET | Get entries for a cell |
| `/moodmeter/dashboard` | GET | Dashboard page |
| `/moodmeter/groups` | GET/POST | Group management |
| `/moodmeter/groups/<id>/members` | POST | Add group member |
| `/moodmeter/groups/<id>/members/<sid>/remove` | POST | Remove member |
| `/moodmeter/groups/<id>/delete` | POST | Delete group |
| `/moodmeter/groups/<id>/set-teacher` | POST | Assign teacher |
| `/moodmeter/teachers` | POST | Create teacher |
| `/moodmeter/api/session/create` | POST | Create live session |
| `/moodmeter/api/session/join` | POST | Join live session |
| `/moodmeter/api/session/<id>/stats` | GET | Session stats |
| `/me` | GET | Current user info |
| `/login` | GET | Login page |
| `/auth/callback` | GET | OAuth callback |
| `/logout` | POST/GET | Logout |
| `/role` | POST | Set user role |
| `/api/make67/shop` | GET | Make67 shop catalog |
| `/api/make67/state` | GET | Player state (solves, effects, inventory) |
| `/api/make67/buy` | POST | Purchase shop item |
| `/api/make67/use` | POST | Use inventory item |
| `/api/make67/solve` | POST | Record solve |
| `/api/make67/leaderboard` | GET | Leaderboard data |
| `/api/make67/chat/*` | Various | Chat (stream, send, since, post, debug) |
| `/api/make67/events` | GET | SSE event stream |
| `/api/make67/events/poll` | GET | Poll events |
| `/api/make67/snowball` | POST | Throw snowball |
| `/api/make6or7/*` | Various | Mirror of Make67 APIs for Make 6 or 7 |

## Database Models (8)

| Model | Key Fields |
|-------|-----------|
| User | id, name, email, role, make67_all_time_solves, make6or7_all_time_solves, effect timestamps, is_cheater |
| M67UserItem | id, user_id, item_key, created_at |
| Group | id, name, teacher_id |
| GroupMember | id, group_id, student_id |
| Session | id, code, created_at |
| MoodSubmission | id, x, y, label, chosen_at, user_id, ip, created_at |
| ChatMessage | id, user_id, display_name, text, created_at |
| ChatMessage6or7 | id, user_id, display_name, text, created_at |

## Templates (9)
base.html, home.html, index.html, make67.html, make6or7.html, student_dashboard.html, teacher_dashboard.html, teacher_groups.html, _audio_elements.html

## Static Assets
- **CSS**: styles.css (rank styling, themes, animations, responsive)
- **JS**: make67.js (production), make6or7.js, main.js, cell-modal.js, heatmap-colors.js, stickman.js
- **JS Modules**: make67/ (utils, puzzle, state, audio, theme, main)
- **Audio**: 26 solve sounds, 6 level-up sounds, 4 item sounds, 1 shop sound
- **Images**: santa.gif, snowballs.png, screenshot

## Infrastructure
- SQLite (local) / PostgreSQL (prod via Render)
- Alembic migrations (13 versions)
- LRU state cache (max 500 entries)
- Leaderboard TTL cache (2s)
- Periodic cleanup for stale rate-limit data
- SSE for real-time chat and events
- Presence detection with poll-based pings
- Query optimizations (column projection, SQL filtering, lightweight dicts)
