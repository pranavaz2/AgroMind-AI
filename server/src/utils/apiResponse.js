function sendSuccess(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendCreated(res, message, data = null) {
  return sendSuccess(res, message, data, 201);
}

module.exports = {
  sendCreated,
  sendSuccess,
};
