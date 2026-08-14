import test from 'node:test';
import assert from 'node:assert/strict';

import { planOrgActions } from '../lib/account/deleteAccount.js';

const ME = 'me';
const org = over => ({
  id: 'o1',
  name: 'Test Church',
  createdBy: ME,
  memberIds: [ME],
  adminIds: [ME],
  ...over,
});

test('owner who is the only member: the org is deleted with them', () => {
  const { orgActions, blockers } = planOrgActions(ME, [org()]);
  assert.equal(blockers.length, 0);
  assert.deepEqual(orgActions, [{ kind: 'delete', orgId: 'o1', name: 'Test Church' }]);
});

test('owner with another admin: ownership transfers, org survives', () => {
  const { orgActions, blockers } = planOrgActions(ME, [
    org({ memberIds: [ME, 'bob', 'cara'], adminIds: [ME, 'bob'] }),
  ]);
  assert.equal(blockers.length, 0);
  assert.deepEqual(orgActions, [
    { kind: 'transfer', orgId: 'o1', name: 'Test Church', newOwnerId: 'bob' },
  ]);
});

test('sole admin with other members is blocked, so nobody is stranded', () => {
  // The real "Del Cerro Baptist Church" shape: 10 members, 1 admin.
  const members = [ME, ...Array.from({ length: 9 }, (_, i) => `member${i}`)];
  const { orgActions, blockers } = planOrgActions(ME, [
    org({ name: 'Del Cerro Baptist Church', memberIds: members, adminIds: [ME] }),
  ]);

  assert.equal(orgActions.length, 0, 'must not act on the org');
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].code, 'sole_admin_of_shared_org');
  assert.match(blockers[0].message, /9 other members/);
});

test('sole admin with exactly one other member: message stays singular', () => {
  const { blockers } = planOrgActions(ME, [
    org({ memberIds: [ME, 'solo'], adminIds: [ME] }),
  ]);
  assert.match(blockers[0].message, /1 other member\./);
});

test('plain member: they just leave, the org is untouched', () => {
  const { orgActions, blockers } = planOrgActions(ME, [
    org({ createdBy: 'someone-else', memberIds: ['someone-else', ME], adminIds: ['someone-else'] }),
  ]);
  assert.equal(blockers.length, 0);
  assert.deepEqual(orgActions, [{ kind: 'leave', orgId: 'o1', name: 'Test Church' }]);
});

test('owner missing from memberIds still counts as sole member', () => {
  // Owners are not guaranteed to appear in their own memberIds array.
  const { orgActions, blockers } = planOrgActions(ME, [
    org({ memberIds: [], adminIds: [] }),
  ]);
  assert.equal(blockers.length, 0);
  assert.equal(orgActions[0].kind, 'delete');
});

test('one blocked org blocks the whole deletion, even alongside safe ones', () => {
  const { orgActions, blockers } = planOrgActions(ME, [
    org({ id: 'safe', memberIds: [ME], adminIds: [ME] }),
    org({ id: 'risky', name: 'Shared', memberIds: [ME, 'x'], adminIds: [ME] }),
  ]);
  assert.equal(blockers.length, 1);
  assert.deepEqual(orgActions.map(a => a.orgId), ['safe']);
});

test('missing adminIds/memberIds fields do not throw', () => {
  const { orgActions } = planOrgActions(ME, [
    { id: 'o1', name: 'Bare', createdBy: ME, memberIds: undefined, adminIds: undefined },
  ]);
  assert.equal(orgActions[0].kind, 'delete');
});
