#!/usr/bin/env python3
"""
Make67 Auto Solver (standalone)

This script opens a browser, navigates to the Make67 page on your deployed site (or local dev),
reads each puzzle's four cards, computes a solution using + - * / with parentheses, and then
clicks the UI to solve it. After the success overlay appears, it clicks "New puzzle" and repeats.

It does not modify the web app. It only automates the browser like a user would.

Prerequisites (install into your local environment, not the app's server environment):
  pip install --upgrade selenium webdriver-manager

Usage examples:
  # Solve 10 puzzles on local dev, with a visible browser window
  python tools/make67_solver.py --url http://localhost:5000/make67 --count 10

  # Solve 25 puzzles on deployed site, headless Chrome
  python tools/make67_solver.py --url https://<YOUR_DOMAIN>/make67 --count 25 --headless

Authentication:
- The page shows a Google "Sign in" button if you are not logged in. This script will detect that and
  wait for you to complete login manually. Once logged in, the script will continue automatically.
- Tip: leave the browser window open; re-running the script may reuse the existing signed-in session.

Notes:
- The solver supports fractional intermediate values (just like the frontend) and aims for 67 within 1e-6.
- Operations are executed in the exact click order required by the UI: select first card, click op, select second card.
"""
import argparse
import os
import math
import sys
import time
import random
from dataclasses import dataclass
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException, WebDriverException
from webdriver_manager.chrome import ChromeDriverManager

TOL = 1e-6

@dataclass
class Step:
    a: float
    b: float
    op: str  # one of '+', '-', '*', '/'


def approx_equal(x: float, y: float, tol: float = TOL) -> bool:
    return abs(x - y) <= tol


def parse_number_text(txt: str) -> float:
    # Normalize minus symbols and whitespace
    txt = (txt or '').strip().replace('\u2212', '-')  # U+2212 minus to hyphen
    # Some locales could add commas; remove them
    txt = txt.replace(',', '')
    try:
        return float(txt)
    except Exception:
        # As a backstop, try evaluating simple fractions like "1/2" if ever displayed
        if '/' in txt and all(p.strip().lstrip('-').isdigit() for p in txt.split('/', 1)):
            num, den = txt.split('/', 1)
            try:
                den_f = float(den)
                if den_f == 0:
                    return math.nan
                return float(num) / den_f
            except Exception:
                pass
        raise


# ---------------------- Solver ----------------------

def try_solve(nums: List[float], targets: List[float] = [67.0], allowed_ops: List[str] = ['+', '-', '*', '/']) -> Optional[List[Step]]:
    """Return a list of Step to reach one of the targets (within TOL), or None if no solution.
    Randomizes the search order to generate varied solutions for the same inputs.
    """
    nums = [float(x) for x in nums]
    # Include negative targets if they are also valid in UI
    all_targets = set()
    for t in targets:
        all_targets.add(t)
        all_targets.add(-t)

    def dfs(values: List[float]) -> Optional[List[Step]]:
        if len(values) == 1:
            return [] if any(approx_equal(values[0], t) for t in all_targets) else None

        n = len(values)
        # Try all ordered pairs (i, j) with i != j, randomized
        pairs = []
        for i in range(n):
            for j in range(n):
                if i != j:
                    pairs.append((i, j))
        random.shuffle(pairs)

        for i, j in pairs:
            a, b = values[i], values[j]
            rest = [values[k] for k in range(n) if k not in (i, j)]

            # Randomized operators
            ops = allowed_ops[:]
            random.shuffle(ops)
            for op in ops:
                r = None
                if op == '+':
                    r = a + b
                elif op == '-':
                    r = a - b
                elif op == '*':
                    r = a * b
                elif op == '/':
                    if not approx_equal(b, 0.0):
                        r = a / b
                
                if r is not None and math.isfinite(r):
                    steps = dfs(rest + [r])
                    if steps is not None:
                        return [Step(a, b, op)] + steps
        return None

    return dfs(nums)


# ---------------- Selenium helpers ------------------

class Make67Bot:
    def __init__(self, url: str, headless: bool, timeout: int = 20,
                 debugger_address: Optional[str] = None,
                 user_data_dir: Optional[str] = None,
                 profile_directory: Optional[str] = None,
                 browser_binary: Optional[str] = None,
                 evasion: bool = True,
                 safe_mode: bool = True,
                 action_delay_range: Tuple[float, float] = (0.15, 0.35),
                 puzzle_seconds_range: Tuple[float, float] = (4.2, 6.0)):
        self.url = url
        self.timeout = timeout
        self._evasion = evasion
        # Human-like pacing controls to bypass server-side cheater heuristics
        self._safe_mode = safe_mode
        self._action_delay_range = action_delay_range
        self._puzzle_seconds_range = puzzle_seconds_range
        self._debugger_address = debugger_address
        # Parse target host to detect when OAuth leaves our site
        self._target = urlparse(url)
        self._target_host = (self._target.netloc or '').lower().lstrip()
        if self._target_host.startswith('www.'):
            self._target_host = self._target_host[4:]
        options = ChromeOptions()
        # Attach to existing Chrome if debugger address supplied
        if debugger_address:
            options.debugger_address = debugger_address
            # When attaching to an existing Chrome, ignore headless flag
            headless = False
            print(f"Attaching to existing Chrome at {debugger_address}...")
        if browser_binary:
            options.binary_location = browser_binary
        if headless:
            options.add_argument('--headless=new')
        # Persistent profile flags
        if user_data_dir:
            options.add_argument(f'--user-data-dir={user_data_dir}')
        if profile_directory:
            options.add_argument(f'--profile-directory={profile_directory}')
        # Common stability flags
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1280,900')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        # Basic automation evasion
        if evasion:
            # Pick a random modern User-Agent
            uas = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
            ]
            options.add_argument(f'user-agent={random.choice(uas)}')
            options.add_experimental_option('excludeSwitches', ['enable-automation'])
            options.add_experimental_option('useAutomationExtension', False)
            options.add_argument('--disable-blink-features=AutomationControlled')
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        # Inject small evasion script for webdriver marker and some navigator fields
        if evasion:
            try:
                self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                    'source': (
                        'Object.defineProperty(navigator, "webdriver", {get: () => undefined});'
                        'Object.defineProperty(navigator, "platform", {get: () => "Win32"});'
                        'Object.defineProperty(navigator, "languages", {get: () => ["en-US", "en"]});'
                        'Object.defineProperty(navigator, "plugins", {get: () => [1,2,3]});'
                    )
                })
            except Exception:
                pass
        self.wait = WebDriverWait(self.driver, timeout)

    # --- Timing helpers (human-like pacing) ---
    def _sleep_action(self):
        """Small randomized delay between human actions (clicks/ops)."""
        if not self._safe_mode:
            return
        lo, hi = self._action_delay_range
        try:
            time.sleep(random.uniform(lo, hi))
        except Exception:
            time.sleep(lo)

    def _ensure_min_puzzle_duration(self, started_at: float):
        """Ensure each puzzle takes at least N seconds overall to avoid rate flags."""
        if not self._safe_mode:
            return
        lo, hi = self._puzzle_seconds_range
        target = random.uniform(lo, hi)
        elapsed = time.time() - started_at
        remain = target - elapsed
        if remain > 0:
            time.sleep(remain)

    def close(self):
        try:
            self.driver.quit()
        except Exception:
            pass

    # --- Page/DOM ---
    def open(self):
        try:
            self.driver.get(self.url)
        except WebDriverException as e:
            # If user pointed to localhost but server isn't running, fall back to live site
            msg = str(e)
            if (
                ('ERR_CONNECTION_REFUSED' in msg or 'ERR_CONNECTION_FAILED' in msg)
                and (self._target_host in ('localhost', '127.0.0.1'))
            ):
                fallback = 'https://make67.com/make67'
                print(f"Connection refused for {self.url}. Falling back to {fallback} ...")
                # Update target to live site so host checks work
                self.url = fallback
                self._target = urlparse(self.url)
                self._target_host = (self._target.netloc or '').lower().lstrip()
                if self._target_host.startswith('www.'):
                    self._target_host = self._target_host[4:]
                self.driver.get(self.url)
            else:
                raise
        self.ensure_on_game_page()

    def _current_host(self) -> str:
        try:
            cur = urlparse(self.driver.current_url)
            host = (cur.netloc or '').lower()
            if host.startswith('www.'):
                host = host[4:]
            return host
        except Exception:
            return ''

    def _on_target_host(self) -> bool:
        host = self._current_host()
        return bool(host) and (host == self._target_host or host.endswith('.' + self._target_host))

    def ensure_on_game_page(self, wait_cards: bool = True):
        if not self._on_target_host():
            # always navigate to our game page
            self.driver.get(self.url)
        else:
            # if on target host but not the game page, navigate to it
            if '/make67' not in urlparse(self.driver.current_url).path:
                self.driver.get(self.url)
        if wait_cards:
            self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.make67-page .card')))
            self.wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.make67-page .op-btn[data-op]')))

    def is_logged_in(self) -> bool:
        # Only consider auth when we are on our site
        if not self._on_target_host():
            return False
        try:
            # If login button exists on our page, we're not logged in
            self.driver.find_element(By.CSS_SELECTOR, '.google-login-btn')
            return False
        except Exception:
            # No login button; assume authenticated
            return True

    def wait_for_login(self, max_seconds: int = 180) -> bool:
        """Wait until we're back on the target host and logged in. Keeps waiting during OAuth on Google.
        Returns True if logged-in detected before timeout, else False.
        Also detects Google's "This browser or app may not be secure" block and prints guidance.
        """
        start = time.time()
        last_report = -999
        printed_tip = False
        while time.time() - start < max_seconds:
            # If we're not on our host yet (likely in OAuth), keep waiting
            if not self._on_target_host():
                # Detect Google insecure-browser block and provide guidance
                try:
                    host = self._current_host()
                except Exception:
                    host = ''
                if ('google.' in host) or ('accounts.google.' in host):
                    try:
                        html = (self.driver.page_source or '')
                    except Exception:
                        html = ''
                    if (('This browser or app may not be secure' in html) or ('Try using a different browser' in html)) and not printed_tip:
                        printed_tip = True
                        print('\nDetected Google blocking sign-in in automated browser context.')
                        print('Recommended options:')
                        print('  1) Attach to an already-open Chrome session:')
                        print('     - Close the script. In PowerShell:')
                        print('       & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\Temp\\chrome-solver"')
                        print('       Sign in to Google in that Chrome window, then re-run:')
                        print('       python tools\\make67_solver.py --url https://make67.com/make67 --count 25 --debugger-address 127.0.0.1:9222')
                        print('  2) Or launch Selenium with a persistent profile and evasion:')
                        print('       python tools\\make67_solver.py --url https://make67.com/make67 --count 25 --user-data-dir "C:\\Temp\\chrome-solver"')
                        print('     If needed, disable headless and keep evasion on (default). You can also add --profile-directory Default')
                        print('If the block persists, press Ctrl+C and retry with the flags above.')
                now = time.time() - start
                if now - last_report >= 5:
                    remaining = int(max_seconds - (time.time() - start))
                    print(f'Waiting for login (OAuth)... {remaining}s left')
                    last_report = now
                time.sleep(0.5)
                continue
            # On our host; check login widgets
            if self.is_logged_in():
                return True
            now = time.time() - start
            if now - last_report >= 5:
                remaining = int(max_seconds - (time.time() - start))
                print(f'Waiting for login on site... {remaining}s left')
                last_report = now
            time.sleep(0.5)
        return False

    def read_cards(self) -> List[Tuple[int, float]]:
        """Return list of (index, value) for cards that are not removed."""
        cards = self.driver.find_elements(By.CSS_SELECTOR, '.make67-page .card')
        result = []
        for el in cards:
            cls = el.get_attribute('class') or ''
            if 'removed' in cls:
                continue
            idx_str = el.get_attribute('data-index')
            try:
                idx = int(idx_str)
            except Exception:
                # fallback to sequential order if data-index missing
                idx = len(result)
            span = el.find_element(By.TAG_NAME, 'span')
            txt = span.text
            val = parse_number_text(txt)
            result.append((idx, val))
        return result

    def click_card_by_value(self, target: float, used_indices: Optional[set] = None) -> int:
        """Click a visible, non-removed card whose value ~= target. Returns the data-index clicked."""
        used_indices = used_indices or set()
        cards = self.driver.find_elements(By.CSS_SELECTOR, '.make67-page .card')
        # Build a list with current numeric values
        candidates: List[Tuple[int, float, object]] = []
        for el in cards:
            cls = el.get_attribute('class') or ''
            if 'removed' in cls:
                continue
            idx = int(el.get_attribute('data-index') or -1)
            if idx in used_indices:
                continue
            span = el.find_element(By.TAG_NAME, 'span')
            val = parse_number_text(span.text)
            candidates.append((idx, val, el))
        # Try exact within tolerance
        for idx, val, el in candidates:
            if approx_equal(val, target):
                self._sleep_action()
                el.click()
                return idx
        # If not found, allow a looser tolerance (animation rounding)
        for idx, val, el in candidates:
            if approx_equal(val, target, 1e-4):
                self._sleep_action()
                el.click()
                return idx
        raise RuntimeError(f"No card found matching value {target} among {[(i, v) for i, v, _ in candidates]}")

    def click_operator(self, op: str):
        op_map = {
            '+': '[data-op="+"]',
            '-': '[data-op="-"]',
            '*': '[data-op="*"]',
            '/': '[data-op="/"]',
        }
        # Support both 'op-btn' and 'm67-op-btn'
        sel = '.make67-page .op-btn' + op_map[op] + ', .make67-page .m67-op-btn' + op_map[op]
        btn = self.driver.find_element(By.CSS_SELECTOR, sel)
        self._sleep_action()
        btn.click()

    def wait_merge_complete(self, removed_idx: int, timeout: int = 10):
        """Wait until the card with given data-index obtains 'removed' class (merge animation done)."""
        end_time = time.time() + timeout
        while time.time() < end_time:
            try:
                el = self.driver.find_element(By.CSS_SELECTOR, f'.make67-page .card[data-index="{removed_idx}"]')
                cls = el.get_attribute('class') or ''
                if 'removed' in cls:
                    return
            except StaleElementReferenceException:
                pass
            time.sleep(0.05)
        raise TimeoutException('Timed out waiting for merge animation to complete')

    def wait_success_overlay(self, timeout: int = 10):
        """Wait for success overlay to appear (overlayRoot.hidden === false)."""
        end_time = time.time() + timeout
        while time.time() < end_time:
            try:
                hidden = self.driver.execute_script(
                    'return !!document.querySelector(".m67-overlay-root")?.hidden;'
                )
                # When hidden is False (or property removed), overlay is visible
                if hidden is False:
                    return
            except Exception:
                pass
            time.sleep(0.05)
        raise TimeoutException('Timed out waiting for success overlay')

    def click_new_puzzle(self):
        btn = self.driver.find_element(By.ID, 'nextPuzzleBtn')
        btn.click()
        # Give a small moment for cards to reset
        time.sleep(0.15)

    # --- High level ---
    def solve_one_puzzle(self) -> bool:
        # Read current cards
        started_at = time.time()
        # Pick a target duration for this puzzle (before final success) for safe pacing
        if self._safe_mode:
            lo, hi = self._puzzle_seconds_range
            target_duration = random.uniform(lo, hi)
        else:
            target_duration = 0.0
        cards = self.read_cards()
        if len(cards) != 4:
            # Try to recover by navigating back to the game page and re-reading
            try:
                self.ensure_on_game_page()
                time.sleep(0.2)
                cards = self.read_cards()
            except Exception:
                pass
            if len(cards) != 4:
                cur_url = ''
                try:
                    cur_url = self.driver.current_url
                except Exception:
                    pass
                raise RuntimeError(f'Expected 4 active cards (URL: {cur_url}), found: {cards}')
        nums = [v for _, v in cards]
        # Auto-detect target and allowed ops based on URL
        is_6or7 = 'make6or7' in self.url
        targets = [6.0, 7.0] if is_6or7 else [67.0]
        allowed_ops = ['+', '-'] if is_6or7 else ['+', '-', '*', '/']
        
        plan = try_solve(nums, targets=targets, allowed_ops=allowed_ops)
        if plan is None:
            raise RuntimeError(f"No solution found by solver for {nums} (Mode: {'Make 6 or 7' if is_6or7 else 'Make 67'})")

        # Execute plan as UI clicks
        for i, step in enumerate(plan):
            used = set()
            idx_a = self.click_card_by_value(step.a, used_indices=used)
            used.add(idx_a)
            self.click_operator(step.op)
            # If this is the final step, ensure we meet the minimum puzzle time BEFORE the final merge
            if self._safe_mode and i == (len(plan) - 1):
                # Leave a small buffer for the animation/overlay
                elapsed = time.time() - started_at
                buffer = 0.20
                wait_more = (target_duration - buffer) - elapsed
                if wait_more > 0:
                    time.sleep(wait_more)
            idx_b = self.click_card_by_value(step.b, used_indices=used)
            # Wait until idx_a card gets removed
            self.wait_merge_complete(idx_a)
            # Small pause to keep in sync with UI animations
            time.sleep(0.08)

        # After all steps, wait for success overlay
        self.wait_success_overlay()
        return True


def main():
    parser = argparse.ArgumentParser(description='Auto-solve the Make67 game in a browser.')
    parser.add_argument(
        '--url',
        default=os.environ.get('MAKE67_URL', 'https://make67.com/make67'),
        help='URL of the Make67 page (default: env MAKE67_URL or https://make67.com/make67)'
    )
    parser.add_argument('--count', type=int, default=5, help='Number of puzzles to solve (default: 5)')
    parser.add_argument('--headless', action='store_true', help='Run Chrome headless')
    parser.add_argument('--wait-login', type=int, default=180, help='Seconds to wait for manual login if needed (default: 180)')
    # New auth/session persistence and anti-detection options
    parser.add_argument('--debugger-address', help='Attach to an existing Chrome remote debugging instance, e.g., 127.0.0.1:9222')
    parser.add_argument('--user-data-dir', dest='user_data_dir', help='Chrome user-data-dir path for persistent profile (e.g., C:\\Temp\\chrome-solver)')
    parser.add_argument('--profile-directory', dest='profile_directory', help='Chrome profile directory name (e.g., Default)')
    parser.add_argument('--browser-binary', dest='browser_binary', help='Path to Chrome executable if not on PATH')
    parser.add_argument('--no-evasion', dest='evasion', action='store_false', help='Disable automation-evasion settings (enabled by default)')
    # Human-like pacing / cheater bypass controls
    parser.add_argument('--no-safe-mode', dest='safe_mode', action='store_false', help='Disable human-like delays that keep solve rate under server thresholds')
    parser.add_argument('--min-action-delay', type=float, default=0.15, help='Minimum delay (seconds) between UI actions when safe-mode is on')
    parser.add_argument('--max-action-delay', type=float, default=0.35, help='Maximum delay (seconds) between UI actions when safe-mode is on')
    parser.add_argument('--min-puzzle-seconds', type=float, default=4.2, help='Minimum total seconds a puzzle should take before the final merge (safe-mode)')
    parser.add_argument('--max-puzzle-seconds', type=float, default=6.0, help='Maximum total seconds a puzzle should take before the final merge (safe-mode)')
    parser.set_defaults(evasion=True)
    parser.set_defaults(safe_mode=True)
    args = parser.parse_args()

    bot = Make67Bot(
        args.url,
        headless=args.headless,
        debugger_address=args.debugger_address,
        user_data_dir=args.user_data_dir,
        profile_directory=args.profile_directory,
        browser_binary=args.browser_binary,
        evasion=args.evasion,
        safe_mode=args.safe_mode,
        action_delay_range=(max(0.0, args.min_action_delay), max(0.0, args.max_action_delay)),
        puzzle_seconds_range=(max(0.0, args.min_puzzle_seconds), max(0.0, args.max_puzzle_seconds)),
    )
    try:
        print(f'Using URL: {args.url}')
        bot.open()
        if not bot.is_logged_in():
            print('You appear to be logged out. Please complete login in the browser window...')
            ok = bot.wait_for_login(args.wait_login)
            if not ok:
                print('Login not detected in time. You can still play without recording all-time scores, but solves may not be counted.', file=sys.stderr)
        else:
            print('Logged in detected. Solves will be counted.')

        # Always ensure we are back on the Make67 game page before starting
        bot.ensure_on_game_page()

        solved = 0
        for k in range(args.count):
            print(f'Puzzle {k+1} of {args.count}: reading cards and solving...')
            ok = bot.solve_one_puzzle()
            if ok:
                solved += 1
                print('  ✓ Solved. Moving to next puzzle...')
                # Small natural pause before starting a new puzzle (extra realism)
                if args.safe_mode:
                    time.sleep(random.uniform(0.3, 1.0))
                bot.click_new_puzzle()
            else:
                print('  ! Unexpected state; stopping.')
                break
        print(f'Done. Solved {solved}/{args.count} puzzles.')
    finally:
        # Keep the window open a moment if headless is off, so the user can see results
        if not args.headless:
            time.sleep(1.0)
        bot.close()


if __name__ == '__main__':
    main()
