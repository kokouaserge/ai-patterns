import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateResponse } from "./response-validation";
import type { ResponseValidator } from "../types/response-validation";
import { PatternError, ErrorCode } from "../types/errors";

interface ProductResponse {
  name: string;
  description: string;
  price: number;
}

describe("Response Validation Pattern", () => {
  describe("validateResponse", () => {
    it("should pass validation with valid response", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: (response) => response.price > 0 && response.price < 10000,
          errorMessage: "Price must be between $0 and $10,000",
        },
        {
          name: "description-length",
          validate: (response) => response.description.length > 10,
          errorMessage: "Description too short",
        },
      ];

      const result = await validateResponse({
        execute: async () => ({
          name: "Test Product",
          description: "This is a test product with enough description",
          price: 99.99,
        }),
        validators,
      });

      expect(result.value).toEqual({
        name: "Test Product",
        description: "This is a test product with enough description",
        price: 99.99,
      });
      expect(result.validation.valid).toBe(true);
      expect(result.validation.passedCount).toBe(2);
      expect(result.validation.failures).toHaveLength(0);
      expect(result.attempts).toBe(1);
      expect(result.isFallback).toBe(false);
    });

    it("should retry on validation failure", async () => {
      const execute = vi.fn();
      execute.mockResolvedValueOnce({
        name: "Product",
        description: "Short",
        price: 99,
      });
      execute.mockResolvedValueOnce({
        name: "Product",
        description: "This is a longer description",
        price: 99,
      });

      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "description-length",
          validate: (response) => response.description.length > 10,
          errorMessage: "Description too short",
        },
      ];

      const result = await validateResponse({
        execute,
        validators,
        maxRetries: 2,
      });

      expect(execute).toHaveBeenCalledTimes(2);
      expect(result.validation.valid).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it("should call onValidationFailed callback", async () => {
      const onValidationFailed = vi.fn();
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: () => false,
          errorMessage: "Invalid price",
        },
      ];

      try {
        await validateResponse({
          execute: async () => ({
            name: "Product",
            description: "Description",
            price: -10,
          }),
          validators,
          onValidationFailed,
        });
      } catch {
        // Expected to fail
      }

      expect(onValidationFailed).toHaveBeenCalledWith(
        expect.objectContaining({ name: "price-range" }),
        1,
        expect.any(Object)
      );
    });

    it("should call onValidatorPassed callback", async () => {
      const onValidatorPassed = vi.fn();
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: (response) => response.price > 0,
          errorMessage: "Invalid price",
        },
      ];

      await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
        onValidatorPassed,
      });

      expect(onValidatorPassed).toHaveBeenCalledWith(
        expect.objectContaining({ name: "price-range" }),
        expect.any(Object)
      );
    });

    it("should call onValidationSuccess callback", async () => {
      const onValidationSuccess = vi.fn();
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: () => true,
          errorMessage: "Invalid price",
        },
      ];

      await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
        onValidationSuccess,
      });

      expect(onValidationSuccess).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ valid: true })
      );
    });

    it("should use fallback when all retries fail", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: () => false,
          errorMessage: "Invalid price",
        },
      ];

      const fallbackResponse = {
        name: "Fallback Product",
        description: "Default description",
        price: 0,
      };

      const result = await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: -10,
        }),
        validators,
        maxRetries: 2,
        onAllRetriesFailed: async () => fallbackResponse,
      });

      expect(result.value).toEqual(fallbackResponse);
      expect(result.isFallback).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it("should throw error when validation fails without fallback", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-range",
          validate: () => false,
          errorMessage: "Invalid price",
        },
      ];

      await expect(
        validateResponse({
          execute: async () => ({
            name: "Product",
            description: "Description",
            price: -10,
          }),
          validators,
          maxRetries: 1,
        })
      ).rejects.toThrow(PatternError);

      try {
        await validateResponse({
          execute: async () => ({
            name: "Product",
            description: "Description",
            price: -10,
          }),
          validators,
          maxRetries: 1,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.ALL_RETRIES_FAILED);
      }
    });

    it("should throw error if no validators provided", async () => {
      await expect(
        validateResponse({
          execute: async () => ({ name: "Product", description: "Desc", price: 99 }),
          validators: [],
        })
      ).rejects.toThrow(PatternError);

      try {
        await validateResponse({
          execute: async () => ({ name: "Product", description: "Desc", price: 99 }),
          validators: [],
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
        expect((error as PatternError).code).toBe(ErrorCode.INVALID_ARGUMENT);
      }
    });

    it("should respect validator priority", async () => {
      const executionOrder: string[] = [];

      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "low-priority",
          priority: 1,
          validate: () => {
            executionOrder.push("low-priority");
            return true;
          },
          errorMessage: "Low priority failed",
        },
        {
          name: "high-priority",
          priority: 10,
          validate: () => {
            executionOrder.push("high-priority");
            return true;
          },
          errorMessage: "High priority failed",
        },
        {
          name: "medium-priority",
          priority: 5,
          validate: () => {
            executionOrder.push("medium-priority");
            return true;
          },
          errorMessage: "Medium priority failed",
        },
      ];

      await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
      });

      expect(executionOrder).toEqual(["high-priority", "medium-priority", "low-priority"]);
    });

    it("should stop on failure when stopOnFailure is true", async () => {
      const validator2 = vi.fn().mockReturnValue(true);

      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "validator-1",
          validate: () => false,
          errorMessage: "Validator 1 failed",
          stopOnFailure: true,
        },
        {
          name: "validator-2",
          validate: validator2,
          errorMessage: "Validator 2 failed",
        },
      ];

      try {
        await validateResponse({
          execute: async () => ({
            name: "Product",
            description: "Description",
            price: 99,
          }),
          validators,
        });
      } catch {
        // Expected to fail
      }

      expect(validator2).not.toHaveBeenCalled();
    });

    it("should run validators in parallel when parallel=true", async () => {
      const delays: number[] = [];
      const startTime = Date.now();

      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "validator-1",
          validate: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            delays.push(Date.now() - startTime);
            return true;
          },
          errorMessage: "Validator 1 failed",
        },
        {
          name: "validator-2",
          validate: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            delays.push(Date.now() - startTime);
            return true;
          },
          errorMessage: "Validator 2 failed",
        },
      ];

      await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
        parallel: true,
      });

      // If parallel, both should complete around the same time
      const timeDiff = Math.abs(delays[0] - delays[1]);
      expect(timeDiff).toBeLessThan(50);
    });

    it("should handle async validators", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "async-validator",
          validate: async (response) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return response.price > 0;
          },
          errorMessage: "Async validation failed",
        },
      ];

      const result = await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
      });

      expect(result.validation.valid).toBe(true);
    });

    it("should handle validator errors gracefully", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "error-validator",
          validate: () => {
            throw new Error("Validator error");
          },
          errorMessage: "Validation failed",
        },
      ];

      try {
        await validateResponse({
          execute: async () => ({
            name: "Product",
            description: "Description",
            price: 99,
          }),
          validators,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(PatternError);
      }
    });

    it("should delay between retries", async () => {
      const timestamps: number[] = [];
      const execute = vi.fn();

      execute.mockImplementation(async () => {
        timestamps.push(Date.now());
        return {
          name: "Product",
          description: "Desc",
          price: -10,
        };
      });

      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "price-validator",
          validate: () => false,
          errorMessage: "Invalid price",
        },
      ];

      try {
        await validateResponse({
          execute,
          validators,
          maxRetries: 2,
          retryDelayMs: 100,
        });
      } catch {
        // Expected to fail
      }

      expect(timestamps).toHaveLength(3);
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];

      expect(delay1).toBeGreaterThanOrEqual(90);
      expect(delay2).toBeGreaterThanOrEqual(90);
    });

    it("should include all failures in result", async () => {
      const validators: ResponseValidator<ProductResponse>[] = [
        {
          name: "validator-1",
          validate: () => false,
          errorMessage: "Validation 1 failed",
        },
        {
          name: "validator-2",
          validate: () => false,
          errorMessage: "Validation 2 failed",
        },
      ];

      const fallbackResponse = {
        name: "Fallback",
        description: "Fallback description",
        price: 0,
      };

      const result = await validateResponse({
        execute: async () => ({
          name: "Product",
          description: "Description",
          price: 99,
        }),
        validators,
        maxRetries: 1,
        onAllRetriesFailed: async () => fallbackResponse,
      });

      expect(result.validation.failures.length).toBeGreaterThan(0);
    });
  });
});
