/**
 * TimingTrackerService - Tracks command execution timing
 * Encapsulates timing state and calculations
 */
class TimingTrackerService {
  constructor() {
    this.timings = new Map();
    this.cleanupHandles = new Map();
  }

  /**
   * Track when a command was queued
   * @param {string} commandId - Unique command identifier
   * @param {Object} metadata - Command metadata (function, parameters)
   */
  trackQueued(commandId, metadata) {
    this.timings.set(commandId, {
      queuedAt: Date.now(),
      function: metadata.function,
      parameters: metadata.parameters,
    });
  }

  /**
   * Track when a command was sent to TV
   * @param {string} commandId - Unique command identifier
   * @returns {number|null} Queue time in milliseconds, or null if not found
   */
  trackSentToTv(commandId) {
    const timing = this.timings.get(commandId);
    if (timing) {
      timing.sentToTvAt = Date.now();
      return timing.sentToTvAt - timing.queuedAt;
    }
    return null;
  }

  /**
   * Track when a response was received from TV
   * @param {string} commandId - Unique command identifier
   * @param {number} tvProcessingTimeMs - TV-reported processing time
   * @returns {Object|null} Timing report with totalTime, networkTime, tvProcessingTime
   */
  trackReceivedFromTv(commandId, tvProcessingTimeMs) {
    const timing = this.timings.get(commandId);
    if (timing) {
      timing.receivedFromTvAt = Date.now();
      timing.tvProcessingTimeMs = tvProcessingTimeMs;

      return this.calculateTimingReport(timing);
    }
    return null;
  }

  /**
   * Get timing information for a command
   * @param {string} commandId - Unique command identifier
   * @returns {Object|null} Timing object or null if not found
   */
  getTiming(commandId) {
    return this.timings.get(commandId);
  }

  /**
   * Calculate timing report from timing object
   * @private
   */
  calculateTimingReport(timing) {
    const totalTime = timing.receivedFromTvAt - timing.queuedAt;
    const networkTime = timing.sentToTvAt
      ? timing.receivedFromTvAt - timing.sentToTvAt
      : totalTime;
    const tvProcessingTime = timing.tvProcessingTimeMs || 'N/A';

    return {
      totalTime,
      networkTime,
      tvProcessingTime,
      function: timing.function,
      parameters: timing.parameters,
    };
  }

  /**
   * Get total time since command was queued
   * @param {string} commandId - Unique command identifier
   * @returns {number|string} Time in milliseconds or 'N/A'
   */
  getTotalTime(commandId) {
    const timing = this.timings.get(commandId);
    return timing ? Date.now() - timing.queuedAt : 'N/A';
  }

  /**
   * Clean up timing data after specified delay
   * @param {string} commandId - Unique command identifier
   * @param {number} delayMs - Delay in milliseconds (default: 60000)
   */
  scheduleCleanup(commandId, delayMs = 60000) {
    const existingHandle = this.cleanupHandles.get(commandId);
    if (existingHandle) {
      clearTimeout(existingHandle);
    }

    const handle = setTimeout(() => {
      this.timings.delete(commandId);
      this.cleanupHandles.delete(commandId);
    }, delayMs);

    this.cleanupHandles.set(commandId, handle);
  }

  /**
   * Get number of tracked commands
   * @returns {number}
   */
  getTrackedCount() {
    return this.timings.size;
  }

  /**
   * Clear all timing data (useful for testing)
   */
  clear() {
    for (const handle of this.cleanupHandles.values()) {
      clearTimeout(handle);
    }
    this.timings.clear();
    this.cleanupHandles.clear();
  }

  /**
   * Cancel cleanup for a specific command
   * @param {string} commandId - Unique command identifier
   */
  cancelCleanup(commandId) {
    const handle = this.cleanupHandles.get(commandId);
    if (handle) {
      clearTimeout(handle);
      this.cleanupHandles.delete(commandId);
    }
  }
}

module.exports = new TimingTrackerService();
