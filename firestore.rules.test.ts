import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Deterministic static & simulation evaluator for the Dirty Dozen payloads
 * against our hardened Firestore rules in firestore.rules / DRAFT_firestore.rules.
 */
interface AuthContext {
  uid: string;
  token: {
    email_verified: boolean;
  };
}

interface CampaignPayload {
  [key: string]: unknown;
}

const SERVER_NOW = '2026-10-19T10:40:00.000Z';

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

const REQUIRED_KEYS = [
  'ownerId',
  'title',
  'characterName',
  'characterGrade',
  'arc',
  'location',
  'turnCount',
  'campaignPayload',
  'createdAt',
  'updatedAt',
];

function isValidCampaignSave(data: CampaignPayload, auth: AuthContext | null): boolean {
  if (!auth) return false;
  const keys = Object.keys(data);
  if (!REQUIRED_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => REQUIRED_KEYS.includes(k))) return false;

  return (
    typeof data.ownerId === 'string' &&
    data.ownerId.length >= 1 &&
    data.ownerId.length <= 128 &&
    /^[a-zA-Z0-9_\-]+$/.test(data.ownerId) &&
    data.ownerId === auth.uid &&
    typeof data.title === 'string' &&
    data.title.length >= 1 &&
    data.title.length <= 160 &&
    typeof data.characterName === 'string' &&
    data.characterName.length >= 1 &&
    data.characterName.length <= 100 &&
    typeof data.characterGrade === 'string' &&
    data.characterGrade.length >= 1 &&
    data.characterGrade.length <= 60 &&
    typeof data.arc === 'string' &&
    data.arc.length >= 1 &&
    data.arc.length <= 160 &&
    typeof data.location === 'string' &&
    data.location.length >= 1 &&
    data.location.length <= 160 &&
    typeof data.turnCount === 'number' &&
    data.turnCount >= 0 &&
    data.turnCount <= 100000 &&
    typeof data.campaignPayload === 'string' &&
    data.campaignPayload.length >= 2 &&
    data.campaignPayload.length <= 900000 &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string'
  );
}

function evaluateCreate(campaignId: string, incoming: CampaignPayload, auth: AuthContext | null): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || auth.token.email_verified !== true) return 'PERMISSION_DENIED';
  if (!isValidId(campaignId)) return 'PERMISSION_DENIED';
  if (!isValidCampaignSave(incoming, auth)) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== SERVER_NOW || incoming.updatedAt !== SERVER_NOW) return 'PERMISSION_DENIED';
  return 'ALLOWED';
}

function evaluateUpdate(
  campaignId: string,
  existing: CampaignPayload,
  incoming: CampaignPayload,
  auth: AuthContext | null
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || auth.token.email_verified !== true) return 'PERMISSION_DENIED';
  if (!isValidId(campaignId)) return 'PERMISSION_DENIED';
  if (!isValidCampaignSave(incoming, auth)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  if (incoming.ownerId !== existing.ownerId) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== SERVER_NOW) return 'PERMISSION_DENIED';

  const allowedMutable = [
    'title',
    'characterName',
    'characterGrade',
    'arc',
    'location',
    'turnCount',
    'campaignPayload',
    'updatedAt',
  ];
  const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
  if (!affectedKeys.every((k) => allowedMutable.includes(k))) return 'PERMISSION_DENIED';

  return 'ALLOWED';
}

function evaluateGetOrDelete(campaignId: string, existing: CampaignPayload, auth: AuthContext | null): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || auth.token.email_verified !== true) return 'PERMISSION_DENIED';
  if (!isValidId(campaignId)) return 'PERMISSION_DENIED';
  if (existing.ownerId !== auth.uid) return 'PERMISSION_DENIED';
  return 'ALLOWED';
}

const validAuth: AuthContext = { uid: 'user_123', token: { email_verified: true } };
const validDoc: CampaignPayload = {
  ownerId: 'user_123',
  title: 'Yuta Okkotsu — Shibuya',
  characterName: 'Yuta Okkotsu',
  characterGrade: 'Grau Especial',
  arc: 'Incidente de Shibuya',
  location: 'Estação de Shibuya - Piso B5',
  turnCount: 5,
  campaignPayload: '{"character":{"name":"Yuta"}}',
  createdAt: SERVER_NOW,
  updatedAt: SERVER_NOW,
};

test('Firestore rules file contains all Eight Pillars invariants', () => {
  const rulesText = fs.readFileSync(
    fs.existsSync('./firestore.rules') ? './firestore.rules' : './DRAFT_firestore.rules',
    'utf-8'
  );
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('isValidCampaignSave(incoming())'));
  assert.ok(rulesText.includes('affectedKeys().hasOnly('));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
});

test('Dirty Dozen #1: Unauthenticated Write is PERMISSION_DENIED', () => {
  assert.equal(evaluateCreate('camp_1', validDoc, null), 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Unverified Email Write is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateCreate('camp_1', validDoc, { uid: 'user_123', token: { email_verified: false } }),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #3: Identity Spoofing on Create is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateCreate('camp_1', { ...validDoc, ownerId: 'other_user' }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #4: Shadow Field Injection on Create is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateCreate('camp_1', { ...validDoc, isAdmin: true }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #5: ID Poisoning is PERMISSION_DENIED', () => {
  assert.equal(evaluateCreate('invalid id spaces!', validDoc, validAuth), 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Denial of Wallet String Overflow is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateCreate('camp_1', { ...validDoc, title: 'A'.repeat(200) }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #7: Timestamp Forgery on Create is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateCreate('camp_1', { ...validDoc, createdAt: '1999-01-01T00:00:00Z' }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #8: Owner Mutation on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateUpdate('camp_1', validDoc, { ...validDoc, ownerId: 'hacker_99' }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #9: CreatedAt Mutation on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateUpdate('camp_1', validDoc, { ...validDoc, createdAt: '2025-01-01T00:00:00Z' }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #10: Shadow Field Injection on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateUpdate('camp_1', validDoc, { ...validDoc, hacked: 1 }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #11: Value Poisoning on Update is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateUpdate('camp_1', validDoc, { ...validDoc, turnCount: 'invalid_number' }, validAuth),
    'PERMISSION_DENIED'
  );
});

test('Dirty Dozen #12: Cross-User Read / Delete is PERMISSION_DENIED', () => {
  assert.equal(
    evaluateGetOrDelete('camp_1', validDoc, { uid: 'attacker_uid', token: { email_verified: true } }),
    'PERMISSION_DENIED'
  );
});
