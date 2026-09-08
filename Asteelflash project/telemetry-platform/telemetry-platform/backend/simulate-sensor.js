/**
 * simulate-sensor.js
 * ------------------
 * Simule l'arrivee de mesures temperature + humidite (remplace la carte
 * CC1310 en attendant son branchement reel). Ecrit directement via le
 * modele sensorModel, au meme format que ce qu'une passerelle UART/RF
 * ecrirait plus tard.
 *
 * Usage : npm run simulate
 */

const sensorModel = require('./models/sensorModel');

const INTERVAL_MS = 3000;
let temperature = 24.0;
let humidity = 50.0;

function drift(value, min, max, amplitude, spikeChance) {
  const roll = Math.random();
  if (roll > 1 - spikeChance) {
    value += amplitude * 3;
  } else if (roll < spikeChance) {
    value -= amplitude * 3;
  } else {
    value += (Math.random() - 0.5) * amplitude;
  }
  return Math.max(min, Math.min(max, value));
}

console.log(`Simulateur capteur démarré (intervalle ${INTERVAL_MS / 1000}s). Ctrl+C pour arrêter.`);

setInterval(() => {
  temperature = Math.round(drift(temperature, -10, 50, 1.5, 0.06) * 10) / 10;
  humidity = Math.round(drift(humidity, 0, 100, 3, 0.06) * 10) / 10;

  sensorModel.appendReading({ temperature, humidity });
  console.log(
    `[${new Date().toLocaleTimeString()}] T=${temperature}°C  H=${humidity}%`
  );
}, INTERVAL_MS);
