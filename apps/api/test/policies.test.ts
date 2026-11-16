import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePolicies } from '../src/policies.js';
import { repoRoot } from '../src/paths.js';

describe('sku policies', () => {
  it('parses the committed example', () => {
    const raw = JSON.parse(readFileSync(`${repoRoot}/data/sku-policies.example.json`, 'utf8'));
    expect(parsePolicies(raw)['TF-PLA BASIC-1KG-BLACK']).toEqual({ moq: 10, cartonSize: 10 });
  });

  it('rejects a carton size of zero', () => {
    expect(() => parsePolicies({ 'TF-PLA-BLK-1KG': { moq: 1, cartonSize: 0 } })).toThrow(/carton/i);
  });
});
