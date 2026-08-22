import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHandoff,
  isQualificationComplete,
  missingQualificationFields,
} from '../services/handoff.js';
import { extractQualificationFromText } from '../services/conversationAgent.js';

const baseUser = {
  autoDm: {
    websiteUrl: 'https://shop.example.com',
    catalogueUrl: 'https://shop.example.com/catalogue',
    bookingUrl: 'https://calendly.com/brand',
    whatsappHandoffPhone: '+919876543210',
  },
};

test('resolveHandoff sell uses website', () => {
  const h = resolveHandoff(baseUser, { objective: 'sell' });
  assert.equal(h.type, 'website');
  assert.ok(h.url.includes('shop.example.com'));
});

test('resolveHandoff leads uses wa.me', () => {
  const h = resolveHandoff(baseUser, { objective: 'leads' });
  assert.equal(h.type, 'whatsapp');
  assert.ok(h.url.includes('wa.me'));
});

test('resolveHandoff appointment uses booking URL', () => {
  const h = resolveHandoff(baseUser, { objective: 'appointment' });
  assert.equal(h.type, 'booking');
  assert.ok(h.url.includes('calendly.com'));
});

test('resolveHandoff campaign dmLink override for link objective', () => {
  const h = resolveHandoff(baseUser, { objective: 'link', dmLink: 'https://link.test/x' });
  assert.equal(h.type, 'website');
  assert.equal(h.url, 'https://link.test/x');
});

test('isQualificationComplete requires cod and location', () => {
  assert.equal(isQualificationComplete({ cod: true, city: 'Delhi' }), true);
  assert.equal(isQualificationComplete({ cod: true }), false);
});

test('extractQualificationFromText parses COD and pincode', () => {
  const q = extractQualificationFromText('COD hai, pincode 110001, Delhi me chahiye', {});
  assert.equal(q.cod, true);
  assert.equal(q.pincode, '110001');
  assert.ok(/delhi/i.test(q.city));
});

test('missingQualificationFields lists gaps', () => {
  const missing = missingQualificationFields({ cod: true }, []);
  assert.ok(missing.includes('city'));
  assert.ok(missing.includes('pincode'));
});
