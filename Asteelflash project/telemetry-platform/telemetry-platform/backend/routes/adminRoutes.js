const express = require('express');

const { requireRole } = require('../middleware/auth');
const userModel = require('../models/userModel');
const logModel = require('../models/logModel');

const router = express.Router();
const PAGE_SIZE = 8;

/* ------------------------------------------------------------------ */
/* Liste des utilisateurs : recherche + filtre par role + pagination   */
/* ------------------------------------------------------------------ */

router.get('/admin/users', requireRole('admin'), (req, res) => {
  const search = (req.query.search || '').trim().toLowerCase();
  const roleFilter = req.query.role || '';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  let users = userModel.findAll();

  if (search) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
    );
  }

  if (roleFilter === 'admin' || roleFilter === 'user') {
    users = users.filter((u) => u.role === roleFilter);
  }

  users = users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const totalUsers = users.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  res.render('admin-users', {
    pageTitle: 'Gestion des utilisateurs',
    users: paginated.map(userModel.toSafeObject),
    totalUsers,
    currentPage,
    totalPages,
    search: req.query.search || '',
    roleFilter,
  });
});

/* ------------------------------------------------------------------ */
/* Modification du role                                                */
/* ------------------------------------------------------------------ */

router.post('/admin/users/:id/role', requireRole('admin'), (req, res) => {
  const { role } = req.body;
  const targetId = req.params.id;

  if (role !== 'admin' && role !== 'user') {
    req.flash('error', 'Rôle invalide.');
    return res.redirect('/admin/users');
  }

  const target = userModel.findById(targetId);
  if (!target) {
    req.flash('error', 'Utilisateur introuvable.');
    return res.redirect('/admin/users');
  }

  userModel.updateRole(targetId, role);
  logModel.logAction(
    req.session.user.username,
    'user_role_changed',
    `${target.username} → ${role}`
  );

  req.flash('success', `Rôle de ${target.username} mis à jour.`);
  res.redirect('/admin/users');
});

/* ------------------------------------------------------------------ */
/* Suppression d'un compte (impossible sur son propre compte)          */
/* ------------------------------------------------------------------ */

router.post('/admin/users/:id/delete', requireRole('admin'), (req, res) => {
  const targetId = req.params.id;

  if (targetId === req.session.user.id) {
    req.flash('error', 'Vous ne pouvez pas supprimer votre propre compte.');
    return res.redirect('/admin/users');
  }

  const target = userModel.findById(targetId);
  if (!target) {
    req.flash('error', 'Utilisateur introuvable.');
    return res.redirect('/admin/users');
  }

  userModel.remove(targetId);
  logModel.logAction(req.session.user.username, 'user_deleted', `${target.username} (${target.email})`);

  req.flash('success', `Compte de ${target.username} supprimé.`);
  res.redirect('/admin/users');
});

module.exports = router;
