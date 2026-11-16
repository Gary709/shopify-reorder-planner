import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root. This file lives at apps/api/src. */
export const repoRoot = path.resolve(here, '../../..');

export const sampleStorePath = path.join(repoRoot, 'data', 'sample-store.json');
export const policiesPath = path.join(repoRoot, 'data', 'sku-policies.json');
export const envPath = path.join(repoRoot, '.env');
