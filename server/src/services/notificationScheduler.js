const { processDueReminders } = require('./notificationService');

const CHECK_INTERVAL_MS = 60 * 1000;
let timer = null;

function startNotificationScheduler() {
  if (timer) return;

  async function tick() {
    try {
      await processDueReminders();
    } catch (error) {
      console.warn('Notification scheduler failed:', error.message);
    }
  }

  timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.();
  tick();
}

function stopNotificationScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
};
