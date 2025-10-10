from flask import Flask, render_template, request, jsonify
import csv
from pathlib import Path

app = Flask(__name__)

# Simple in-memory log for future DB integration
click_log = []


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


@app.route('/')
def index():
    csv_path = Path(__file__).parent / 'Mood_Meter_DataFrame.csv'
    grid = load_grid_from_csv(csv_path)
    size = 10 if grid else 0
    return render_template('index.html', grid=grid, size=size)


@app.route('/click', methods=['POST'])
def record_click():
    data = request.get_json(force=True, silent=True) or {}
    # Expected payload: {x: int, y: int, label: str, ts: int}
    x = data.get('x')
    y = data.get('y')
    label = data.get('label')
    ts = data.get('ts')
    if not isinstance(x, int) or not isinstance(y, int):
        return jsonify({"ok": False, "error": "Invalid coordinates"}), 400
    entry = {"x": x, "y": y, "label": label, "ts": ts, "ip": request.remote_addr}
    click_log.append(entry)
    # For now we just acknowledge; later we'll persist to DB
    return jsonify({"ok": True})


if __name__ == '__main__':
    # Debug for local development; in deployment use a WSGI server
    app.run(host='0.0.0.0', port=5000, debug=True)
