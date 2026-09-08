"""
dht11_logger.py

Recoit les trames envoyees par le CC1310 sur le port serie (UART/XDS110),
les affiche en temps reel dans la console, les enregistre dans un fichier
CSV (comme avant), ET les envoie au dashboard web via son API HTTP pour
affichage en temps reel.

Prerequis :
    pip install pyserial requests

Utilisation :
    1. Modifiez SERIAL_PORT ci-dessous avec le port de votre carte.
    2. Verifiez que le serveur du dashboard tourne (npm start dans backend/).
    3. Lancez : python dht11_logger.py
    4. Les donnees s'affichent a l'ecran, s'ajoutent au CSV, et apparaissent
       sur le dashboard (actualisation automatique toutes les 2s).
"""

import serial
import sys
import time
import csv
import os
from datetime import datetime

import requests

# ============ CONFIGURATION - A ADAPTER ============
SERIAL_PORT = "COM8"        # <-- changez selon votre port
BAUD_RATE = 115200
OUTPUT_FILE = "dht11_log.csv"

# Adresse du dashboard et cle API (doit correspondre a INGEST_API_KEY
# cote serveur, voir backend/routes/ingestRoutes.js). Pour changer la cle
# en production, definissez la variable d'environnement INGEST_API_KEY
# des deux cotes (serveur ET ce script).
DASHBOARD_URL = "http://localhost:3000/api/ingest"
API_KEY = "cc1310-dev-key"
HTTP_TIMEOUT_S = 2  # ne bloque jamais longtemps si le serveur est injoignable
# =====================================================


def open_serial(port, baud):
    try:
        ser = serial.Serial(port, baud, timeout=5)
        time.sleep(1.5)
        ser.reset_input_buffer()
        return ser
    except serial.SerialException as e:
        print(f"Erreur : impossible d'ouvrir le port {port} ({e})")
        print("Verifiez le nom du port et qu'aucun autre programme "
              "(CCS, moniteur serie) ne l'utilise deja.")
        sys.exit(1)


def ensure_csv_header(path):
    if not os.path.isfile(path):
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "temperature_C", "humidity_percent", "source"])


def send_to_dashboard(temperature, humidity, source):
    """
    Envoie la mesure au dashboard. Ne fait jamais planter le script si le
    serveur est injoignable : on log l'erreur et on continue la lecture
    du port serie (le CSV, lui, garde toujours toutes les mesures).
    """
    try:
        response = requests.post(
            DASHBOARD_URL,
            json={"temperature": temperature, "humidity": humidity, "source": source},
            headers={"X-API-Key": API_KEY},
            timeout=HTTP_TIMEOUT_S,
        )
        if response.status_code != 201:
            print(f"[!] Dashboard a refusé la mesure ({response.status_code}): {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"[!] Dashboard injoignable ({e}). La mesure reste dans le CSV.")


def main():
    print(f"Ouverture du port {SERIAL_PORT} a {BAUD_RATE} bauds...")
    ser = open_serial(SERIAL_PORT, BAUD_RATE)
    print("Port ouvert. En attente des donnees du CC1310 (Ctrl+C pour arreter)...\n")

    ensure_csv_header(OUTPUT_FILE)

    try:
        with open(OUTPUT_FILE, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)

            while True:
                raw = ser.readline()
                if not raw:
                    continue

                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                parts = line.split(",")

                if parts[0] == "DATA" and len(parts) == 3:
                    temp_str = parts[1]
                    hum_str = parts[2]
                    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    print(f"[{ts}] (MOI)  Temperature = {temp_str} C   Humidite = {hum_str} %")

                    writer.writerow([ts, temp_str, hum_str, "local"])
                    f.flush()
                    os.fsync(f.fileno())

                    # Conversion en nombres avant envoi au dashboard (l'API
                    # attend des types numeriques, pas des chaines).
                    try:
                        temp_value = float(temp_str)
                        hum_value = float(hum_str)
                        send_to_dashboard(temp_value, hum_value, "local")
                    except ValueError:
                        print(f"[!] Valeurs non numeriques reçues, non envoyées au dashboard : {line}")

                elif parts[0] == "RDATA" and len(parts) == 3:
                    temp_str = parts[1]
                    hum_str = parts[2]
                    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                    print(f"[{ts}] (ELLE) Temperature = {temp_str} C   Humidite = {hum_str} %  [RF]")

                    writer.writerow([ts, temp_str, hum_str, "remote"])
                    f.flush()
                    os.fsync(f.fileno())

                    try:
                        temp_value = float(temp_str)
                        hum_value = float(hum_str)
                        send_to_dashboard(temp_value, hum_value, "remote")
                    except ValueError:
                        print(f"[!] Valeurs non numeriques reçues, non envoyées au dashboard : {line}")

                elif parts[0] == "ERR" or parts[0] == "RERR":
                    message = ",".join(parts[1:])
                    print(f"[!] Erreur capteur : {message}")

                else:
                    print(f"[?] Trame non reconnue : {line}")

    except KeyboardInterrupt:
        print("\nArret demande par l'utilisateur.")
    finally:
        ser.close()
        print(f"Port serie ferme. Donnees enregistrees dans : {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
