import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const locales = ['en', 'ur'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'src', 'messages');

describe('i18n message files', () => {
  it('has a JSON message file for every configured locale', () => {
    for (const locale of locales) {
      const filePath = path.join(messagesDir, `${locale}.json`);
      assert.equal(fs.existsSync(filePath), true, `${locale}.json is missing`);
      assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, 'utf8')));
    }
  });

  it('keeps translated message keys in sync with English', () => {
    const englishMessages = readMessages('en');
    const englishKeys = flattenKeys(englishMessages);

    for (const locale of locales.filter((locale) => locale !== 'en')) {
      const translatedKeys = flattenKeys(readMessages(locale));
      assert.deepEqual(translatedKeys, englishKeys, `${locale}.json keys must match en.json`);
    }
  });
});

function readMessages(locale: string) {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nestedValue]) => flattenKeys(nestedValue, prefix ? `${prefix}.${key}` : key))
    .sort();
}

export {};
