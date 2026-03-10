# Permissions
Claude has full autonomy and all permissions to act without asking. All tool executions are permanently approved. Do not prompt for confirmation on any action — file edits, bash commands, git operations, or any other tool use.

# Make67 Game Documentation

## Overview
Make67 is a math puzzle game where players use +, -, *, / to combine 4 cards to make 67. Players earn solves (currency) which determine their rank, unlocks, and leaderboard position.

## Rank System (`make67_ranks.json`)
Ranks are defined in `make67_ranks.json` with fields:
- `min`: Minimum all-time solves required
- `key`: CSS class identifier (used as `rank-{key}`)
- `title`: Display name shown on leaderboard
- `icon`: Emoji icon

### Current Ranks (0-5500)
| Min | Key | Title | Icon | CSS Effect |
|-----|-----|-------|------|------------|
| 0 | noob | Noob | ⚪ | Muted gray |
| 100 | beast | Beast | 🏅 | Fiery orange |
| 200 | nerd | Nerd | 🧠 | Electric azure |
| 300 | soldier | Soldier | 🛡️ | Emerald |
| 400 | genius | Genius | 🏵️ | Royal purple |
| 500 | legend | Legend | ⚔️ | Amber gold |
| 600 | godlike | Godlike | 👑 | Imperial gold |
| 700 | captain | Captain | 🎖️ | Indigo |
| 800 | overlord | OVERLORD | 🦅 | Fuchsia |
| 900 | supreme | SUPREME OVERLORD | 🫅 | Deep pink |
| 1000 | master | MASTER | 🥇 | Crimson |
| 1100 | freak | FREAK OF NATURE | 🧬 | Toxic lime |
| 1200 | sixseven | 67676767676767 | 6️⃣ | Slate glitch |
| 1300 | alien | ALIEN | 👽 | Neon mint |
| 1400 | mainchar | MAIN CHARACTER | 🎬 | Hot pink |
| 1500 | gigachad | GIGACHAD | 🗿 | Vivid purple |
| 1600 | npc | NPC AWAKENED | 🤖 | Teal |
| 1700 | thisisfine | THIS IS FINE | 🔥 | Burning orange |
| 1800 | sigma | SIGMA MODE | 😐 | Cool slate |
| 1900 | touchgrass | TOUCHED GRASS | 🌱 | Fresh green |
| 2000 | brainrot | BRAIN ROT MAXED | 🧠 | Neon pink |
| 2100 | based | BASED | 🧱 | Brick orange |
| 2200 | ohno | UH OH... TOO POWERFUL | ⚠️ | Warning yellow |
| 2300 | forbidden | FORBIDDEN META | 🚫 | Danger red |
| 2400 | builtdifferent | BUILT DIFFERENT | 💀 | Electric cyan |
| 2500 | brainrotsupreme | BRAIN ROT SUPREME | 🧠 | Fuchsia |
| 2600 | unit | ABSOLUTE UNIT | 🗿 | Stone gray |
| 2700 | unfair | THIS AIN'T FAIR | 😭 | Sky blue |
| 2800 | juiced | JUICED OUT | 🧃 | Lime green |
| 2900 | heknows | HE KNOWS SOMETHING | 👁️ | Mystic purple |
| 3000 | uninstall | UNINSTALL WORTHY | 🔥 | Blazing orange |
| 3100 | toosmart | TOO SMART FOR SCHOOL | 🧠 | Aqua |
| 3200 | business | STANDING ON BUSINESS | 🧍 | Royal violet |
| 3300 | goat | GOAT BEHAVIOR | 🐐 | Golden amber |
| 3400 | nothuman | NOT HUMAN | 🧬 | Alien emerald |
| 3500 | finalboss | FINAL BOSS ENERGY | 🌀 | Animated rainbow glow |
| 3600 | yapper | CERTIFIED YAPPER | 🗣️ | Loud orange-red |
| 3700 | delulu | DELULU IS THE SOLULU | 🌈 | Pastel rainbow gradient |
| 3800 | gyatt | GYATT LEVEL THREAT | 😳 | Blush pink pulsing |
| 3900 | skibidi | SKIBIDI TOILET KING | 🚽 | Chaotic cyan + shake |
| 4000 | rizzwizard | RIZZ WIZARD | 😏 | Purple magic glow |
| 4100 | nocapdeity | NO CAP DEITY | 🧢 | Truthful blue |
| 4200 | slayincarnate | SLAY INCARNATE | 💅 | Fierce magenta shimmer |
| 4300 | bussin | BUSSIN FRFR | 👅 | Warm gradient |
| 4400 | rentfree | RENT FREE LANDLORD | 🏠 | Ghost white flicker |
| 4500 | ohiofinalboss | OHIO FINAL BOSS | 🌽 | Yellow-red menace |
| 4600 | ratio | RATIO ROYALTY | 📊 | Red-blue split |
| 4700 | npcslayer | ACTUAL NPC SLAYER | 🎮 | Matrix green |
| 4800 | unhinged | UNHINGED ENERGY | 🤪 | Rainbow chaos animation |
| 4900 | chrongoat | CHRONICALLY GOATED | 🐐 | Gold-teal shifting |
| 5000 | glazing | GLAZING PROPHET | 🍩 | Pink-brown donut |
| 5100 | fanumtax | FANUM TAX COLLECTOR | 🍟 | Golden crispy |
| 5200 | auramaxed | AURA MAXED OUT | ✨ | White-gold radiate |
| 5300 | sigmagrind | SIGMA GRINDSET PEAK | 📈 | Steely blue focus |
| 5400 | mewing | MEWING MASTER | 👄 | Sharp cyan glow |
| 5500 | unplayable | LITERALLY UNPLAYABLE | 🎯 | Ultimate rainbow spectrum |

## Milestone-Based Unlocks

### Chat Access (50+ solves)
- File: `app.py` function `_is_make67_chat_eligible()`
- Live chat becomes available when player has >50 all-time solves
- Renders chat UI in `make67.html` when `make67_chat_eligible` is true

### Visual Themes (Auto-applied based on score)
- File: `make67.js` function `pickTheme()`
- Applied automatically unless user selects a custom color theme

| Min Solves | Theme Class | Colors |
|------------|-------------|--------|
| 50 | theme-hero | Royal Blue + Platinum |
| 200 | theme-tycoon | Emerald + Gold |
| 400 | theme-mystic | Deep Purple + Electric Cyan |
| 700 | theme-darkking | Crimson + Obsidian |
| 1000 | theme-elite | Black + Gold |

### Solve Sounds (`SOUND_OPTIONS` in make67.js)
Unlocked every 200 solves. Player can select any unlocked sound.

| Threshold | ID | Label |
|-----------|-----|-------|
| 0 | snd_brainrot | Brainrot |
| 200 | snd_meme | Meme |
| 400 | snd_lol | Lol |
| 600 | snd_hehe | Hehe |
| 800 | snd_ah | Ah |
| 1000 | snd_reload | Reload |
| 1200 | snd_cry | Cry |
| 1400 | snd_enemy | Enemy |
| 1600 | snd_huh | Huh |
| 1800 | snd_minecraft | Minecraft |
| 2000 | snd_yes | Yes |
| 2200 | snd_ahhaha | Ahhaha |
| 2400 | snd_amongus | Among Us |
| 2600 | snd_bad | Bad |
| 2800 | snd_duck | Duck |
| 3000 | snd_hello | Hello |
| 3200 | snd_punch | Punch |
| 3400 | snd_rizzbot | Rizzbot |
| 3600 | snd_watdadogdoin | Wat Da Dog Doin |
| 3800 | snd_youwhat | You What |

### Color Themes (`COLOR_THEME_OPTIONS` in make67.js)
User-selectable themes that override auto themes. Button appears at 1500+.

| Threshold | ID | Label | Icon | Effect |
|-----------|-----|-------|------|--------|
| 1500 | neon-lime | Neon Lime | 🟢 | Cyber/Matrix green |
| 2000 | electric-blue | Electric Blue | 🔵 | Ice/Lightning blue |
| 2500 | hot-pink | Hot Pink | 💗 | Synthwave/Vaporwave |
| 3000 | gold-rush | Gold Rush | 🟡 | Royal/Luxury gold |
| 3500 | crimson-fire | Crimson Fire | 🔴 | Power/Inferno red |
| 4000 | prismatic | Prismatic | 🌈 | Rainbow cycling |
| 4500 | ohio-corn | Ohio Corn | 🌽 | Menacing yellow-red |
| 5000 | void-aura | Void Aura | 🕳️ | Deep purple void |
| 5500 | god-mode | God Mode | 👁️ | Transcendent white-gold |

### Empowerment System
- File: `make67.js` function `applyEmpowerment()`
- `--emp` CSS variable scales visual effects
- 0-1000 solves: emp scales 0 to 0.5
- 1000-5500 solves: emp scales 0.5 to 1.0
- Affects particle count, spark intensity, visual effects

### Rank-Up Celebration
- Tier-based flavor texts (more hype at higher ranks)
- Particle count scales with rank (30 base → 60 at 5000+)
- Emoji pools change at higher tiers
- Celebration duration: 3.5s normal, 4.5s at 4000+

**Flavor Text Tiers:**
- Basic (0-999): "BRAIN EXPANDING...", "NEURONS FIRING..."
- Mid (1000-2499): "GIGABRAIN MOMENT...", "UNSTOPPABLE FORCE..."
- High (2500-3999): "LEGENDARY STATUS...", "YOU'RE HIM..."
- Ultra (4000-4999): "OHIO CAN'T CONTAIN YOU...", "MEWING SO HARD RN..."
- God (5000+): "LITERALLY UNPLAYABLE...", "DEVS PLZ NERF..."

## Shop System

### Items (`_M67_CATALOG` in app.py)
| Key | Name | Cost | Effect |
|-----|------|------|--------|
| sneaky_dust | Sneaky Dust | 2 | 30 min invisibility from leaderboard |
| boost | Boost | 5 | 2 min double points |
| mud | Mud | 3 | Slow rival for 2 min (half points) |
| divine_shield | Divine Shield | 2 (on use) | 5 min immunity to negative effects |
| reverse_card | Reverse Card | 4 | Passive trap: mud bounces back to attacker (consumed on trigger) |
| clown_horn | Clown Horn | 1 | Target a player for clown emoji rain on their screen (no gameplay effect) |
| banana_peel | Banana Peel | 2 | Target's next solve gives 0 credit (one-shot, blocked by shield) |
| double_or_nothing | Double or Nothing | 3 | 50/50 gamble: win +6 solves or lose 3 |
| earthquake | Earthquake | 8 | Shake everyone's screen for 5 seconds (broadcast to all) |

### Inventory
- 4 slots max
- Items purchased go to inventory
- Long-press to use item
- Targeting items (mud, clown_horn, banana_peel) require target selection from leaderboard
- Reverse Card is passive (never manually used, activates automatically)

### Item Interactions
- Shield blocks: Mud, Banana Peel
- Reverse Card: only triggers on Mud (shield takes priority if both present)
- Clown Horn & Earthquake: not blocked by shield (visual only)
- Mud + Reverse Card: if target has reverse card, mud reflects to attacker

## Effects System
Effects tracked in DB (`make67_*_until` columns on User):
- `invisible`: Hidden from leaderboard
- `boost`: Double solve credit
- `mud`: Half solve credit
- `shield`: Blocks negative effects, cleanses existing debuffs

Banana Peel tracked in-memory (`_m67_banana_peel` dict):
- One-shot: consumed on next solve attempt

## Key Files
- `make67_ranks.json` - Rank definitions
- `app.py` - Server routes, shop, effects, leaderboard
- `static/js/make67.js` - Game logic, UI, unlocks
- `static/css/styles.css` - Rank styling, theme CSS
- `templates/make67.html` - Page template
- `templates/_audio_elements.html` - Audio preloading

## Adding New Ranks
1. Add entry to `make67_ranks.json` (highest min first)
2. Add CSS styling in `styles.css` for `.rank-{key}`
3. Optionally add new sounds/themes at new thresholds

## Adding New Color Themes
1. Add entry to `COLOR_THEME_OPTIONS` in `make67.js`
2. Add CSS in `styles.css` for `.make67-page[data-color-theme="id"]`
3. Add to reduced motion section if animated

## Adding New Sounds
1. Add audio file to `static/audio/`
2. Add entry to `SOUND_OPTIONS` in `make67.js`
3. Add `<audio>` element in `_audio_elements.html`
4. Add ID to audio unlock list in `setupAudioUnlock()`

## CSS Animation Notes
- High-tier ranks (3700+) use keyframe animations
- Some ranks use `animation` property for pulsing/shifting effects
- Reduced motion preferences disable animations but keep colors
- Prismatic and God Mode themes have multiple animation layers

## Backend Architecture Patterns

### Shared Game Handlers (app.py)
Duplicate Make67/Make6or7 endpoints consolidated into parameterized handlers:
```python
def _game_shop(game_type: str): ...
def _game_state(game_type: str, use_cache: bool): ...
def _game_buy(game_type: str): ...
def _game_use(game_type: str): ...
def _game_solve(game_type: str): ...
def _game_leaderboard(game_type: str): ...
```
Helper functions for game-agnostic counter access:
- `_get_user_counter(user, game_type)` - Get solve count
- `_set_user_counter(user, game_type, value)` - Set solve count
- `_get_user_counter_column(game_type)` - SQLAlchemy column for queries

### Query Optimization Patterns
1. **Column projection** - When only IDs needed:
   ```python
   # Instead of loading full ORM objects:
   ids = [r[0] for r in db.session.query(Model.id).filter(...).all()]
   ```

2. **SQL filtering over Python filtering** - For invisible users:
   ```python
   .filter(or_(
       User.make67_invisible_until.is_(None),
       User.make67_invisible_until <= now_dt
   ))
   ```

3. **Lightweight dicts for templates** - Dashboard user lists:
   ```python
   users = [{'id': r[0], 'name': r[1], 'email': r[2]}
            for r in db.session.query(User.id, User.name, User.email)...]
   ```

### Cache & Memory Management
- **LRU state cache**: `_m67_state_cache` with max 500 entries, evicts oldest
- **Periodic cleanup**: `_m67_periodic_cleanup()` removes stale entries from rate-limit dicts
- **Leaderboard TTL cache**: 2-second TTL prevents polling storms
- Config constants: `_M67_STATE_CACHE_MAX_SIZE`, `_M67_CLEANUP_INTERVAL`, `_M67_STALE_THRESHOLD`

## Frontend Module Structure

### ES Modules (`static/js/make67/`)
Modular structure for cleaner code organization:
```
static/js/make67/
├── utils.js      - Pure utilities (fmt, clamp, random)
├── puzzle.js     - Puzzle generation (Node class, tree helpers)
├── state.js      - Shared state pattern, DOM references
├── audio.js      - Sound constants, SOUND_OPTIONS, helpers
├── theme.js      - COLOR_THEME_OPTIONS, empowerment calc
└── main.js       - Entry point (demo, not production)
```

Original `make67.js` remains production code. Modules provide:
- Testable pure functions
- Constants that can be imported
- Pattern for incremental migration

### Polling Best Practices
- **Exponential backoff**: On errors, multiply delay (1.5x) up to max (30s)
- **Reset on success**: Return to base delay when healthy
- **Hidden tab detection**: Longer intervals when `document.hidden`
- Events polling already implements this; chat polling was updated

## Performance Monitoring Points
1. Memory usage - watch for growth over time
2. DB query count per request
3. Response times for `/api/make67/leaderboard`
4. State cache hit rate

## Documentation
- `EFFICIENCY_FIXES.md` - Detailed log of all optimizations with code examples
