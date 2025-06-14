const express = require('express');
const router = express.Router();

const usersRoutes = require('./users.js');
const adminRoutes = require('./admin.js');

router.use('/users', usersRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
