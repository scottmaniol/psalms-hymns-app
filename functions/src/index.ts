import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all Cloud Functions
export { 
  connectPlanningCenter 
} from './planningCenter/connectToken';

export {
  planningCenterWebhook
} from './planningCenter/webhook';

export {
  getAccountDeletionPreview,
  deleteAccount
} from './account/deleteAccount';
