/** @type {import("prettier").Config} */
export default {
  printWidth: 120,
  plugins: ['prettier-plugin-astro'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
    {
      files: ['*.json', '.prettierrc', '.eslintrc'],
      options: {
        trailingComma: 'none',
      },
    },
  ],
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
};
