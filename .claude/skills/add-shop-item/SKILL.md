# Add Shop Item

## When to Use
Adding a new item to the Make67/Make6or7 shop system.

## Files to Edit
1. `app.py` — Add to `_M67_CATALOG` dict (key, name, icon, color, cost, desc)
2. `app.py` — Add handler in `_game_use()` for the new item key
3. `app.py` — If item needs tracking, add in-memory dict + lock near other `_m67_*` dicts
4. `app.py` — If item broadcasts events, add event type to whitelist in `_m67_broadcast`
5. `static/js/make67.js` — Add to `useItem()` (targeting or self-use logic)
6. `static/js/make67.js` — Add event handler in `handleIncomingEvent()` if broadcast
7. `static/js/make6or7.js` — Same changes as make67.js but with `/api/make6or7/` endpoints
8. `static/css/styles.css` — Add visual effect CSS if needed

## Item Types
- **Self-use**: No target needed (e.g., boost, double_or_nothing, earthquake)
- **Targeted**: Needs `pickTarget()` call with custom emoji/text (e.g., mud, clown_horn, banana_peel)
- **Passive**: Sits in inventory, triggers automatically (e.g., reverse_card — checked in mud handler)

## Key Patterns
- `_return_item()` puts consumed item back in inventory on error
- `_validate_target()` handles target lookup with auto-return on error
- `_make_state()` builds state response with version bump + cache
- Shield check: `getattr(target, 'make67_shield_until', None) and target.make67_shield_until > now_dt`
- Non-stackable check: Same pattern for any effect column
- Broadcast: `_m67_broadcast({'type': '...', 'user_id': u.id, ...})`
- Frontend toast: `showToast('emoji text message')`
- Frontend targeting: `pickTarget({text:'...', emoji:'...', canTargetMudded:bool})`

## Testing
1. `python -c "import py_compile; py_compile.compile('app.py', doraise=True)"`
2. `node --check static/js/make67.js && node --check static/js/make6or7.js`
3. Test shop endpoint returns new item: `GET /api/make67/shop`
4. Test use endpoint rejects unauthenticated: `POST /api/make67/use`
