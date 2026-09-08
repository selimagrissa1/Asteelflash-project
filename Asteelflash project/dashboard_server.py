"""
dashboard_server.py  (version "comparaison RF")

Dashboard web temps reel pour comparer TA mesure DHT11 (recue en local sur
ton CC1310) et celle de ton amie (recue par RF, relayee par ton CC1310,
et enregistree dans le meme dht11_log.csv gr ce a dht11_logger.py).

Prerequis :
    pip install flask

Utilisation : identique a avant.
    1. dht11_logger.py tourne dans un terminal
    2. python dashboard_server.py dans un autre
    3. http://localhost:5000
"""

import csv
import json
import os
import threading

from flask import Flask, jsonify, request, Response

CSV_PATH = "dht11_log.csv"
CONFIG_PATH = "dashboard_config.json"
MAX_POINTS = 300  # nombre de points conserves PAR SOURCE pour l'historique

DEFAULT_CONFIG = {
    "temp_min": 15.0,
    "temp_max": 30.0,
    "hum_min": 30.0,
    "hum_max": 70.0,
}

app = Flask(__name__)
config_lock = threading.Lock()


def load_config():
    if os.path.isfile(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                merged = dict(DEFAULT_CONFIG)
                merged.update(cfg)
                return merged
        except (json.JSONDecodeError, OSError):
            pass
    return dict(DEFAULT_CONFIG)


def save_config(cfg):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)


def read_csv_rows():
    """
    Lit le CSV et separe les lignes par source.
    Compatible avec un CSV sans colonne 'source' (tout est alors
    considere comme 'local'), au cas ou.
    """
    if not os.path.isfile(CSV_PATH):
        return [], []

    local_rows, remote_rows = [], []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                entry = {
                    "timestamp": row["timestamp"],
                    "temperature": float(row["temperature_C"]),
                    "humidity": float(row["humidity_percent"]),
                }
            except (KeyError, ValueError):
                continue
            source = row.get("source", "local")
            if source == "remote":
                remote_rows.append(entry)
            else:
                local_rows.append(entry)

    return local_rows[-MAX_POINTS:], remote_rows[-MAX_POINTS:]


def status_for(latest, cfg):
    if latest is None:
        return "nodata"
    temp_ok = cfg["temp_min"] <= latest["temperature"] <= cfg["temp_max"]
    hum_ok = cfg["hum_min"] <= latest["humidity"] <= cfg["hum_max"]
    return "ok" if (temp_ok and hum_ok) else "alert"


@app.route("/api/data")
def api_data():
    local_rows, remote_rows = read_csv_rows()
    cfg = load_config()

    latest_local = local_rows[-1] if local_rows else None
    latest_remote = remote_rows[-1] if remote_rows else None

    status_local = status_for(latest_local, cfg)
    status_remote = status_for(latest_remote, cfg)

    if status_local == "nodata" and status_remote == "nodata":
        overall_status = "nodata"
    elif status_local == "alert" or status_remote == "alert":
        overall_status = "alert"
    else:
        overall_status = "ok"

    delta = None
    if latest_local and latest_remote:
        delta = {
            "temperature": round(latest_local["temperature"] - latest_remote["temperature"], 2),
            "humidity": round(latest_local["humidity"] - latest_remote["humidity"], 2),
        }

    return jsonify({
        "rows_local": local_rows,
        "rows_remote": remote_rows,
        "latest_local": latest_local,
        "latest_remote": latest_remote,
        "delta": delta,
        "config": cfg,
        "status": overall_status,
        "status_local": status_local,
        "status_remote": status_remote,
    })


@app.route("/api/config", methods=["GET", "POST"])
def api_config():
    if request.method == "POST":
        with config_lock:
            cfg = load_config()
            data = request.get_json(force=True, silent=True) or {}
            for key in DEFAULT_CONFIG:
                if key in data:
                    try:
                        cfg[key] = float(data[key])
                    except (TypeError, ValueError):
                        pass
            save_config(cfg)
        return jsonify(cfg)
    return jsonify(load_config())


@app.route("/")
def index():
    with open(os.path.join(os.path.dirname(__file__), "dashboard.html"),
               "r", encoding="utf-8") as f:
        return Response(f.read(), mimetype="text/html")


if __name__ == "__main__":
    print("Dashboard disponible sur http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
