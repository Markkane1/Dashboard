import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { Request, Response } from 'express';

// Import the validator under test
import validateMiddleware from '../../src/server/middleware/validate';
const { validateBody } = validateMiddleware as any;

describe('Validate Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusSpy: any;
  let jsonSpy: any;

  // Simple test Zod schema
  const userTestSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    age: z.number().optional()
  });

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: statusSpy
    };
  });

  it('should return validated data and not call response methods on successful validation (happy path)', () => {
    const validData = {
      username: 'johndoe',
      email: 'john@example.com',
      age: 25
    };
    mockRequest.body = validData;

    const result = validateBody(userTestSchema, mockRequest as Request, mockResponse as Response);

    expect(result).toEqual(validData);
    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('should return parsed data even if optional fields are omitted (happy path optional)', () => {
    const validData = {
      username: 'johndoe',
      email: 'john@example.com'
    };
    mockRequest.body = validData;

    const result = validateBody(userTestSchema, mockRequest as Request, mockResponse as Response);

    expect(result).toEqual(validData);
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('should respond with HTTP 400 and formatted error messages on validation failure (sad/error path)', () => {
    // Missing email, username too short, and age has wrong type
    mockRequest.body = {
      username: 'jo',
      age: 'not-a-number'
    };

    const result = validateBody(userTestSchema, mockRequest as Request, mockResponse as Response);

    expect(result).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: 'Invalid request.',
      details: [
        { field: 'username', message: 'Too small: expected string to have >=3 characters' },
        { field: 'email', message: 'Invalid input: expected string, received undefined' },
        { field: 'age', message: 'Invalid input: expected number, received string' }
      ]
    });
  });

  it('should handle nested schema fields errors formatting correctly (edge case nested fields)', () => {
    const nestedSchema = z.object({
      profile: z.object({
        firstName: z.string(),
        lastName: z.string()
      })
    });

    mockRequest.body = {
      profile: {
        firstName: 123 // expected string
        // lastName is missing
      }
    };

    const result = validateBody(nestedSchema, mockRequest as Request, mockResponse as Response);

    expect(result).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: 'Invalid request.',
      details: [
        { field: 'profile.firstName', message: 'Invalid input: expected string, received number' },
        { field: 'profile.lastName', message: 'Invalid input: expected string, received undefined' }
      ]
    });
  });

  it('should handle empty request bodies and invalid schema shapes (edge case: empty body)', () => {
    mockRequest.body = null; // empty or null body

    const result = validateBody(userTestSchema, mockRequest as Request, mockResponse as Response);

    expect(result).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith(400);
  });

  it('should handle array error paths formatting correctly (edge case arrays)', () => {
    const arraySchema = z.object({
      tags: z.array(z.string())
    });

    mockRequest.body = {
      tags: ['valid', 123, 'valid-again']
    };

    const result = validateBody(arraySchema, mockRequest as Request, mockResponse as Response);

    expect(result).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: 'Invalid request.',
      details: [
        { field: 'tags.1', message: 'Invalid input: expected string, received number' }
      ]
    });
  });
});
