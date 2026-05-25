const { sendSuccess } = require('../utils/apiResponse');

function getHealth(req, res) {
  return sendSuccess(res, 'AgroMind AI API is running', {
    service: 'agromind-ai-server',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
