import cron from 'node-cron';
import { resetDailyLoginCounts } from '../controller/user/userController.js';
import logger from "../helpers/logger.js";

const cronLogger = logger.module("CRON_JOBS");

/**
 * Schedule daily reset of login counts at midnight
 * Runs every day at 00:00 (midnight)
 */
export const scheduleDailyLoginReset = () => {
  // Run at midnight every day (00:00)
  cron.schedule('0 0 * * *', async () => {
    cronLogger.info('Starting daily login count reset job');
    try {
      const result = await resetDailyLoginCounts(null, null);
      cronLogger.success(`Daily reset completed: ${result.usersReset} users reset`);
    } catch (error) {
      cronLogger.error('Daily reset job failed', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata" 
  });

  cronLogger.success('Daily login reset cron job scheduled (runs at midnight)');
};

/**
 * Initialize all cron jobs
 */
export const initializeCronJobs = () => {
  cronLogger.info('Initializing scheduled jobs...');
  scheduleDailyLoginReset();
  cronLogger.success('All cron jobs initialized successfully');
};
