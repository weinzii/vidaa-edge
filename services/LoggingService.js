/**
 * LoggingService - Centralized logging for command lifecycle
 * Eliminates code duplication and provides consistent log formatting
 */
class LoggingService {
  /**
   * Extract file path information from command for logging
   * @param {Object} command - Command object with function name and parameters
   * @returns {string} Formatted file info string (e.g., " → /etc/shadow")
   */
  extractFileInfo(command) {
    if (
      command.function === 'Hisense_FileRead' &&
      command.parameters &&
      command.parameters[0]
    ) {
      const relativePath = command.parameters[0];
      const absolutePath = relativePath.replace(/^\.\.\/\.\.\/\.\.\//, '/');
      return ` → ${absolutePath}`;
    }
    return '';
  }

  /**
   * Log when a command is queued
   */
  logCommandQueued(command) {
    const fileInfo = this.extractFileInfo(command);
    const paramsPreview = JSON.stringify(command.parameters).substring(0, 50);
    console.log(
      `[QUEUED] ${command.id} - ${command.function}(${paramsPreview})${fileInfo}`
    );
  }

  /**
   * Log when a command is sent to TV
   */
  logCommandSent(command, queueTimeMs) {
    console.log(
      `[SENT] ${command.id} - ${command.function} (queued ${queueTimeMs}ms)`
    );
  }

  /**
   * Log when a response is received from TV
   */
  logResponseReceived(commandId, timing, result) {
    const fileInfo = this.extractFileInfo({
      function: timing.function,
      parameters: timing.parameters,
    });

    const status = result.success ? '✓' : '✗';
    console.log(
      `[${status}] ${commandId} - ${timing.function}${fileInfo} (${timing.totalTime}ms total, ${timing.networkTime}ms network, ${timing.tvProcessingTime}ms TV)`
    );

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  /**
   * Log when a command fails (timeout or error)
   */
  logCommandFailed(commandId, timing, result, totalTimeMs) {
    const fileInfo = this.extractFileInfo({
      function: result.function || (timing ? timing.function : 'unknown'),
      parameters: timing ? timing.parameters : [],
    });

    console.log(
      `[FAILED] ${commandId} - ${
        result.function || (timing ? timing.function : 'unknown')
      }${fileInfo} (${totalTimeMs}ms)`
    );
    console.log(`  Error: ${result.error || 'Unknown error'}`);
  }
}

module.exports = new LoggingService();
