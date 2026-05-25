const express = require('express');
const { getCurrent } = require('../controllers/weatherController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/current', getCurrent);

module.exports = router;
