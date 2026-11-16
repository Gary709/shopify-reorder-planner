import express, { type ErrorRequestHandler, type Express } from 'express';
import { PlannerError, parseSettings, planStore } from '@tinyfab/core';
import { loadSnapshot } from './catalogue.js';

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/plan', async (req, res, next) => {
    try {
      const refresh = isRecord(req.body) && req.body.refresh === true;
      const settings = parseSettings(req.body);
      const snapshot = await loadSnapshot(refresh);
      res.json(planStore(snapshot, settings));
    } catch (error) {
      next(error);
    }
  });

  app.use(((error, _req, res, _next) => {
    if (error instanceof PlannerError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }) as ErrorRequestHandler);

  return app;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
