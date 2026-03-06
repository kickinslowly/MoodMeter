# Project Goals

## Goal Registry
<!-- G1-G4 active. Tasks nested under each goal. -->

## Active Goals

**G1**: UI/UX Polish — Make the game feel polished, modern, and addictive. Compete with Poki-tier free browser games on engagement and visual quality.
- ✅ Ensure Make67 and Make 6 or 7 are fully mirrored/aligned in UI and UX (empowerment, celebrations, themes, effects display, merge animation, keyboard shortcuts, state tracking)
- ✅ Fix mobile navigation drawer — was completely non-functional in both games (hamburger button did nothing)
- 🔲 Audit Make67 UI for visual bugs, alignment issues, spacing inconsistencies
- 🔲 Audit Make 6 or 7 UI for same
- 🔲 Check mobile responsiveness and touch interactions (beyond drawer)
- 🔲 Review color theme transitions and animation smoothness
- 🔲 Add Pixi.js particle effects to Make 6 or 7 (Make67 has WebGL particles, Make6or7 does not)
- 🔲 Add events polling to Make 6 or 7 (real-time effect updates from other players)

**G2**: Rank Expansion — Ensure players never feel like they've "maxed out." Keep the carrot dangling.
- 🔲 Add more ranks beyond 5500 (extend the rank ladder)
- ✅ Verify rank-up celebrations scale properly at new tiers (added tiered flavor texts + particle scaling to Make6or7)
- 🔲 Ensure CSS styling exists for all new ranks
- 🔲 Design "super ranks" concept for extreme users (special rewards, visual flair, or exclusive features)

**G3**: Bug Hunting & Stability — Find and fix anything broken before users hit it.
- ✅ Fix mud stacking inconsistency — Make6or7 was extending mud duration instead of rejecting (now matches Make67)
- ✅ Fix Make6or7 burstCharge targeting dead `.xmas-title` element (now targets allTimeBoxEl)
- ✅ Fix chat polling — Make6or7 had fixed 2s with no backoff (now has exponential backoff + tab-hidden awareness)
- ✅ Enable state caching for Make6or7 (was explicitly disabled)
- 🔲 Test shop purchase flow end-to-end (buy, inventory, use, effects)
- 🔲 Test item interactions (mud + shield, boost stacking, invisibility edge cases)
- 🔲 Verify leaderboard accuracy with effects active
- 🔲 Check chat eligibility and message delivery
- 🔲 Test edge cases: rapid clicking, expired effects, concurrent users
- 🔲 Investigate shared effect columns — both games use `make67_*_until` DB columns (cross-game effect pollution if player plays both)
- 🔲 Investigate shared cheater flag — `make67_is_cheater` used for both games
- 🔲 Investigate shared chat bus — `_m67_subscribers` shared between games (potential message leaks)

**G4**: Engagement & Analytics — Track usage patterns, reward dedication, keep players coming back.
- 🔲 Add usage tracking (solves per minute, session duration, streaks)
- 🔲 Design engagement features (daily challenges, streak bonuses, achievements)
- 🔲 Consider social features beyond chat (rivalries, friend lists, challenges)

## Completed Goals
<!-- None yet -->
