import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSaga } from './saga';

describe('saga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should execute all steps successfully', async () => {
      const step1 = vi.fn().mockResolvedValue('result1');
      const step2 = vi.fn().mockResolvedValue('result2');
      const step3 = vi.fn().mockResolvedValue('result3');

      const result = await executeSaga({
        context: { data: 'initial' },
        steps: [
          { name: 'Step 1', execute: step1 },
          { name: 'Step 2', execute: step2 },
          { name: 'Step 3', execute: step3 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(3);
      expect(step1).toHaveBeenCalledTimes(1);
      expect(step2).toHaveBeenCalledTimes(1);
      expect(step3).toHaveBeenCalledTimes(1);
    });

    it('should pass context to each step', async () => {
      interface Context {
        value: number;
      }

      const result = await executeSaga<Context>({
        context: { value: 0 },
        steps: [
          {
            name: 'Increment',
            execute: async (ctx) => {
              ctx.value += 1;
              return ctx.value;
            },
          },
          {
            name: 'Double',
            execute: async (ctx) => {
              ctx.value *= 2;
              return ctx.value;
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.context.value).toBe(2); // (0 + 1) * 2
    });
  });

  describe('compensation (rollback)', () => {
    it('should compensate on failure', async () => {
      const step1Execute = vi.fn().mockResolvedValue('result1');
      const step1Compensate = vi.fn().mockResolvedValue(undefined);

      const step2Execute = vi.fn().mockResolvedValue('result2');
      const step2Compensate = vi.fn().mockResolvedValue(undefined);

      const step3Execute = vi.fn().mockRejectedValue(new Error('Step 3 failed'));

      const result = await executeSaga({
        context: {},
        steps: [
          {
            name: 'Step 1',
            execute: step1Execute,
            compensate: step1Compensate,
          },
          {
            name: 'Step 2',
            execute: step2Execute,
            compensate: step2Compensate,
          },
          {
            name: 'Step 3',
            execute: step3Execute,
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(2); // Only 2 steps succeeded
      expect(result.error).toBeDefined();

      // Both compensations should have been called (in reverse order)
      expect(step2Compensate).toHaveBeenCalledTimes(1);
      expect(step1Compensate).toHaveBeenCalledTimes(1);

      // Verify they were called in reverse order
      const step1Order = step1Compensate.mock.invocationCallOrder[0];
      const step2Order = step2Compensate.mock.invocationCallOrder[0];
      expect(step2Order).toBeLessThan(step1Order);
    });

    it('should not compensate if step has no compensate function', async () => {
      const step1Execute = vi.fn().mockResolvedValue('result1');

      const step2Execute = vi.fn().mockRejectedValue(new Error('Step 2 failed'));

      const result = await executeSaga({
        context: {},
        steps: [
          { name: 'Step 1', execute: step1Execute },
          { name: 'Step 2', execute: step2Execute },
        ],
      });

      expect(result.success).toBe(false);
      // No error should occur from missing compensate
    });
  });

  describe('callbacks', () => {
    it('should invoke onStepComplete callback', async () => {
      const onStepComplete = vi.fn();

      await executeSaga({
        context: {},
        steps: [
          { name: 'Step 1', execute: async () => 'result1' },
          { name: 'Step 2', execute: async () => 'result2' },
        ],
        onStepComplete,
      });

      expect(onStepComplete).toHaveBeenCalledTimes(2);
      expect(onStepComplete).toHaveBeenNthCalledWith(1, 'Step 1', 'result1');
      expect(onStepComplete).toHaveBeenNthCalledWith(2, 'Step 2', 'result2');
    });

    it('should invoke onStepFailed callback', async () => {
      const onStepFailed = vi.fn();
      const error = new Error('Step 2 failed');

      await executeSaga({
        context: {},
        steps: [
          { name: 'Step 1', execute: async () => 'result1' },
          { name: 'Step 2', execute: async () => Promise.reject(error) },
        ],
        onStepFailed,
      });

      expect(onStepFailed).toHaveBeenCalledTimes(1);
      expect(onStepFailed).toHaveBeenCalledWith('Step 2', error);
    });

    it('should invoke onCompensate callback', async () => {
      const onCompensate = vi.fn();

      await executeSaga({
        context: {},
        steps: [
          {
            name: 'Step 1',
            execute: async () => 'result1',
            compensate: async () => {},
          },
          {
            name: 'Step 2',
            execute: async () => Promise.reject(new Error('Fail')),
          },
        ],
        onCompensate,
      });

      expect(onCompensate).toHaveBeenCalledTimes(1);
      expect(onCompensate).toHaveBeenCalledWith('Step 1');
    });
  });

  describe('type safety', () => {
    it('should preserve context type', async () => {
      interface OrderContext {
        orderId: string;
        total: number;
        paymentId?: string;
        inventoryReserved?: boolean;
      }

      const result = await executeSaga<OrderContext>({
        context: {
          orderId: 'order-123',
          total: 100,
        },
        steps: [
          {
            name: 'Process Payment',
            execute: async (ctx) => {
              ctx.paymentId = 'pay-456';
              return ctx.paymentId;
            },
          },
          {
            name: 'Reserve Inventory',
            execute: async (ctx) => {
              ctx.inventoryReserved = true;
              return ctx.inventoryReserved;
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.context.orderId).toBe('order-123');
      expect(result.context.paymentId).toBe('pay-456');
      expect(result.context.inventoryReserved).toBe(true);
    });
  });
});
