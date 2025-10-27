import { describe, it, expect, vi, beforeEach } from 'vitest';
import { humanInTheLoop, CommonEscalationRules } from './human-in-the-loop';

describe('human-in-the-loop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return AI result when no escalation needed', async () => {
      const fn = vi.fn().mockResolvedValue({ decision: 'approved', confidence: 0.95 });
      const requestHumanReview = vi.fn();

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test content',
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
      });

      expect(result.value.decision).toBe('approved');
      expect(result.escalated).toBe(false);
      expect(requestHumanReview).not.toHaveBeenCalled();
    });

    it('should escalate to human when rules match', async () => {
      const aiResult = { decision: 'uncertain', confidence: 0.6 };
      const fn = vi.fn().mockResolvedValue(aiResult);
      const humanResult = { decision: 'approved', confidence: 1.0 };
      const requestHumanReview = vi.fn().mockResolvedValue(humanResult);

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test content',
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
      });

      expect(result.value).toEqual(humanResult);
      expect(result.escalated).toBe(true);
      expect(result.escalationReason).toBeDefined();
      expect(requestHumanReview).toHaveBeenCalledTimes(1);
    });
  });

  describe('escalation rules', () => {
    it('should use low confidence rule', async () => {
      const fn = vi.fn().mockResolvedValue({ confidence: 0.5 });
      const requestHumanReview = vi.fn().mockResolvedValue({ confidence: 1.0 });

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
      });

      expect(result.escalated).toBe(true);
    });

    it('should use sensitive keywords rule', async () => {
      const fn = vi.fn().mockResolvedValue({ text: 'violence and harm' });
      const requestHumanReview = vi.fn().mockResolvedValue({ text: 'reviewed' });

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [CommonEscalationRules.sensitiveKeywords(['violence', 'harm'])],
        requestHumanReview,
      });

      expect(result.escalated).toBe(true);
    });

    it('should use custom rule', async () => {
      const customRule = (result: any) => result.flagged === true;
      const fn = vi.fn().mockResolvedValue({ flagged: true });
      const requestHumanReview = vi.fn().mockResolvedValue({ flagged: false });

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [customRule],
        requestHumanReview,
      });

      expect(result.escalated).toBe(true);
    });

    it('should not escalate when no rules match', async () => {
      const fn = vi.fn().mockResolvedValue({ confidence: 0.95, text: 'safe content' });
      const requestHumanReview = vi.fn();

      const result = await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [
          CommonEscalationRules.lowConfidence(0.8),
          CommonEscalationRules.sensitiveKeywords(['violence']),
        ],
        requestHumanReview,
      });

      expect(result.escalated).toBe(false);
      expect(requestHumanReview).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('should invoke onEscalate callback', async () => {
      const fn = vi.fn().mockResolvedValue({ confidence: 0.5 });
      const requestHumanReview = vi.fn().mockResolvedValue({ confidence: 1.0 });
      const onEscalate = vi.fn();

      await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
        onEscalate,
      });

      expect(onEscalate).toHaveBeenCalledTimes(1);
      expect(onEscalate).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'test',
          aiResult: { confidence: 0.5 },
        })
      );
    });

    it('should invoke onResolved callback', async () => {
      const fn = vi.fn().mockResolvedValue({ confidence: 0.5 });
      const humanResult = { confidence: 1.0 };
      const requestHumanReview = vi.fn().mockResolvedValue(humanResult);
      const onResolved = vi.fn();

      await humanInTheLoop({
        execute: fn,
        input: 'test',
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
        onResolved,
      });

      expect(onResolved).toHaveBeenCalledTimes(1);
      expect(onResolved).toHaveBeenCalledWith(humanResult, expect.any(Number));
    });
  });

  describe('type safety', () => {
    it('should preserve input and output types', async () => {
      interface ModerationInput {
        text: string;
      }

      interface ModerationResult {
        decision: 'approved' | 'rejected' | 'review';
        confidence: number;
      }

      const aiResult: ModerationResult = { decision: 'approved', confidence: 0.95 };
      const fn = vi.fn().mockResolvedValue(aiResult);
      const requestHumanReview = vi.fn();

      const result = await humanInTheLoop<ModerationInput, ModerationResult>({
        execute: fn,
        input: { text: 'test content' },
        escalationRules: [CommonEscalationRules.lowConfidence(0.8)],
        requestHumanReview,
      });

      expect(result.value.decision).toBe('approved');
      expect(result.value.confidence).toBe(0.95);
    });
  });
});

describe('CommonEscalationRules', () => {
  describe('lowConfidence', () => {
    it('should trigger on low confidence', () => {
      const rule = CommonEscalationRules.lowConfidence(0.8);

      expect(rule({ confidence: 0.7 })).toBe(true);
      expect(rule({ confidence: 0.9 })).toBe(false);
    });
  });

  describe('sensitiveKeywords', () => {
    it('should trigger on sensitive keywords', () => {
      const rule = CommonEscalationRules.sensitiveKeywords(['violence', 'hate']);

      expect(rule({ text: 'contains violence and aggression' })).toBe(true);
      expect(rule({ text: 'safe content' })).toBe(false);
      expect(rule({ content: 'hate speech detected' })).toBe(true);
    });

    it('should be case insensitive', () => {
      const rule = CommonEscalationRules.sensitiveKeywords(['Violence']);

      expect(rule({ text: 'VIOLENCE is bad' })).toBe(true);
      expect(rule({ text: 'violence is bad' })).toBe(true);
    });
  });
});
