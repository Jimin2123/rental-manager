// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import {
  sharedIgnores,
  sharedPrettierRules,
  sharedTypeScriptRules,
} from '../../eslint.shared.mjs';

export default tseslint.config(
  {
    ignores: [...sharedIgnores, 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      ...sharedTypeScriptRules,
      ...sharedPrettierRules,
    },
  },
);
