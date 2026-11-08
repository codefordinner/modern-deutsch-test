import { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Request-body validation via zod. A malformed body is rejected with 400 and the
 * first validation message, so it can never reach a Prisma call or corrupt data.
 * `req.body` is replaced with the parsed (typed, coerced, stripped) value.
 */
export function validate<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue?.path?.join('.') || 'body';
      res.status(400).json({ error: `Некорректный запрос (${path}): ${issue?.message ?? 'недопустимое значение'}` });
      return;
    }
    req.body = result.data;
    next();
  };
}
