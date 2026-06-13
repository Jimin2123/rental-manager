import prettierConfig from './prettier.config.mjs';

export const sharedIgnores = [
  '**/dist/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/src/generated/**',
];

/**
 * @typedef {'off' | 'warn' | 'error' | 0 | 1 | 2} RuleSeverity
 * @typedef {RuleSeverity | [RuleSeverity, ...unknown[]]} RuleEntry
 * @typedef {Partial<Record<string, RuleEntry>>} RulesRecord
 */

/** @type {RulesRecord} */
export const sharedTypeScriptRules = {
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/no-unsafe-argument': 'warn',
};

/** @type {RulesRecord} */
export const sharedPrettierRules = {
  'prettier/prettier': ['error', prettierConfig],
};
