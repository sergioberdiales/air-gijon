const express = require('express');
const router = express.Router();

const usersRoutes = require('./users.js');
const adminRoutes = require('./admin.js');
const airRoutes = require('./air.js');

router.use('/users', usersRoutes);
router.use('/admin', adminRoutes);
router.use('/air', airRoutes);

module.exports = router;
