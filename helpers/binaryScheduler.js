/**
 * Binary Matching Scheduler
 * 
 * Executes weekly binary matching every Friday at 23:59
 * Uses node-cron for scheduling
 */

import cron from 'node-cron';
import { executeWeeklyMatching } from './binaryMatchingService.js';

let scheduledTask = null;

/**
 * Start the weekly binary matching scheduler
 * Runs every Friday at 23:59 (11:59 PM)
 * Cron format: '59 23 * * 5' = minute hour day month day-of-week
 * Day of week: 5 = Friday
 */
export const startBinaryMatchingScheduler = () => {
  // Stop existing task if any
  if (scheduledTask) {
    scheduledTask.stop();
  }

  // Schedule task for Friday 23:59
  scheduledTask = cron.schedule('59 23 * * 5', async () => {
    const now = new Date();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎯 WEEKLY BINARY MATCHING - ${now.toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const result = await executeWeeklyMatching();
      
      console.log('\n📊 EXECUTION SUMMARY:');
      console.log(`   ✅ Status: Success`);
      console.log(`   👥 Members: ${result.summary.totalMembers}`);
      console.log(`   🔄 PV Matched: ${result.summary.totalMatched}`);
      console.log(`   💰 Income: $${result.summary.totalIncome.toFixed(2)}`);
      console.log(`   ⏰ Time: ${result.summary.executionTime.toLocaleTimeString()}`);
      console.log(`\n${'='.repeat(60)}\n`);
      
    } catch (error) {
      console.error('\n❌ WEEKLY MATCHING FAILED:');
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.log(`\n${'='.repeat(60)}\n`);
    }
  }, {
    scheduled: true,
    timezone: "UTC" // Adjust timezone as needed
  });

  console.log('✅ Binary matching scheduler started');
  console.log('📅 Schedule: Every Friday at 23:59 UTC');
};

/**
 * Stop the scheduler
 */
export const stopBinaryMatchingScheduler = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('🛑 Binary matching scheduler stopped');
  }
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = () => {
  if (!scheduledTask) {
    return {
      running: false,
      message: 'Scheduler not started'
    };
  }

  return {
    running: true,
    nextExecution: scheduledTask.nextDates(1).toString(),
    schedule: 'Every Friday at 23:59 UTC',
    message: 'Scheduler active'
  };
};

/**
 * Run matching immediately (for testing)
 */
export const runMatchingNow = async () => {
  console.log('🧪 Manual execution triggered');
  try {
    const result = await executeWeeklyMatching();
    console.log('✅ Manual execution complete');
    return result;
  } catch (error) {
    console.error('❌ Manual execution failed:', error);
    throw error;
  }
};

export default {
  startBinaryMatchingScheduler,
  stopBinaryMatchingScheduler,
  getSchedulerStatus,
  runMatchingNow
};
