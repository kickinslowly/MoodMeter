from flask import Flask, render_template, request, jsonify, redirect, url_for
import csv
from pathlib import Path
import os
from datetime import datetime, timezone, timedelta
import uuid
import random
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate, upgrade as alembic_upgrade
from flask_login import LoginManager, UserMixin, current_user, logout_user, login_user
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
from functools import lru_cache

# Load environment variables from a .env file if present
load_dotenv()


def get_database_url() -> str:
    url = os.environ.get('DATABASE_URL') or os.environ.get('DATABASE_URI')
    if not url:
        # Default to a local SQLite file in the project directory
        return 'sqlite:///' + str((Path(__file__).parent / 'moodmeter.db').resolve())
    # Normalize legacy postgres URL scheme
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    # Ensure SSL is required for Postgres if not explicitly set
    try:
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        parsed = urlparse(url)
        if parsed.scheme.startswith('postgresql'):
            qs = dict(parse_qsl(parsed.query, keep_blank_values=True))
            if 'sslmode' not in qs:
                qs['sslmode'] = 'require'
                new_query = urlencode(qs)
                url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
    except Exception:
        # If parsing fails, just return original url
        pass
    return url


# Resolve base directory for explicit template/static paths
BASE_DIR = Path(__file__).parent.resolve()
app = Flask(
    __name__,
    template_folder=str(BASE_DIR / 'templates'),
    static_folder=str(BASE_DIR / 'static'),
)
# Secret key should be overridden in production via env var
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-insecure-secret')
app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Harden DB connection handling for cloud environments (e.g., Render) to avoid
# stale/SSL-broken pooled connections causing OperationalError
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,           # validate connection before use
    'pool_recycle': 300,             # seconds; less than typical NAT/pgbouncer idle timeouts
}

# OAuth / Google configuration via environment
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID')
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get('GOOGLE_CLIENT_SECRET')
app.config['GOOGLE_AUTH_ENABLED'] = bool(app.config['GOOGLE_CLIENT_ID'] and app.config['GOOGLE_CLIENT_SECRET'])

# OAuth client
oauth = OAuth(app)
if app.config['GOOGLE_AUTH_ENABLED']:
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'},
    )

# Extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager(app)


def _auto_upgrade_db():
    """Attempt to auto-apply Alembic migrations on startup.
    Safe to run multiple times; no-op if already up-to-date.
    Any failure is logged but won't crash the app.
    """
    try:
        with app.app_context():
            alembic_upgrade()
            app.logger.info("Database schema is up to date (auto-upgrade successful).")
    except Exception as e:
        # Log and continue; app might still work if schema already compatible
        try:
            app.logger.warning(f"Auto DB upgrade failed: {e}")
        except Exception:
            # logger might not be ready in some contexts; ignore
            pass


# Run migrations right after extensions initialization, before any DB usage
_auto_upgrade_db()


# Models
class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    name = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(512), nullable=True)
    provider = db.Column(db.String(50), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='student')  # 'student' or 'teacher'
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    make67_all_time_solves = db.Column(db.Integer, nullable=False, default=0)


class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    teacher = db.relationship('User', backref=db.backref('teaching_groups', lazy=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class GroupMember(db.Model):
    __tablename__ = 'group_members'
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False, index=True)
    student_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    group = db.relationship('Group', backref=db.backref('members', cascade='all, delete-orphan', lazy=True))
    student = db.relationship('User')


class Session(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True)
    pin = db.Column(db.String(10), unique=True, nullable=False, index=True)
    owner_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True, index=True)
    owner = db.relationship('User')
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)


class MoodSubmission(db.Model):
    __tablename__ = 'mood_submissions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True, index=True)
    user = db.relationship('User', backref=db.backref('mood_submissions', lazy=True))
    x = db.Column(db.Integer, nullable=False)
    y = db.Column(db.Integer, nullable=False)
    label = db.Column(db.String(255), nullable=True)
    chosen_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    ip = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=True, index=True)


@login_manager.user_loader
def load_user(user_id: str):
    # Basic user loader for Flask-Login; will be used once Google auth is added
    return db.session.get(User, user_id)


# Utility to get client IP (accounts for reverse proxy like Render)
def get_client_ip() -> str | None:
    xfwd = request.headers.get('X-Forwarded-For')
    if xfwd:
        # X-Forwarded-For may contain a list; use first (original client)
        return xfwd.split(',')[0].strip()
    return request.remote_addr


def get_last_submission(user_id: str):
    """Return the latest MoodSubmission for the given user_id, or None."""
    return (
        MoodSubmission.query
        .filter(MoodSubmission.user_id == user_id)
        .order_by(MoodSubmission.created_at.desc())
        .first()
    )


def load_grid_from_csv(csv_path: Path):
    """
    Loads a grid of labels from the CSV file. The first row is assumed to be x-axis indices
    and is skipped from the grid. Remaining 10 rows form a 10x10 grid from top (high energy)
    to bottom (low energy).
    """
    grid = []
    with csv_path.open(newline='') as f:
        reader = csv.reader(f)
        rows = [row for row in reader if any(cell.strip() for cell in row)]
    if not rows:
        return grid
    # Skip the first row if it looks like numeric axis labels
    first_row = rows[0]
    if all(cell.strip().isdigit() for cell in first_row):
        data_rows = rows[1:]
    else:
        data_rows = rows
    for r in data_rows:
        # Ensure exactly 10 columns by trimming/padding
        r = [cell.strip() for cell in r]
        if len(r) < 10:
            r = r + [""] * (10 - len(r))
        elif len(r) > 10:
            r = r[:10]
        grid.append(r)
    # Ensure exactly 10 rows by trimming/padding
    if len(grid) < 10:
        for _ in range(10 - len(grid)):
            grid.append([""] * 10)
    elif len(grid) > 10:
        grid = grid[:10]
    return grid


@lru_cache(maxsize=1)
def _load_grid_cached(path_str: str, mtime):
    return load_grid_from_csv(Path(path_str))


def get_label_grid() -> list[list[str]]:
    """Return the 10x10 label grid from CSV with simple mtime-based caching."""
    csv_path = Path(__file__).parent / 'Mood_Meter_DataFrame.csv'
    try:
        mtime = os.path.getmtime(csv_path)
    except Exception:
        mtime = None
    return _load_grid_cached(str(csv_path), mtime)


def _ordinal(n: int) -> str:
    n = int(n)
    if 11 <= (n % 100) <= 13:
        return 'th'
    last = n % 10
    if last == 1:
        return 'st'
    if last == 2:
        return 'nd'
    if last == 3:
        return 'rd'
    return 'th'


def format_last_entry(dt: datetime) -> str:
    """Format a datetime like 'October 10th at 3:35 PM'.
    Uses the datetime's own timezone if present; otherwise treats as UTC.
    """
    try:
        d = dt
        # Build components to avoid platform-specific %-I/%#I issues
        month = d.strftime('%B')
        day = d.day
        hour24 = d.hour
        minute = d.minute
        ampm = 'AM' if hour24 < 12 else 'PM'
        hour12 = hour24 % 12
        if hour12 == 0:
            hour12 = 12
        return f"{month} {day}{_ordinal(day)} at {hour12}:{minute:02d} {ampm}"
    except Exception:
        # Fallback: ISO formatting
        return dt.isoformat()


@app.route('/')
def index():
    grid = get_label_grid()
    size = 10 if grid else 0
    # Determine last entry for the logged-in user (if any)
    last_entry_str = None
    if getattr(current_user, 'is_authenticated', False):
        last = get_last_submission(current_user.get_id())
        if last and last.chosen_at:
            last_entry_str = format_last_entry(last.chosen_at)
    return render_template('index.html', grid=grid, size=size, last_entry=last_entry_str)


@app.route('/make67')
def make67_page():
    """Fun math mini-game: Make 67 from 4 cards using + - * /.
    Standalone page; does not affect the rest of the site.
    """
    return render_template('make67.html')


@app.route('/api/last-entry', methods=['GET'])
def api_last_entry():
    """Return the latest mood entry info for the current authenticated user.
    Always queries the database for the most recent record (by created_at desc).
    """
    try:
        if not getattr(current_user, 'is_authenticated', False):
            return jsonify({"ok": True, "last_entry": None, "chosen_at": None, "created_at": None, "id": None})
        last = get_last_submission(current_user.get_id())
        if not last:
            return jsonify({"ok": True, "last_entry": None, "chosen_at": None, "created_at": None, "id": None})
        formatted = format_last_entry(last.chosen_at) if last.chosen_at else None
        return jsonify({
            "ok": True,
            "last_entry": formatted,
            "chosen_at": (last.chosen_at.isoformat() if last.chosen_at else None),
            "created_at": (last.created_at.isoformat() if last.created_at else None),
            "id": last.id,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": "SERVER_ERROR", "detail": str(e)}), 500


@app.route('/click', methods=['POST'])
def record_click():
    data = request.get_json(force=True, silent=True) or {}
    # Expected payload: {x: int, y: int, label: str, ts: int(ms or s), tzOffset: int(minutes, optional), tzName: str(optional)}
    x = data.get('x')
    y = data.get('y')
    label = data.get('label')
    ts = data.get('ts')
    tz_offset = data.get('tzOffset')  # minutes offset from UTC (local = UTC + tz_offset)

    if not isinstance(x, int) or not isinstance(y, int):
        return jsonify({"ok": False, "error": "Invalid coordinates"}), 400
    # Optional bounds check for a 10x10 grid
    if not (0 <= x < 10 and 0 <= y < 10):
        return jsonify({"ok": False, "error": "Coordinates out of bounds"}), 400

    # Enforce 10-minute per-user throttle for authenticated users
    user_id = current_user.get_id() if getattr(current_user, 'is_authenticated', False) else None
    if user_id:
        last = get_last_submission(user_id)
        if last is not None and last.created_at is not None:
            now_utc = datetime.now(timezone.utc)
            last_created = last.created_at
            # Normalize to timezone-aware UTC to avoid naive/aware comparison errors
            if getattr(last_created, 'tzinfo', None) is None:
                last_created = last_created.replace(tzinfo=timezone.utc)
            else:
                last_created = last_created.astimezone(timezone.utc)
            cutoff = last_created + timedelta(minutes=10)
            if now_utc < cutoff:
                retry_after = max(0, int((cutoff - now_utc).total_seconds()))
                return jsonify({
                    "ok": False,
                    "error": "TOO_SOON",
                    "message": "You can only record a mood once every 10 minutes.",
                    "retry_after": retry_after,
                    "last_entry": (format_last_entry(last.chosen_at) if last.chosen_at else None),
                }), 429

    # Determine chosen_at timestamp using client local timezone if provided
    chosen_at = None
    if isinstance(ts, (int, float)):
        # If this looks like JavaScript ms epoch, convert to seconds
        seconds = ts / 1000.0 if ts > 1_000_000_000_000 else ts
        try:
            if isinstance(tz_offset, (int, float)):
                # JS getTimezoneOffset returns minutes to add to local time to get UTC, but we expect
                # tz_offset here to be local offset from UTC (e.g., -420 for PDT). Frontend will send that.
                tzinfo = timezone(timedelta(minutes=int(tz_offset)))
                chosen_at = datetime.fromtimestamp(seconds, tz=tzinfo)
            else:
                # Fallback to UTC
                chosen_at = datetime.fromtimestamp(seconds, tz=timezone.utc)
        except Exception:
            chosen_at = datetime.now(timezone.utc)
    else:
        chosen_at = datetime.now(timezone.utc)

    try:
        # Optional session association via provided session_id
        valid_session_id = None
        raw_sid = data.get('session_id') or data.get('sessionId')
        try:
            raw_sid_int = int(raw_sid) if raw_sid is not None else None
        except Exception:
            raw_sid_int = None
        if isinstance(raw_sid_int, int):
            s = db.session.get(Session, raw_sid_int)
            if s and getattr(s, 'active', True):
                valid_session_id = raw_sid_int
        sub = MoodSubmission(
            user_id=user_id,
            x=x,
            y=y,
            label=label,
            chosen_at=chosen_at,
            ip=get_client_ip(),
            session_id=valid_session_id,
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"ok": False, "error": "DB_ERROR", "detail": str(e)}), 500


@app.route('/me')
def me():
    if getattr(current_user, 'is_authenticated', False):
        return jsonify({
            "authenticated": True,
            "user": {
                "id": current_user.get_id(),
                "email": getattr(current_user, 'email', None),
                "name": getattr(current_user, 'name', None),
                "provider": getattr(current_user, 'provider', None),
            }
        })
    return jsonify({"authenticated": False})


@app.route('/login')
def login_view():
    # Start Google OAuth flow if configured
    if not app.config.get('GOOGLE_AUTH_ENABLED'):
        return jsonify({"ok": False, "error": "LOGIN_DISABLED", "message": "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment."}), 503
    # Use the Google Console configured redirect URI
    redirect_uri = url_for('login_authorized', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

# OAuth2 callback routes (support both /login/authorized and /auth/callback)
@app.route('/login/authorized', endpoint='login_authorized')
@app.route('/auth/callback')
def auth_google_callback():
    if not app.config.get('GOOGLE_AUTH_ENABLED'):
        return jsonify({"ok": False, "error": "LOGIN_DISABLED"}), 503
    try:
        token = oauth.google.authorize_access_token()
        # Fetch user info via the OIDC userinfo endpoint
        resp = oauth.google.get('https://openidconnect.googleapis.com/v1/userinfo')
        userinfo = resp.json() if resp else {}
        email = userinfo.get('email')
        name = userinfo.get('name') or userinfo.get('given_name')
        avatar = userinfo.get('picture')
    except Exception as e:
        return jsonify({"ok": False, "error": "AUTH_FAILED", "detail": str(e)}), 400

    if not email:
        return jsonify({"ok": False, "error": "EMAIL_REQUIRED", "message": "Google account did not return an email."}), 400

    # Find or create the user
    user = User.query.filter_by(email=email).first()
    if not user:
        # New users default to student role (will be elevated below if super email)
        user = User(email=email, name=name, avatar_url=avatar, provider='google', role='student')
        db.session.add(user)
    else:
        # Update basic profile fields if changed
        user.name = name or user.name
        user.avatar_url = avatar or user.avatar_url
        user.provider = user.provider or 'google'

    # Auto-elevate super user by email
    try:
        if email.lower() == 'kickinslowly@gmail.com':
            user.role = 'super'
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"ok": False, "error": "DB_ERROR"}), 500

    login_user(user, remember=True)
    # Super user goes straight to dashboard
    if user.role == 'super':
        return redirect(url_for('dashboard'))
    return redirect(url_for('index'))


@app.route('/logout', methods=['POST', 'GET'])
def logout_view():
    if getattr(current_user, 'is_authenticated', False):
        logout_user()
    # Redirect back to home page after logout so the UI reflects logged-out state
    return redirect(url_for('index'))


# --------- Dashboard helpers ---------
from collections import Counter, defaultdict
from typing import Optional, Iterable, Tuple


def _parse_dt_filters():
    """Parse date/time filters from request args. Returns (date_from, date_to, time_from, time_to) as strings or None.
    Dates as YYYY-MM-DD; times as HH:MM (24h)."""
    df = request.args.get('date_from') or None
    dt = request.args.get('date_to') or None
    tf = request.args.get('time_from') or None
    tt = request.args.get('time_to') or None
    return df, dt, tf, tt


def _apply_filters(query, date_from: Optional[str], date_to: Optional[str], time_from: Optional[str], time_to: Optional[str]):
    """Apply date and time filters on MoodSubmission.chosen_at (UTC)."""
    if date_from:
        try:
            start = datetime.strptime(date_from, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            query = query.filter(MoodSubmission.chosen_at >= start)
        except Exception:
            pass
    if date_to:
        try:
            # inclusive end of day
            end = datetime.strptime(date_to, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            # add one day
            end = end.replace(hour=0, minute=0, second=0, microsecond=0)
            end = end + timedelta(days=1)
            query = query.filter(MoodSubmission.chosen_at < end)
        except Exception:
            pass
    # Time filtering (by hour/minute within day in UTC)
    if time_from or time_to:
        # SQL expression to extract hour and minute; fallback to Python filter if unsupported
        try:
            from sqlalchemy import extract
            if time_from:
                hh, mm = [int(p) for p in time_from.split(':')]
                mins_from = hh * 60 + mm
                query = query.filter((extract('hour', MoodSubmission.chosen_at) * 60 + extract('minute', MoodSubmission.chosen_at)) >= mins_from)
            if time_to:
                hh, mm = [int(p) for p in time_to.split(':')]
                mins_to = hh * 60 + mm
                query = query.filter((extract('hour', MoodSubmission.chosen_at) * 60 + extract('minute', MoodSubmission.chosen_at)) <= mins_to)
        except Exception:
            pass
    return query


def _compute_stats(submissions: Iterable[MoodSubmission]):
    """Compute basic stats and a 10x10 heatmap from iterable of MoodSubmission."""
    total = 0
    heat = [[0 for _ in range(10)] for _ in range(10)]
    labels = []
    # aggregations
    # Pleasantness (x) groupings
    by_hour_vals: dict[int, list[int]] = defaultdict(list)  # hour -> list of x (pleasantness)
    by_month_vals: dict[int, list[int]] = defaultdict(list)
    by_dow_vals: dict[int, list[int]] = defaultdict(list)  # 0 Mon .. 6 Sun
    # Energy (y) groupings
    by_hour_energy: dict[int, list[int]] = defaultdict(list)
    by_month_energy: dict[int, list[int]] = defaultdict(list)
    by_dow_energy: dict[int, list[int]] = defaultdict(list)

    # Overall average accumulators (within bounds only)
    sum_x = 0
    sum_y = 0
    n_valid = 0

    for s in submissions:
        total += 1
        if 0 <= s.x < 10 and 0 <= s.y < 10:
            heat[s.y][s.x] += 1
            sum_x += s.x
            sum_y += s.y
            n_valid += 1
        if s.label:
            labels.append(s.label)
        dt = s.chosen_at
        if dt is not None:
            hour = int(dt.strftime('%H'))
            month = int(dt.strftime('%m'))
            dow = int(dt.strftime('%w'))  # 0 Sunday? Python %w 0 Sunday 6 Saturday; but we can map to 0 Mon by using %u; use weekday()
            try:
                dow = dt.weekday()  # 0 Mon..6 Sun
            except Exception:
                pass
            # pleasantness
            by_hour_vals[hour].append(s.x)
            by_month_vals[month].append(s.x)
            by_dow_vals[dow].append(s.x)
            # energy
            by_hour_energy[hour].append(s.y)
            by_month_energy[month].append(s.y)
            by_dow_energy[dow].append(s.y)

    label_counter = Counter(labels)
    most_common_mood = (label_counter.most_common(1)[0][0] if label_counter else None)

    def best_key(d: dict[int, list[int]]) -> Optional[int]:
        best_k = None
        best_avg = None
        for k, vals in d.items():
            if not vals:
                continue
            avg = sum(vals) / len(vals)
            if best_avg is None or avg > best_avg:
                best_avg = avg
                best_k = k
        return best_k

    def worst_key(d: dict[int, list[int]]) -> Optional[int]:
        worst_k = None
        worst_avg = None
        for k, vals in d.items():
            if not vals:
                continue
            avg = sum(vals) / len(vals)
            if worst_avg is None or avg < worst_avg:
                worst_avg = avg
                worst_k = k
        return worst_k

    # Existing pleasantness-based best/worst for backward compatibility
    best_hour = best_key(by_hour_vals)
    worst_hour = worst_key(by_hour_vals)
    best_month = best_key(by_month_vals)
    worst_month = worst_key(by_month_vals)
    best_dow = best_key(by_dow_vals)
    worst_dow = worst_key(by_dow_vals)

    # New energy (y) and pleasantness (x) extremes for month/day/time
    # Note: y=0 is highest energy (top of grid), larger y = lower energy. So
    # highest energy corresponds to MIN average y, lowest energy to MAX average y.
    month_high_energy = worst_key(by_month_energy)  # min y = higher energy
    month_low_energy = best_key(by_month_energy)    # max y = lower energy
    day_high_energy = worst_key(by_dow_energy)
    day_low_energy = best_key(by_dow_energy)
    time_high_energy = worst_key(by_hour_energy)
    time_low_energy = best_key(by_hour_energy)

    month_most_pleasant = best_key(by_month_vals)
    month_least_pleasant = worst_key(by_month_vals)
    day_most_pleasant = best_key(by_dow_vals)
    day_least_pleasant = worst_key(by_dow_vals)
    time_most_pleasant = best_key(by_hour_vals)
    time_least_pleasant = worst_key(by_hour_vals)

    # max for heat normalization
    max_count = max((c for row in heat for c in row), default=0)

    # Compute overall average and its quadrant meaning
    avg_x = (sum_x / n_valid) if n_valid > 0 else None
    avg_y = (sum_y / n_valid) if n_valid > 0 else None
    avg_tx = None
    avg_ty = None
    avg_quadrant = None
    avg_quadrant_label = None
    avg_meaning = None
    if avg_x is not None and avg_y is not None:
        # normalized to [0,1] based on cell centers
        size = 10
        avg_tx = ((avg_x + 0.5) / size)
        avg_ty = ((avg_y + 0.5) / size)
        # Determine quadrant based on midlines between 4 and 5
        left = avg_x < 5
        top = avg_y < 5  # y=0 is top/high energy
        if top and left:
            avg_quadrant = 'red'
            avg_quadrant_label = 'Red (High energy, unpleasant)'
            avg_meaning = 'Tends toward high energy and unpleasant feelings.'
        elif top and not left:
            avg_quadrant = 'yellow'
            avg_quadrant_label = 'Yellow (High energy, pleasant)'
            avg_meaning = 'Tends toward high energy and pleasant feelings.'
        elif (not top) and left:
            avg_quadrant = 'blue'
            avg_quadrant_label = 'Blue (Low energy, unpleasant)'
            avg_meaning = 'Tends toward low energy and unpleasant feelings.'
        else:
            avg_quadrant = 'green'
            avg_quadrant_label = 'Green (Low energy, pleasant)'
            avg_meaning = 'Tends toward low energy and pleasant feelings.'

    return {
        'total': total,
        'most_common_mood': most_common_mood,
        # existing keys
        'best_hour': best_hour,
        'worst_hour': worst_hour,
        'best_month': best_month,
        'worst_month': worst_month,
        'best_dow': best_dow,
        'worst_dow': worst_dow,
        # new keys
        'month_low_energy': month_low_energy,
        'month_high_energy': month_high_energy,
        'month_most_pleasant': month_most_pleasant,
        'month_least_pleasant': month_least_pleasant,
        'day_low_energy': day_low_energy,
        'day_high_energy': day_high_energy,
        'day_most_pleasant': day_most_pleasant,
        'day_least_pleasant': day_least_pleasant,
        'time_low_energy': time_low_energy,
        'time_high_energy': time_high_energy,
        'time_most_pleasant': time_most_pleasant,
        'time_least_pleasant': time_least_pleasant,
        'heatmap': heat,
        'max_count': max_count,
        # average anchor
        'avg_x': avg_x,
        'avg_y': avg_y,
        'avg_tx': avg_tx,
        'avg_ty': avg_ty,
        'avg_count': n_valid,
        'avg_quadrant': avg_quadrant,
        'avg_quadrant_label': avg_quadrant_label,
        'avg_meaning': avg_meaning,
    }


@app.route('/dashboard')
def dashboard():
    if not getattr(current_user, 'is_authenticated', False):
        return redirect(url_for('login_view'))
    grid = get_label_grid()

    df, dt, tf, tt = _parse_dt_filters()

    is_super = getattr(current_user, 'role', 'student') == 'super'

    # Teacher/Super self-report mode: render student-like dashboard for the user's own data
    self_mode = request.args.get('self') in ('1', 'true', 'True')
    if (current_user.role in ('teacher', 'super')) and self_mode:
        q = MoodSubmission.query.filter(MoodSubmission.user_id == current_user.get_id())
        q = _apply_filters(q, df, dt, tf, tt)
        subs = q.all()
        stats = _compute_stats(subs)
        return render_template(
            'student_dashboard.html',
            grid=grid,
            size=(10 if grid else 0),
            stats=stats,
            filters={'date_from': df, 'date_to': dt, 'time_from': tf, 'time_to': tt},
        )

    if current_user.role in ('teacher', 'super'):
        # Teacher/Super view: optional group_id and student filters
        group_id = request.args.get('group_id', type=int)
        student_id = request.args.get('student_id')
        student_email = request.args.get('student_email')
        if (not student_id) and student_email:
            u = User.query.filter_by(email=student_email).first()
            if u:
                student_id = u.id

        submissions_query = MoodSubmission.query
        if group_id:
            # Filter to members of this group
            member_ids = [m.student_id for m in GroupMember.query.filter_by(group_id=group_id).all()]
            if member_ids:
                submissions_query = submissions_query.filter(MoodSubmission.user_id.in_(member_ids))
            else:
                submissions_query = submissions_query.filter(False)
        if student_id:
            submissions_query = submissions_query.filter(MoodSubmission.user_id == student_id)
        submissions_query = _apply_filters(submissions_query, df, dt, tf, tt)
        subs = submissions_query.all()
        stats = _compute_stats(subs)

        # Student detail if provided
        student_stats = None
        student_user = None
        if student_id:
            s_query = MoodSubmission.query.filter(MoodSubmission.user_id == student_id)
            s_query = _apply_filters(s_query, df, dt, tf, tt)
            student_stats = _compute_stats(s_query.all())
            student_user = User.query.get(student_id)

        # Groups for this teacher (or all groups for super)
        if is_super:
            groups = Group.query.order_by(Group.name.asc()).all()
        else:
            groups = Group.query.filter_by(teacher_id=current_user.get_id()).order_by(Group.name.asc()).all()
        # Also, list students alphabetically (by name then email)
        all_students = User.query.filter(User.role == 'student').order_by(User.name.asc(), User.email.asc()).all()
        # For super: list teachers alphabetically (by name then email)
        all_teachers = []
        if is_super:
            all_teachers = User.query.filter(User.role == 'teacher').order_by(User.name.asc(), User.email.asc()).all()

        # Current group and members for manage tab (default to first group if none selected)
        current_group = None
        current_members = []
        current_teacher = None
        selected_gid = group_id or (groups[0].id if groups else None)
        if selected_gid:
            current_group = Group.query.get(selected_gid)
            if current_group and (is_super or current_group.teacher_id == current_user.get_id()):
                # Eager load member users
                gms = GroupMember.query.filter_by(group_id=selected_gid).all()
                for gm in gms:
                    u = gm.student
                    current_members.append({
                        'id': u.id,
                        'name': u.name,
                        'email': u.email,
                    })
                # Current group's teacher
                if current_group.teacher:
                    t = current_group.teacher
                    current_teacher = {'id': t.id, 'name': t.name, 'email': t.email}
            else:
                current_group = None
                current_members = []
                current_teacher = None

        return render_template(
            'teacher_dashboard.html',
            grid=grid,
            size=(10 if grid else 0),
            stats=stats,
            groups=groups,
            current_group_id=group_id,
            current_group=current_group,
            current_members=current_members,
            all_students=all_students,
            all_teachers=all_teachers,
            current_teacher=current_teacher,
            student_stats=student_stats,
            student_user=student_user,
            filters={'date_from': df, 'date_to': dt, 'time_from': tf, 'time_to': tt},
            is_super=is_super,
        )
    else:
        # Student view for current user
        q = MoodSubmission.query.filter(MoodSubmission.user_id == current_user.get_id())
        q = _apply_filters(q, df, dt, tf, tt)
        subs = q.all()
        stats = _compute_stats(subs)
        return render_template(
            'student_dashboard.html',
            grid=grid,
            size=(10 if grid else 0),
            stats=stats,
            filters={'date_from': df, 'date_to': dt, 'time_from': tf, 'time_to': tt},
        )


@app.route('/role', methods=['POST'])
def set_role():
    """Set a user's role.
    - Super admin may set role for any user via user_id or email (student/teacher/super).
    - Teachers may change only their own role (student/teacher).
    - Students cannot change roles.
    """
    if not getattr(current_user, 'is_authenticated', False):
        return jsonify({'ok': False, 'error': 'UNAUTHENTICATED'}), 401

    current_role = getattr(current_user, 'role', 'student')
    requested_role = (request.form.get('role') or '').strip().lower()

    if current_role == 'super':
        if requested_role not in ('student', 'teacher', 'super'):
            return jsonify({'ok': False, 'error': 'INVALID_ROLE'}), 400
        target = None
        tid = request.form.get('user_id') or ''
        temail = (request.form.get('email') or '').strip().lower()
        if tid:
            target = db.session.get(User, tid)
        elif temail:
            target = User.query.filter_by(email=temail).first()
        else:
            target = db.session.get(User, current_user.get_id())
        if not target:
            return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
        target.role = requested_role
        try:
            db.session.commit()
            return jsonify({'ok': True, 'user_id': target.id, 'email': target.email, 'role': target.role})
        except Exception as e:
            db.session.rollback()
            return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500

    elif current_role == 'teacher':
        if requested_role not in ('student', 'teacher'):
            return jsonify({'ok': False, 'error': 'INVALID_ROLE'}), 400
        user = db.session.get(User, current_user.get_id())
        user.role = requested_role
        try:
            db.session.commit()
            return jsonify({'ok': True, 'role': requested_role})
        except Exception as e:
            db.session.rollback()
            return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500
    else:
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403


@app.route('/groups', methods=['GET', 'POST'])
def groups_view():
    if not getattr(current_user, 'is_authenticated', False) or current_user.role not in ('teacher', 'super'):
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        name = (request.form.get('name') or '').strip()
        if not name:
            return redirect(url_for('dashboard'))
        g = Group(name=name, teacher_id=current_user.get_id())
        db.session.add(g)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        anchor = '#manage-students' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard', group_id=g.id) + anchor)
    # GET list
    if current_user.role == 'super':
        groups = Group.query.order_by(Group.name.asc()).all()
    else:
        groups = Group.query.filter_by(teacher_id=current_user.get_id()).all()
    return render_template('teacher_groups.html', groups=groups)


@app.route('/groups/<int:group_id>/members', methods=['POST'])
def add_member(group_id: int):
    if not getattr(current_user, 'is_authenticated', False) or current_user.role not in ('teacher', 'super'):
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    if current_user.role != 'super' and group.teacher_id != current_user.get_id():
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    email = (request.form.get('email') or '').strip().lower()
    if not email:
        return jsonify({'ok': False, 'error': 'EMAIL_REQUIRED'}), 400
    student = User.query.filter_by(email=email).first()
    if not student:
        # auto create a student placeholder
        student = User(email=email, role='student')
        db.session.add(student)
        try:
            db.session.flush()
        except Exception:
            db.session.rollback()
            return jsonify({'ok': False, 'error': 'DB_ERROR'}), 500
    # prevent duplicates
    exists = GroupMember.query.filter_by(group_id=group.id, student_id=student.id).first()
    if not exists:
        gm = GroupMember(group_id=group.id, student_id=student.id)
        db.session.add(gm)
    try:
        db.session.commit()
        # Content-negotiation: if this was an AJAX/fetch request, return JSON; otherwise redirect back to dashboard
        accept = (request.headers.get('Accept') or '')
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        wants_json = 'application/json' in accept or is_ajax or request.is_json
        if wants_json:
            return jsonify({'ok': True})
        anchor = '#manage-students' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard', group_id=group.id) + anchor)
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/teachers', methods=['POST'])
def create_teacher():
    """Super admin can add a new teacher (or upgrade an existing user to teacher).
    Accepts form fields: email (required), name (optional).
    Returns JSON for AJAX or redirects back to dashboard #manage.
    """
    if not getattr(current_user, 'is_authenticated', False) or getattr(current_user, 'role', 'student') != 'super':
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403

    email = (request.form.get('email') or '').strip().lower()
    name = (request.form.get('name') or '').strip()
    if not email:
        return jsonify({'ok': False, 'error': 'EMAIL_REQUIRED'}), 400

    user = User.query.filter_by(email=email).first()
    created = False
    if not user:
        user = User(email=email, name=(name or None), role='teacher', provider=None)
        db.session.add(user)
        created = True
    else:
        # Upgrade role if needed (do not downgrade super)
        if user.role != 'super' and user.role != 'teacher':
            user.role = 'teacher'
        # Fill name if missing
        if name and not user.name:
            user.name = name
    try:
        db.session.commit()
        accept = (request.headers.get('Accept') or '')
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        wants_json = 'application/json' in accept or is_ajax or request.is_json
        payload = {'ok': True, 'user_id': user.id, 'email': user.email, 'role': user.role, 'created': created}
        if wants_json:
            return jsonify(payload)
        # After creating/upgrading a teacher, return to the Manage Teachers tab for super users
        anchor = '#manage-teachers' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard') + anchor)
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/groups/<int:group_id>/set-teacher', methods=['POST'])
def set_group_teacher(group_id: int):
    """Super admin: assign a teacher to a group by email.
    If the email does not exist, create a new user with role=teacher.
    Returns JSON for AJAX, or redirects back to dashboard manage tab.
    """
    if not getattr(current_user, 'is_authenticated', False) or getattr(current_user, 'role', 'student') != 'super':
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404

    email = (request.form.get('email') or '').strip().lower()
    if not email:
        return jsonify({'ok': False, 'error': 'EMAIL_REQUIRED'}), 400

    teacher = User.query.filter_by(email=email).first()
    created = False
    if not teacher:
        teacher = User(email=email, role='teacher')
        db.session.add(teacher)
        try:
            db.session.flush()
            created = True
        except Exception:
            db.session.rollback()
            return jsonify({'ok': False, 'error': 'DB_ERROR'}), 500
    else:
        # Ensure role is teacher unless already super
        if teacher.role != 'super' and teacher.role != 'teacher':
            teacher.role = 'teacher'

    # Assign teacher to the group
    group.teacher_id = teacher.id
    try:
        db.session.commit()
        accept = (request.headers.get('Accept') or '')
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        wants_json = 'application/json' in accept or is_ajax or request.is_json
        payload = {'ok': True, 'group_id': group.id, 'teacher_id': teacher.id, 'email': teacher.email, 'created': created}
        if wants_json:
            return jsonify(payload)
        # After assigning a group teacher, return to Manage Teachers for super, Manage for teacher
        anchor = '#manage-teachers' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard', group_id=group.id) + anchor)
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/groups/<int:group_id>/members/<string:student_id>/remove', methods=['POST'])
def remove_member(group_id: int, student_id: str):
    if not getattr(current_user, 'is_authenticated', False) or current_user.role not in ('teacher', 'super'):
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    if current_user.role != 'super' and group.teacher_id != current_user.get_id():
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    gm = GroupMember.query.filter_by(group_id=group_id, student_id=student_id).first()
    if not gm:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    try:
        db.session.delete(gm)
        db.session.commit()
        # Return JSON for AJAX; otherwise redirect back to manage tab
        accept = (request.headers.get('Accept') or '')
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        wants_json = 'application/json' in accept or is_ajax or request.is_json
        if wants_json:
            return jsonify({'ok': True})
        # After removing a member, return to Manage Students for super, Manage for teacher
        anchor = '#manage-students' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard', group_id=group.id) + anchor)
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/groups/<int:group_id>/delete', methods=['POST'])
def delete_group(group_id: int):
    if not getattr(current_user, 'is_authenticated', False) or current_user.role not in ('teacher', 'super'):
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    group = Group.query.get(group_id)
    if not group:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    if current_user.role != 'super' and group.teacher_id != current_user.get_id():
        return jsonify({'ok': False, 'error': 'FORBIDDEN'}), 403
    try:
        db.session.delete(group)
        db.session.commit()
        # JSON for AJAX; redirect for normal form
        accept = (request.headers.get('Accept') or '')
        is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        wants_json = 'application/json' in accept or is_ajax or request.is_json
        if wants_json:
            return jsonify({'ok': True})
        # After deleting a group, return to Manage Students for super, Manage for teacher
        anchor = '#manage-students' if getattr(current_user, 'role', 'student') == 'super' else '#manage'
        return redirect(url_for('dashboard') + anchor)
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


# --- API: heatmap cell entries ---
@app.route('/api/cell-entries', methods=['GET'])
def api_cell_entries():
    """Return list of mood submissions (dates/times) for a specific heatmap cell.
    Query params:
      - x, y: required cell coordinates (0..9)
      - date_from, date_to (YYYY-MM-DD)
      - time_from, time_to (HH:MM 24h)
      - Optional (teacher): group_id, student_id
    """
    try:
        if not getattr(current_user, 'is_authenticated', False):
            return jsonify({"ok": False, "error": "UNAUTHENTICATED"}), 401
        x = request.args.get('x', type=int)
        y = request.args.get('y', type=int)
        if x is None or y is None or not (0 <= x < 10) or not (0 <= y < 10):
            return jsonify({"ok": False, "error": "BAD_COORDS"}), 400

        # Parse filters
        df, dt, tf, tt = _parse_dt_filters()

        q = MoodSubmission.query.filter(MoodSubmission.x == x, MoodSubmission.y == y)

        # Context: teacher/super vs student
        role = getattr(current_user, 'role', 'student')
        if role in ('teacher', 'super'):
            group_id = request.args.get('group_id', type=int)
            student_id = request.args.get('student_id')
            # If student_id provided, filter to that student
            if student_id:
                q = q.filter(MoodSubmission.user_id == student_id)
            elif group_id:
                # Ensure teacher owns this group (unless super)
                g = db.session.get(Group, group_id)
                if not g:
                    return jsonify({"ok": False, "error": "NOT_FOUND"}), 404
                if role != 'super' and g.teacher_id != current_user.get_id():
                    return jsonify({"ok": False, "error": "FORBIDDEN"}), 403
                member_ids = [m.student_id for m in GroupMember.query.filter_by(group_id=group_id).all()]
                if member_ids:
                    q = q.filter(MoodSubmission.user_id.in_(member_ids))
                else:
                    # No members -> no results
                    q = q.filter(False)
            else:
                # No extra restriction: teacher/super may view all students, consistent with dashboard
                pass
        else:
            # Students can only view their own entries
            q = q.filter(MoodSubmission.user_id == current_user.get_id())

        q = _apply_filters(q, df, dt, tf, tt)
        # Order newest first
        subs = q.order_by(MoodSubmission.chosen_at.desc()).all()

        # Resolve label for this cell from cached CSV grid
        grid = get_label_grid()
        cell_label = grid[y][x] if grid and 0 <= y < len(grid) and 0 <= x < len(grid[0]) else ''

        entries = []
        for s in subs:
            entries.append({
                'id': s.id,
                'x': s.x,
                'y': s.y,
                'label': s.label,
                'chosen_at': (s.chosen_at.isoformat() if s.chosen_at else None),
                'created_at': (s.created_at.isoformat() if s.created_at else None),
                'user_id': s.user_id,
            })

        return jsonify({
            'ok': True,
            'cell': {'x': x, 'y': y, 'label': cell_label, 'count': len(entries)},
            'entries': entries,
        })
    except Exception as e:
        return jsonify({"ok": False, "error": "SERVER_ERROR", "detail": str(e)}), 500


# --- Session APIs ---
@app.route('/api/session/create', methods=['POST'])
def api_session_create():
    try:
        if not getattr(current_user, 'is_authenticated', False):
            return jsonify({'ok': False, 'error': 'UNAUTHENTICATED'}), 401
        # generate a unique 6-digit PIN
        pin = None
        for _ in range(10):
            candidate = f"{random.randint(0, 999999):06d}"
            exists = Session.query.filter_by(pin=candidate, active=True).first()
            if not exists:
                pin = candidate
                break
        if not pin:
            return jsonify({'ok': False, 'error': 'PIN_COLLISION'}), 500
        owner_id = current_user.get_id() if getattr(current_user, 'is_authenticated', False) else None
        s = Session(pin=pin, owner_id=owner_id, active=True, created_at=datetime.now(timezone.utc))
        db.session.add(s)
        db.session.commit()
        return jsonify({'ok': True, 'session_id': s.id, 'pin': pin})
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/api/session/join', methods=['POST'])
def api_session_join():
    if not getattr(current_user, 'is_authenticated', False):
        return jsonify({'ok': False, 'error': 'UNAUTHENTICATED'}), 401
    data = request.get_json(force=True, silent=True) or {}
    pin = (data.get('pin') or '').strip()
    if not pin:
        return jsonify({'ok': False, 'error': 'PIN_REQUIRED'}), 400
    s = Session.query.filter_by(pin=pin, active=True).first()
    if not s:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    return jsonify({'ok': True, 'session_id': s.id})


@app.route('/api/session/<int:session_id>/stats', methods=['GET'])
def api_session_stats(session_id: int):
    s = db.session.get(Session, session_id)
    if not s or not s.active:
        return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
    subs = MoodSubmission.query.filter(MoodSubmission.session_id == session_id).all()
    stats = _compute_stats(subs)
    return jsonify({'ok': True, 'heatmap': stats['heatmap'], 'max_count': stats['max_count'], 'total': stats['total']})


# --- Make67 APIs ---
def _format_display_name(user: 'User') -> str:
    """Return first name + last initial when possible; fall back to email username."""
    try:
        name = (user.name or '').strip()
        if name:
            parts = [p for p in name.split() if p]
            if len(parts) == 1:
                return parts[0]
            first = parts[0]
            last_initial = parts[-1][0] + '.' if parts[-1] else ''
            return f"{first} {last_initial}".strip()
        email = (user.email or '').strip()
        if email:
            username = email.split('@')[0]
            return username
    except Exception:
        pass
    return 'Anonymous'


def _compute_rank(total: int) -> dict:
    """Return rank metadata based on all-time solves.
    Keys: key (css key), title (label), icon (unicode/emoji)
    """
    t = int(total or 0)
    # Ordered from highest to lowest threshold
    if t >= 800:
        return {"key": "overlord", "title": "OVERLORD", "icon": "🦅"}
    if t >= 700:
        return {"key": "captain", "title": "Captain", "icon": "🎖️"}
    if t >= 600:
        return {"key": "godlike", "title": "Godlike", "icon": "👑"}
    if t >= 500:
        return {"key": "legend", "title": "Legend", "icon": "⚔️"}
    if t >= 400:
        return {"key": "genius", "title": "Genius", "icon": "🏵️"}
    if t >= 300:
        return {"key": "soldier", "title": "Soldier", "icon": "🛡️"}
    if t >= 200:
        return {"key": "nerd", "title": "Nerd", "icon": "🧠"}
    if t >= 100:
        return {"key": "beast", "title": "Beast", "icon": "🏅"}
    return {"key": "noob", "title": "Noob", "icon": "⚪"}


@app.route('/api/make67/solve', methods=['POST'])
def api_make67_solve():
    if not getattr(current_user, 'is_authenticated', False):
        return jsonify({'ok': False, 'error': 'UNAUTHENTICATED'}), 401
    try:
        u = db.session.get(User, current_user.get_id())
        if not u:
            return jsonify({'ok': False, 'error': 'NOT_FOUND'}), 404
        data = request.get_json(silent=True) or {}
        hint_used = bool(data.get('hint_used'))
        if hint_used:
            # Do not count solves where a hint was used
            return jsonify({'ok': True, 'all_time_total': int(u.make67_all_time_solves or 0), 'skipped': True})
        cur = u.make67_all_time_solves or 0
        u.make67_all_time_solves = cur + 1
        db.session.commit()
        return jsonify({'ok': True, 'all_time_total': int(u.make67_all_time_solves or 0)})
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'error': 'DB_ERROR', 'detail': str(e)}), 500


@app.route('/api/make67/leaderboard', methods=['GET'])
def api_make67_leaderboard():
    try:
        top_users = (
            User.query
            .filter((User.make67_all_time_solves != None) & (User.make67_all_time_solves > 0))
            .order_by(User.make67_all_time_solves.desc(), User.created_at.asc())
            .limit(10)
            .all()
        )
        top = []
        for u in top_users:
            total = int(u.make67_all_time_solves or 0)
            rk = _compute_rank(total)
            top.append({
                'name': _format_display_name(u),
                'total': total,
                'rank_key': rk['key'],
                'rank_title': rk['title'],
                'rank_icon': rk['icon'],
            })
        me = None
        if getattr(current_user, 'is_authenticated', False):
            u = db.session.get(User, current_user.get_id())
            if u:
                total = int(u.make67_all_time_solves or 0)
                rk = _compute_rank(total)
                me = {
                    'name': _format_display_name(u),
                    'total': total,
                    'rank_key': rk['key'],
                    'rank_title': rk['title'],
                    'rank_icon': rk['icon'],
                }
        return jsonify({'ok': True, 'top': top, 'me': me})
    except Exception as e:
        return jsonify({'ok': False, 'error': 'SERVER_ERROR', 'detail': str(e)}), 500


if __name__ == '__main__':
    # Debug for local development; in deployment use a WSGI server
    app.run(host='0.0.0.0', port=5000, debug=True)


