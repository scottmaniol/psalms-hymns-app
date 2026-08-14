import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Account deletion.
 *
 * Deleting a user is not just deleting their row: they may own organizations
 * that other people depend on. The rules below exist so that one person
 * leaving never silently breaks a shared church account.
 *
 *   - Owner, and the only member       -> the org and its content are deleted
 *   - Owner, but other admins exist    -> ownership transfers to another admin
 *   - Owner, sole admin, others remain -> BLOCKED, they must promote an admin first
 *   - Member only                      -> they are simply removed from the org
 *
 * A still-billing Stripe subscription also blocks deletion, so nobody deletes
 * their account and keeps getting charged for it.
 */

const BILLABLE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'];

// Firestore caps a batch at 500 writes.
const BATCH_LIMIT = 400;

export type OrgAction =
  | { kind: 'delete'; orgId: string; name: string }
  | { kind: 'transfer'; orgId: string; name: string; newOwnerId: string }
  | { kind: 'leave'; orgId: string; name: string };

export interface Blocker {
  code: 'active_subscription' | 'sole_admin_of_shared_org';
  message: string;
}

/** Plain shape of an organization, independent of Firestore. */
export interface OrgRecord {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
  adminIds: string[];
}

interface Plan {
  blockers: Blocker[];
  orgActions: OrgAction[];
  personalPlaylistIds: string[];
}

/**
 * Decides what happens to each organization when `uid` deletes their account.
 *
 * Kept pure and free of Firestore so the rules that protect other members'
 * access can be tested directly.
 */
export function planOrgActions(
  uid: string,
  orgs: OrgRecord[]
): { orgActions: OrgAction[]; blockers: Blocker[] } {
  const orgActions: OrgAction[] = [];
  const blockers: Blocker[] = [];

  orgs.forEach(org => {
    const name = org.name || 'Untitled organization';

    if (org.createdBy !== uid) {
      orgActions.push({ kind: 'leave', orgId: org.id, name });
      return;
    }

    const otherMembers = (org.memberIds || []).filter(id => id !== uid);
    const otherAdmins = (org.adminIds || []).filter(id => id !== uid);

    if (otherMembers.length === 0) {
      orgActions.push({ kind: 'delete', orgId: org.id, name });
    } else if (otherAdmins.length > 0) {
      orgActions.push({ kind: 'transfer', orgId: org.id, name, newOwnerId: otherAdmins[0] });
    } else {
      blockers.push({
        code: 'sole_admin_of_shared_org',
        message: `You are the only admin of "${name}", which has ${otherMembers.length} other member${
          otherMembers.length === 1 ? '' : 's'
        }. Make someone else an admin first so they don't lose access.`,
      });
    }
  });

  return { orgActions, blockers };
}

/** Work out exactly what deleting this user would do, without doing any of it. */
async function buildPlan(uid: string): Promise<Plan> {
  const db = admin.firestore();
  const blockers: Blocker[] = [];
  const orgActions: OrgAction[] = [];

  // --- Billing -----------------------------------------------------------
  const subs = await db.collection('customers').doc(uid).collection('subscriptions').get();
  const billing = subs.docs.filter(d => BILLABLE_STATUSES.includes(d.data().status));

  if (billing.length > 0) {
    blockers.push({
      code: 'active_subscription',
      message:
        'You have an active subscription. Please cancel it first using Manage Subscription, then delete your account.',
    });
  }

  // --- Organizations -----------------------------------------------------
  // Query both ways: an owner is not guaranteed to appear in memberIds.
  const [asMember, asOwner] = await Promise.all([
    db.collection('organizations').where('memberIds', 'array-contains', uid).get(),
    db.collection('organizations').where('createdBy', '==', uid).get(),
  ]);

  const orgDocs = new Map<string, admin.firestore.QueryDocumentSnapshot>();
  [...asMember.docs, ...asOwner.docs].forEach(d => orgDocs.set(d.id, d));

  const orgRecords: OrgRecord[] = [...orgDocs.values()].map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      createdBy: data.createdBy,
      memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
      adminIds: Array.isArray(data.adminIds) ? data.adminIds : [],
    };
  });

  const orgPlan = planOrgActions(uid, orgRecords);
  orgActions.push(...orgPlan.orgActions);
  blockers.push(...orgPlan.blockers);

  // --- Personal playlists ------------------------------------------------
  // Org playlists belong to the organization, not the person who made them,
  // so they are left alone unless the whole org is going away.
  const playlists = await db.collection('playlists').where('userId', '==', uid).get();
  const personalPlaylistIds = playlists.docs.filter(d => !d.data().organizationId).map(d => d.id);

  return { blockers, orgActions, personalPlaylistIds };
}

async function deleteDocs(refs: admin.firestore.DocumentReference[]) {
  const db = admin.firestore();
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteByQuery(collection: string, field: string, value: string) {
  const db = admin.firestore();
  const snap = await db.collection(collection).where(field, '==', value).get();
  await deleteDocs(snap.docs.map(d => d.ref));
  return snap.size;
}

/**
 * Returns what deletion would do, so the UI can show it before the user commits.
 */
export const getAccountDeletionPreview = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const plan = await buildPlan(context.auth.uid);

  return {
    canDelete: plan.blockers.length === 0,
    blockers: plan.blockers,
    playlistsToDelete: plan.personalPlaylistIds.length,
    organizations: plan.orgActions.map(a => ({
      name: a.name,
      action: a.kind,
    })),
  };
});

/**
 * Permanently deletes the caller's account and the data that belongs to them.
 */
export const deleteAccount = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const uid = context.auth.uid;

  // Deletion is irreversible, so require a recently-issued session. This mirrors
  // the client SDK's own requires-recent-login rule for sensitive operations.
  const authTime = (context.auth.token as any)?.auth_time;
  if (typeof authTime === 'number' && Date.now() / 1000 - authTime > 10 * 60) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'For your security, please sign out and sign back in before deleting your account.'
    );
  }

  // Re-check rather than trusting anything the client sends: the preview it saw
  // may be stale, and blockers protect other people's data.
  const plan = await buildPlan(uid);

  if (plan.blockers.length > 0) {
    throw new functions.https.HttpsError('failed-precondition', plan.blockers[0].message);
  }

  const db = admin.firestore();

  // --- Organizations -----------------------------------------------------
  for (const action of plan.orgActions) {
    if (action.kind === 'delete') {
      const [playlists, services, templates] = await Promise.all([
        db.collection('playlists').where('organizationId', '==', action.orgId).get(),
        db.collection('services').where('orgId', '==', action.orgId).get(),
        db.collection('serviceTemplates').where('orgId', '==', action.orgId).get(),
      ]);

      await deleteDocs([
        ...playlists.docs.map(d => d.ref),
        ...services.docs.map(d => d.ref),
        ...templates.docs.map(d => d.ref),
      ]);

      await db.collection('organizations').doc(action.orgId).delete();
    } else {
      const update: Record<string, any> = {
        memberIds: admin.firestore.FieldValue.arrayRemove(uid),
        adminIds: admin.firestore.FieldValue.arrayRemove(uid),
      };
      if (action.kind === 'transfer') update.createdBy = action.newOwnerId;

      await db.collection('organizations').doc(action.orgId).update(update);
    }
  }

  // --- The user's own data ----------------------------------------------
  await deleteDocs(plan.personalPlaylistIds.map(id => db.collection('playlists').doc(id)));
  await deleteByQuery('pc_service_mappings', 'userId', uid);
  await db.collection('planning_center_connections').doc(uid).delete().catch(() => undefined);
  await db.collection('users').doc(uid).delete().catch(() => undefined);

  // Deleting the auth user triggers the Stripe extension's onUserDeleted hook,
  // which removes the customer record on Stripe's side.
  await admin.auth().deleteUser(uid);

  functions.logger.info('Account deleted', {
    uid,
    orgsDeleted: plan.orgActions.filter(a => a.kind === 'delete').length,
    orgsTransferred: plan.orgActions.filter(a => a.kind === 'transfer').length,
    orgsLeft: plan.orgActions.filter(a => a.kind === 'leave').length,
    playlistsDeleted: plan.personalPlaylistIds.length,
  });

  return { success: true };
});
