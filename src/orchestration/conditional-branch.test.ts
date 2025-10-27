import { describe, it, expect, vi, beforeEach } from 'vitest';
import { conditionalBranch } from './conditional-branch';

describe('conditional-branch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should execute correct branch based on condition', async () => {
      const branch1 = vi.fn().mockResolvedValue('branch1-result');
      const branch2 = vi.fn().mockResolvedValue('branch2-result');

      const result = await conditionalBranch({
        branches: [
          {
            condition: async (input) => input === 'a',
            execute: branch1,
          },
          {
            condition: async (input) => input === 'b',
            execute: branch2,
          },
        ],
        input: 'a',
      });

      expect(result.value).toBe('branch1-result');
      expect(result.branchIndex).toBe(0);
      expect(branch1).toHaveBeenCalledTimes(1);
      expect(branch2).not.toHaveBeenCalled();
    });

    it('should execute first matching branch', async () => {
      const branch1 = vi.fn().mockResolvedValue('branch1-result');
      const branch2 = vi.fn().mockResolvedValue('branch2-result');

      const result = await conditionalBranch({
        branches: [
          {
            condition: async () => true, // First match
            execute: branch1,
          },
          {
            condition: async () => true, // Also matches but not executed
            execute: branch2,
          },
        ],
        input: 'test',
      });

      expect(result.value).toBe('branch1-result');
      expect(result.branchIndex).toBe(0);
      expect(branch1).toHaveBeenCalledTimes(1);
      expect(branch2).not.toHaveBeenCalled();
    });
  });

  describe('default branch', () => {
    it('should execute default branch when no conditions match', async () => {
      const branch1 = vi.fn().mockResolvedValue('branch1-result');
      const defaultBranch = vi.fn().mockResolvedValue('default-result');

      const result = await conditionalBranch({
        branches: [
          {
            condition: async () => false,
            execute: branch1,
          },
        ],
        input: 'test',
        defaultBranch,
      });

      expect(result.value).toBe('default-result');
      expect(result.branchIndex).toBe(-1); // Default
      expect(branch1).not.toHaveBeenCalled();
      expect(defaultBranch).toHaveBeenCalledTimes(1);
    });

    it('should throw error when no match and no default', async () => {
      const branch1 = vi.fn().mockResolvedValue('branch1-result');

      await expect(
        conditionalBranch({
          branches: [
            {
              condition: async () => false,
              execute: branch1,
            },
          ],
          input: 'test',
        })
      ).rejects.toThrow('No matching branch found');
    });
  });

  describe('with context', () => {
    it('should pass input to condition and execute', async () => {
      interface Input {
        score: number;
      }

      const highScoreBranch = vi.fn().mockResolvedValue('high-score');
      const lowScoreBranch = vi.fn().mockResolvedValue('low-score');

      const result = await conditionalBranch<Input, string>({
        branches: [
          {
            condition: async (input) => input.score > 80,
            execute: highScoreBranch,
          },
          {
            condition: async (input) => input.score <= 80,
            execute: lowScoreBranch,
          },
        ],
        input: { score: 90 },
      });

      expect(result.value).toBe('high-score');
      expect(highScoreBranch).toHaveBeenCalledWith({ score: 90 });
    });
  });

  describe('type safety', () => {
    it('should preserve input and output types', async () => {
      interface User {
        id: string;
        role: 'admin' | 'user';
      }

      interface Response {
        message: string;
      }

      const adminBranch = vi.fn().mockResolvedValue({ message: 'Admin dashboard' });
      const userBranch = vi.fn().mockResolvedValue({ message: 'User dashboard' });

      const result = await conditionalBranch<User, Response>({
        branches: [
          {
            condition: async (user) => user.role === 'admin',
            execute: adminBranch,
          },
          {
            condition: async (user) => user.role === 'user',
            execute: userBranch,
          },
        ],
        input: { id: '1', role: 'admin' },
      });

      expect(result.value.message).toBe('Admin dashboard');
    });
  });
});
