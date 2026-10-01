import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

export const validateRequest = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isWrapped = !!(schema.shape && schema.shape.body && schema.shape.query && schema.shape.params);
      if (isWrapped) {
        const parsed = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        req.body = parsed.body;
        req.query = parsed.query;
        req.params = parsed.params;
      } else {

        const parsed = await schema.parseAsync(req.body);
        req.body = parsed;
      }
      next();
    } catch (error: any) {
      // Use duck-typing instead of instanceof to avoid cross-module ZodError mismatch
      if (error?.name === 'ZodError' || Array.isArray(error?.errors)) {
        console.error('[ZodError] Validation failed:');
        (error.errors || []).forEach((e: any) => {
          console.error(`  - Field: [${e.path.join('.')}] | Code: ${e.code} | Message: ${e.message}`);
        });
        return res.status(400).json({ error: 'Dados inválidos.' });
      }
      console.error('[validate] Unexpected error:', error?.message);
      return res.status(500).json({ error: 'Erro interno.' });
    }
  };
};
