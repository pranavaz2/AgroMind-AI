const { getCurrentWeather } = require('../services/weatherService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getCurrent = asyncHandler(async (req, res) => {
  const weather = await getCurrentWeather({
    latitude: req.query.lat,
    longitude: req.query.lon,
  });

  return sendSuccess(res, 'Weather fetched successfully.', { weather });
});

module.exports = {
  getCurrent,
};
