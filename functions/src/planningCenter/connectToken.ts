import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { encryptToken } from '../utils/encryption';

/**
 * Callable function to connect Planning Center using Personal Access Token
 */
export const connectPlanningCenter = functions
  .runWith({ secrets: ['PC_ENCRYPTION_KEY'] })
  .https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { token } = data;
  
  if (!token || typeof token !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Token is required');
  }

  // Personal Access Tokens come as "appId:secret" - we need to parse them
  const tokenParts = token.includes(':') ? token.split(':') : [token, token];
  const appId = tokenParts[0];
  const secret = tokenParts[1] || tokenParts[0];

  try {
    // Verify the token by making a test API call to Planning Center
    // Personal Access Tokens use Basic Auth
    const response = await axios.get('https://api.planningcenteronline.com/services/v2/service_types', {
      auth: {
        username: appId,
        password: secret
      }
    });

    // Get organization name from the first service type
    const orgName = response.data.data[0]?.attributes?.name || 'Planning Center';

    // Store encrypted token in Firestore
    const connectionData = {
      userId: context.auth.uid,
      pcToken: encryptToken(token),
      pcOrganizationName: orgName,
      linkedOrgId: '',
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore()
      .collection('planning_center_connections')
      .doc(context.auth.uid)
      .set(connectionData);

    return { success: true, organizationName: orgName };

  } catch (error: any) {
    console.error('Error connecting Planning Center:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid token. Please check your Personal Access Token.');
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to connect to Planning Center');
  }
});
