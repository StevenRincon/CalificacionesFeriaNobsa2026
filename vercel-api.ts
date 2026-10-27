import { Request, Response } from 'express';
import { app } from './backend.ts';

export function createApiHandler(route?: string) {
  return (req: Request, res: Response) => {
    if (route) {
      const queryIndex = req.url?.indexOf('?') ?? -1;
      const query = queryIndex >= 0 ? req.url!.slice(queryIndex) : '';
      req.url = `${route}${query}`;
    }
    app(req, res);
  };
}
