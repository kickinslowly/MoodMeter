MoodMeter

Setup for data tracking with SQLite locally and PostgreSQL in production (Render). Includes SQLAlchemy models, Flask-Migrate migrations, and Flask-Login scaffolding for future Google login.

Requirements
- Python 3.10+
- pip

Install
1. Create and activate a virtual environment.
2. Install dependencies:
   pip install -r requirements.txt

Database
- Local default uses SQLite database file moodmeter.db in the project directory.
- In production, set DATABASE_URL to your Postgres URL (Render provides this). Legacy postgres:// URLs are normalized.

Migrations
- Initialize DB and apply migrations:
  set FLASK_APP=app.py
  flask db upgrade

- To create a new migration after model changes:
  flask db migrate -m "your message"
  flask db upgrade

Models
- users: stores accounts (Google OAuth). New: role column ('student' or 'teacher').
- groups: teacher-created classes/groups.
- group_members: membership linking students to groups.
- mood_submissions: each mood grid selection with (x, y, label), chosen_at (UTC), optional user_id, ip, created_at

Dashboards
- /dashboard: shows student dashboard for students and teacher dashboard for teachers.
  - Filters by date range and time of day (UTC).
  - Student: most common mood, best hour, best month, heatmap overlay.
  - Teacher: pick group; shows most common mood, best/worst hour, best/worst month, best/worst day of week, heatmap. Optional individual student view section.

Auth
- Flask-Login + Google OAuth. New temporary endpoint POST /role to set current user's role for testing.

Running locally
- Start the app:
  python app.py

Database & Migrations
- Local default uses SQLite (moodmeter.db). To apply migrations:
  set FLASK_APP=app.py
  flask db upgrade
- After model changes, create a new migration then upgrade:
  flask db migrate -m "message"
  flask db upgrade

Render deployment notes
- Set environment variables:
  - DATABASE_URL (Render-provided Postgres URI)
  - SECRET_KEY (a random secret for Flask sessions)
  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
- Run migrations in a Render deploy hook or shell:
  set FLASK_APP=app.py && flask db upgrade
