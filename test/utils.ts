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

import { spawn } from 'child_process';
import { promisify } from 'util';

export async function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, {});
    let stdout = '';
    let _stderrOutput = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      _stderrOutput += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

export async function runCommandWithArgs(command: string, _args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const [cmd, ...cmdArgs] = command.split(' ');
    const process = spawn(cmd, cmdArgs, {});
    let stdout = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}
