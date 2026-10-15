/**
 * BaseForm.test.ts runs the real inline script against hand-written markup. This guard keeps that markup
 * honest: every hook the script relies on must still be rendered by the .astro sources, so renaming one
 * there turns this test red instead of leaving the behaviour tests green against stale markup.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractInlineScript } from '../extract-script';

const read = (name: string) =>
  readFileSync(resolve(import.meta.dirname, `../../src/components/form/${name}.astro`), 'utf-8');

const sources = {
  BaseForm: read('BaseForm'),
  FormField: read('FormField'),
  FormRadioGroup: read('FormRadioGroup'),
  FormConditional: read('FormConditional'),
};

const script = extractInlineScript(sources.BaseForm, 'BaseForm.astro');

// [hook the script uses, component that must render it]
const hooks: [string, keyof typeof sources][] = [
  ['data-base-form', 'BaseForm'],
  ['data-form-id', 'BaseForm'],
  ['data-submit-label', 'BaseForm'],
  ['data-submitting-label', 'BaseForm'],
  ['data-success-message', 'BaseForm'],
  ['data-error-message', 'BaseForm'],
  ['data-honeypot', 'BaseForm'],
  ['data-required-note', 'BaseForm'],
  ['data-submit', 'BaseForm'],
  ['data-status', 'BaseForm'],
  ['data-field', 'FormField'],
  ['data-field-error', 'FormField'],
  ['data-base-describedby', 'FormField'],
  ['data-field', 'FormRadioGroup'],
  ['data-group', 'FormRadioGroup'],
  ['data-field-error', 'FormRadioGroup'],
  ['data-base-describedby', 'FormRadioGroup'],
  ['data-show-when', 'FormConditional'],
  ['data-show-is', 'FormConditional'],
];

describe('BaseForm script and form components agree on their hooks', () => {
  it.each(hooks)('the script uses %s and %s renders it', (hook, component) => {
    // `dataset.fooBar` is how the script reads `data-foo-bar`.
    const camel = hook.replace(/^data-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    expect(script.includes(hook) || script.includes(`dataset.${camel}`)).toBe(true);
    expect(sources[component]).toContain(hook);
  });

  it('error elements follow the `<id>-error` convention the script points aria-describedby at', () => {
    expect(sources.FormField).toContain('`${id}-error`');
    expect(sources.FormRadioGroup).toContain('`${id}-error`');
  });

  it('the honeypot input is named "website", which the script skips when collecting values', () => {
    expect(sources.BaseForm).toContain('name="website"');
    expect(script).toContain("key === 'website'");
  });
});
