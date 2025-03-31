/**
 * Utility functions for testing
 */

/**
 * Swallows stderr output during test execution
 * Useful for suppressing expected error messages in tests
 */
export async function swallowStderr(fn: () => Promise<any>): Promise<any> {
  const originalStderr = process.stderr.write;
  let stderrOutput = '';

  process.stderr.write = (chunk: any, ...args: any[]) => {
    stderrOutput += chunk;
    return true;
  };

  try {
    return await fn();
  } finally {
    process.stderr.write = originalStderr;
  }
} 