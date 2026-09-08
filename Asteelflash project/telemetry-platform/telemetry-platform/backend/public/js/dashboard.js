/**
 * dashboard.js
 * ------------
 * Polling de l'API JSON /api/sensor/history, mise a jour des jauges,
 * des bandeaux d'etat (local + remote) et du graphique combine.
 */

(function () {
  'use strict';

  const CONFIG = {
    API_URL: '/api/sensor/history?limit=50',
    POLL_INTERVAL_MS: 2000,
    GAUGE_TEMP_MIN: -10,
    GAUGE_TEMP_MAX: 50,
    GAUGE_HUM_MIN: 0,
    GAUGE_HUM_MAX: 100,
  };

  let thresholds = window.__THRESHOLDS__ || { tempMin: 15, tempMax: 30, humMin: 30, humMax: 70 };

  const el = {
    currentTemp: document.getElementById('currentTemp'),
    currentHum: document.getElementById('currentHum'),
    tempGaugeFill: document.getElementById('tempGaugeFill'),
    humGaugeFill: document.getElementById('humGaugeFill'),
    currentTempRemote: document.getElementById('currentTempRemote'),
    currentHumRemote: document.getElementById('currentHumRemote'),
    tempGaugeFillRemote: document.getElementById('tempGaugeFillRemote'),
    humGaugeFillRemote: document.getElementById('humGaugeFillRemote'),
    deltaTemp: document.getElementById('deltaTemp'),
    deltaHum: document.getElementById('deltaHum'),

    // AJOUT : deux bandeaux separes (local / remote) au lieu d'un seul
    statusBannerLocal: document.getElementById('statusBannerLocal'),
    statusIconLocal: document.getElementById('statusIconLocal'),
    statusTextLocal: document.getElementById('statusTextLocal'),
    lastUpdateLocal: document.getElementById('lastUpdateLocal'),

    statusBannerRemote: document.getElementById('statusBannerRemote'),
    statusIconRemote: document.getElementById('statusIconRemote'),
    statusTextRemote: document.getElementById('statusTextRemote'),
    lastUpdateRemote: document.getElementById('lastUpdateRemote'),

    chartCanvas: document.getElementById('tempChart'),
  };

  /* ================================================================
     Jauges
     ================================================================ */

  function setGauge(fillEl, value, min, max) {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    fillEl.style.width = `${pct}%`;
  }

  /* ================================================================
     Affichage (jauges uniquement, le bandeau est gere a part)
     ================================================================ */

  function updateDisplays(latest) {
    el.currentTemp.textContent = latest.temperature.toFixed(1);
    el.currentHum.textContent = latest.humidity.toFixed(1);

    setGauge(el.tempGaugeFill, latest.temperature, CONFIG.GAUGE_TEMP_MIN, CONFIG.GAUGE_TEMP_MAX);
    setGauge(el.humGaugeFill, latest.humidity, CONFIG.GAUGE_HUM_MIN, CONFIG.GAUGE_HUM_MAX);

    el.currentTemp.classList.remove('is-high', 'is-low');
    if (latest.temperature > thresholds.tempMax) el.currentTemp.classList.add('is-high');
    else if (latest.temperature < thresholds.tempMin) el.currentTemp.classList.add('is-low');
  }

  function updateRemoteDisplay(latestRemote) {
    if (!el.currentTempRemote) return;

    if (!latestRemote) {
      el.currentTempRemote.textContent = '--';
      el.currentHumRemote.textContent = '--';
      el.tempGaugeFillRemote.style.width = '0%';
      el.humGaugeFillRemote.style.width = '0%';
      return;
    }

    el.currentTempRemote.textContent = latestRemote.temperature.toFixed(1);
    el.currentHumRemote.textContent = latestRemote.humidity.toFixed(1);
    setGauge(el.tempGaugeFillRemote, latestRemote.temperature, CONFIG.GAUGE_TEMP_MIN, CONFIG.GAUGE_TEMP_MAX);
    setGauge(el.humGaugeFillRemote, latestRemote.humidity, CONFIG.GAUGE_HUM_MIN, CONFIG.GAUGE_HUM_MAX);
  }

  function updateDelta(delta) {
    if (!el.deltaTemp) return;
    if (!delta) {
      el.deltaTemp.textContent = '--';
      el.deltaHum.textContent = '--';
      return;
    }
    const dt = delta.temperature;
    const dh = delta.humidity;
    el.deltaTemp.textContent = `${dt > 0 ? '+' : ''}${dt.toFixed(1)} °C`;
    el.deltaHum.textContent = `${dh > 0 ? '+' : ''}${dh.toFixed(1)} %`;
  }

  /* ================================================================
     Bandeau d'etat — un par capteur (local / remote)
     ================================================================ */

  // prefix: 'Local' ou 'Remote'
  function setStatusBanner(prefix, status, latest) {
    const banner = el['statusBanner' + prefix];
    const icon = el['statusIcon' + prefix];
    const text = el['statusText' + prefix];
    const lastUpdate = el['lastUpdate' + prefix];
    if (!banner) return; // section absente de cette vue

    banner.classList.remove(
      'status-banner--normal', 'status-banner--high', 'status-banner--low', 'status-banner--offline'
    );

    if (status === 'no-data' || !latest) {
      banner.classList.add('status-banner--offline');
      icon.textContent = '⏳';
      text.textContent = 'Absence de données — vérifiez la connexion du capteur';
      if (lastUpdate) lastUpdate.textContent = 'Dernière mise à jour : —';
      return;
    }

    if (lastUpdate) {
      lastUpdate.textContent = `Dernière mise à jour : ${new Date(latest.timestamp).toLocaleTimeString()}`;
    }

    const tempHigh = latest.temperature > thresholds.tempMax;
    const tempLow = latest.temperature < thresholds.tempMin;
    const humHigh = latest.humidity > thresholds.humMax;
    const humLow = latest.humidity < thresholds.humMin;

    if (tempHigh || humHigh) {
      banner.classList.add('status-banner--high');
      icon.textContent = '🔴';
      text.textContent = tempHigh
        ? `Température trop élevée (${latest.temperature.toFixed(1)} °C)`
        : `Humidité trop élevée (${latest.humidity.toFixed(1)} %)`;
    } else if (tempLow || humLow) {
      banner.classList.add('status-banner--low');
      icon.textContent = '🔵';
      text.textContent = tempLow
        ? `Température trop basse (${latest.temperature.toFixed(1)} °C)`
        : `Humidité trop basse (${latest.humidity.toFixed(1)} %)`;
    } else {
      banner.classList.add('status-banner--normal');
      icon.textContent = '✅';
      text.textContent = 'Température et humidité normales';
    }
  }

  /* ================================================================
     Graphique canvas natif (temperature + humidite)
     ================================================================ */

  const Chart = {
    data: [],
    dataRemote: [],
    ctx: null,

    init() {
      if (!el.chartCanvas) return;
      this.ctx = el.chartCanvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      if (!this.ctx) return;
      const canvas = el.chartCanvas;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.draw();
    },

    setData(readings, readingsRemote) {
      this.data = readings;
      this.dataRemote = readingsRemote || [];
      this.draw();
    },

    draw() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const canvas = el.chartCanvas;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const padding = { top: 16, right: 50, bottom: 24, left: 44 };

      ctx.clearRect(0, 0, width, height);

      if (this.data.length === 0) {
        ctx.fillStyle = '#7fa0a8';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText('En attente de données…', padding.left, height / 2);
        return;
      }

      const temps = this.data.map((d) => d.temperature);

      const tMin = Math.min(...temps, thresholds.tempMin) - 2;
      const tMax = Math.max(...temps, thresholds.tempMax) + 2;
      const hMin = 0;
      const hMax = 100;

      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;

      const xFor = (i) => padding.left + (this.data.length === 1 ? 0 : (i / (this.data.length - 1)) * plotWidth);
      const yForTemp = (v) => padding.top + plotHeight - ((v - tMin) / (tMax - tMin)) * plotHeight;
      const yForHum = (v) => padding.top + plotHeight - ((v - hMin) / (hMax - hMin)) * plotHeight;

      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (plotHeight * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#ff6b5f';
      ctx.beginPath();
      ctx.moveTo(padding.left, yForTemp(thresholds.tempMax));
      ctx.lineTo(width - padding.right, yForTemp(thresholds.tempMax));
      ctx.stroke();

      ctx.strokeStyle = '#4ea8ff';
      ctx.beginPath();
      ctx.moveTo(padding.left, yForTemp(thresholds.tempMin));
      ctx.lineTo(width - padding.right, yForTemp(thresholds.tempMin));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.data.forEach((d, i) => {
        const x = xFor(i), y = yForTemp(d.temperature);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#4ea8ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      this.data.forEach((d, i) => {
        const x = xFor(i), y = yForHum(d.humidity);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      if (this.dataRemote.length > 0) {
        const xForRemote = (i) =>
          padding.left + (this.dataRemote.length === 1 ? 0 : (i / (this.dataRemote.length - 1)) * plotWidth);

        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        this.dataRemote.forEach((d, i) => {
          const x = xForRemote(i), y = yForTemp(d.temperature);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        this.dataRemote.forEach((d, i) => {
          const x = xForRemote(i), y = yForHum(d.humidity);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#2dd4bf';
      ctx.fillText('● Température local (°C)', width - padding.right - 4, 14);
      ctx.fillStyle = '#4ea8ff';
      ctx.fillText('╌ Humidité local (%)', width - padding.right - 4, 28);
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('● Remote (RF)', width - padding.right - 4, 42);
    },
  };

  /* ================================================================
     Polling
     ================================================================ */

  async function poll() {
    try {
      const response = await fetch(CONFIG.API_URL, { cache: 'no-store' });
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = await response.json();
      thresholds = payload.thresholds || thresholds;

      Chart.setData(payload.readingsLocal || payload.readings || [], payload.readingsRemote || []);

      const latestLocal =
        payload.readingsLocal && payload.readingsLocal.length > 0
          ? payload.readingsLocal[payload.readingsLocal.length - 1]
          : null;
      const latestRemote =
        payload.readingsRemote && payload.readingsRemote.length > 0
          ? payload.readingsRemote[payload.readingsRemote.length - 1]
          : null;

      updateRemoteDisplay(latestRemote);
      updateDelta(payload.delta);

      // AJOUT : deux bandeaux distincts, alimentes par statusLocal/statusRemote
      setStatusBanner('Local', payload.statusLocal, latestLocal);
      setStatusBanner('Remote', payload.statusRemote, latestRemote);

      if (latestLocal) {
        updateDisplays(latestLocal);
      } else {
        el.currentTemp.textContent = '--';
        el.currentHum.textContent = '--';
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des données capteur :', err);
      setStatusBanner('Local', 'no-data', null);
      setStatusBanner('Remote', 'no-data', null);
    }
  }

/* ================================================================
     Agrandissement du graphique au clic
     ================================================================ */

  function setupChartExpand() {
    if (!el.chartCanvas) return;
    const card = el.chartCanvas.closest('.card--chart');
    if (!card) return;

    card.style.cursor = 'zoom-in';
    card.title = 'Cliquer pour agrandir / réduire';

    card.addEventListener('click', () => {
      const expanded = card.classList.toggle('is-chart-expanded');

      if (expanded) {
        card.dataset.prevStyle = card.getAttribute('style') || '';
        Object.assign(card.style, {
          position: 'fixed',
          top: '5vh',
          left: '5vw',
          width: '90vw',
          height: '90vh',
          zIndex: '1000',
          cursor: 'zoom-out',
          overflow: 'auto',
        });
        el.chartCanvas.style.height = 'calc(100% - 60px)';
      } else {
        card.setAttribute('style', card.dataset.prevStyle || '');
        el.chartCanvas.style.height = '';
        card.style.cursor = 'zoom-in';
      }

      Chart.resize();
    });
  }

  function init() {
    Chart.init();
    setupChartExpand();   // AJOUT
    poll();
    setInterval(poll, CONFIG.POLL_INTERVAL_MS);
  }

  document.addEventListener('DOMContentLoaded', init);
})();