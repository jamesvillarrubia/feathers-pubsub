import { describe, it, expect } from 'vitest'
import { runFromFile } from '@stepci/runner'
import path from 'path'

interface StepExpect {
  status?: number;
  json?: Record<string, any>;
}

interface StepResult {
  name?: string;
  passed: boolean;
  expect?: StepExpect;
  http?: {
    response: {
      status: number;
      json: Record<string, any>;
    };
  };
}

describe('StepCI Tests', async () => {
  const { result } = await runFromFile(path.join(__dirname, 'stepci.yaml'))
  
  // Create a test for each step in each test
  result.tests.forEach(test => {
    
    describe(test.id || test.name || 'unnamed', () => {
      test.steps.forEach(step => {
        const typedStep = step as StepResult;
        if (!typedStep.name) return; // Skip if no name
        
        it(typedStep.name, () => {
          // Check if the step passed
          expect(typedStep.passed).toBe(true)
          
          // If there are expectations defined, check them
          if (typedStep.expect) {
            if (typedStep.expect.status && typedStep.http?.response?.status) {
              expect(typedStep.http.response.status).toBe(typedStep.expect.status)
            }
            if (typedStep.expect.json && typedStep.http?.response?.json) {
              expect(typedStep.http.response.json).toMatchObject(typedStep.expect.json)
            }
          }
        })
      })
    })
  })
})