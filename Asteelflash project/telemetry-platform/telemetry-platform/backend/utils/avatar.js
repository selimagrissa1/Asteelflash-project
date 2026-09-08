/**
 * avatar.js
 * ---------
 * Genere les initiales et une couleur stable (basee sur un hash simple
 * du nom d'utilisateur) pour l'avatar affiche dans la barre de
 * navigation et la page de profil.
 */

const PALETTE = ['#2dd4bf', '#4ea8ff', '#ff6b5f', '#f5a623', '#9b8cff', '#3ddc97'];

function getInitials(username) {
  if (!username) return '?';
  const parts = username.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getColor(username) {
  let hash = 0;
  for (let i = 0; i < (username || '').length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

module.exports = { getInitials, getColor };
