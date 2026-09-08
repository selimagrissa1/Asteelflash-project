"""
dht11_logger.py  (version "comparaison RF")

Recoit du CC1310, sur le port serie, DEUX types de trames :

    DATA,<temp>,<hum>    -> mesure de TON propre capteur DHT11
    RDATA,<temp>,<hum>   -> mesure de ton amie, recue par RF sur ta carte
                            et relayee par elle sur l'UART

Les deux sont enregistrees dans le MEME fichier CSV, avec une colonne
"source" ("local" ou "remote") qui permet ensuite au dashboard de les
distinguer et de les comparer.

Prerequis :
    pip install pyserial

Utilisation : identique a avant, juste changer SERIAL_PORT si besoin.
"""

import serial
import sys
import time
import csv
import os
from datetime import datetime

# ============ CONFIGURATION - A ADAPTER ============
SERIAL_PORT = "COM8"        # <-- changez selon votre port
BAUD_RATE = 115200
OUTPUT_FILE = "dht11_log.csv"
# =====================================================

CSV_HEADER = ["timestamp", "temperature_C", "humidity_percent", "source"]


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
    """
    Cree le fichier avec le nouvel en-tete (4 colonnes) s'il n'existe pas.
    Si un ANCIEN fichier (3 colonnes, sans 'source') existe deja, on le
    laisse de cote : renommez-le ou supprimez-le avant de relancer, sinon
    le dashboard mixera ancien et nouveau format.
    """
    file_exists = os.path.isfile(path)
    if not file_exists:
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(CSV_HEADER)
    else:
        with open(path, "r", encoding="utf-8") as f:
            first_line = f.readline().strip()
        if first_line.split(",") != CSV_HEADER:
            print(f"[!] ATTENTION : {path} existe deja avec un ancien format "
                  f"(pas de colonne 'source').")
            print("    Renommez/supprimez-le puis relancez pour repartir "
                  "sur un fichier propre.")
            sys.exit(1)


def main():
    print(f"Ouverture du port {SERIAL_PORT} a {BAUD_RATE} bauds...")
    ser = open_serial(SERIAL_PORT, BAUD_RATE)
    print("Port ouvert. En attente des donnees (locales et RF) "
          "(Ctrl+C pour arreter)...\n")

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
                ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                if parts[0] == "DATA" and len(parts) == 3:
                    temp, hum = parts[1], parts[2]
                    print(f"[{ts}] (MOI)  Temperature = {temp} C   Humidite = {hum} %")
                    writer.writerow([ts, temp, hum, "local"])
                    f.flush()
                    os.fsync(f.fileno())

                elif parts[0] == "RDATA" and len(parts) == 3:
                    temp, hum = parts[1], parts[2]
                    print(f"[{ts}] (ELLE) Temperature = {temp} C   Humidite = {hum} %  [RF]")
                    writer.writerow([ts, temp, hum, "remote"])
                    f.flush()
                    os.fsync(f.fileno())

                elif parts[0] == "ERR":
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
