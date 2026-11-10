import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE_NAMES, RULES } from './rules';

describe('rules panel text', () => {
  const spec = readFileSync(new URL('../../../../docs/RULES_SPEC.md', import.meta.url), 'utf8');
  const decisions = readFileSync(
    new URL('../../../../docs/RULES_DECISIONS.md', import.meta.url),
    'utf8',
  );

  it('cites only rule ids that exist in the rules spec or the decisions', () => {
    for (const r of RULES)
      for (const id of r.refs ?? [])
        expect(spec.includes(`**${id}`) || decisions.includes(`| ${id} |`), `${r.id} → ${id}`).toBe(
          true,
        );
  });

  it('has unique ids and a section for every module', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
    for (const m of Object.keys(MODULE_NAMES)) expect(RULES.some((r) => r.module === m)).toBe(true);
  });
});
