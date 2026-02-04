import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { encryptToken } from '../utils/encryption';

const PC_CLIENT_ID = process.env.PC_CLIENT_ID;
const PC_CLIENT_SECRET = process.env.PC_CLIENT_SECRET;
const PC_REDIRECT_URI = process.env.PC_REDIRECT_URI;

/**
 * OAuth callback handler for Planning Center
 * Receives authorization code and exchanges it for access tokens
 */
export const planningCenterOAuthCallback = functions.https.onRequest(async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || typeof code !== 'string') {
      res.status(400).send('Missing authorization code');
      return;
    }
    
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://api.planningcenteronline.com/oauth/token', {
      grant_type: 'authorization_code',
      code,
      client_id: PC_CLIENT_ID,
      client_secret: PC_CLIENT_SECRET,
      redirect_uri: PC_REDIRECT_URI
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Get user info from Planning Center
    const userResponse = await axios.get('https://api.planningcenteronline.com/people/v2/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    const pcUserId = userResponse.data.data.id;
    
    // Get organization info
    const orgResponse = await axios.get('https://api.planningcenteronline.com/services/v2/service_types', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    const pcOrgName = orgResponse.data.data[0]?.attributes?.name || 'Unknown Organization';
    
    // Decrypt state to get user ID (passed from frontend)
    const userId = state as string;
    
    if (!userId) {
      res.status(400).send('Missing user ID in state');
      return;
    }
    
    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + (expires_in * 1000));
    
    // Store encrypted tokens in Firestore
    const connectionData = {
      userId,
      accessToken: encryptToken(access_token),
      refreshToken: encryptToken(refresh_token),
      tokenExpiry: admin.firestore.Timestamp.fromDate(tokenExpiry),
      pcOrganizationId: pcUserId,
      pcOrganizationName: pcOrgName,
      linkedOrgId: '', // Will be set by user in UI
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSync: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Store in Firestore
    await admin.firestore()
      .collection('planning_center_connections')
      .doc(userId)
      .set(connectionData, { merge: true });
    
    // Redirect to success page
    res.redirect('/?pc_connected=true');
    
  } catch (error: any) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

/**
 * Refresh Planning Center access token
 */
export async function refreshPCToken(userId: string): Promise<string> {
  const db = admin.firestore();
  const connectionDoc = await db.collection('planning_center_connections').doc(userId).get();
  
  if (!connectionDoc.exists) {
    throw new Error('No Planning Center connection found');
  }
  
  const connection = connectionDoc.data()!;
  const { decryptToken } = await import('../utils/encryption');
  const refreshToken = decryptToken(connection.refreshToken);
  
  // Request new access token
  const tokenResponse = await axios.post('https://api.planningcenteronline.com/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: PC_CLIENT_ID,
    client_secret: PC_CLIENT_SECRET
  });
  
  const { access_token, expires_in, refresh_token: new_refresh_token } = tokenResponse.data;
  const tokenExpiry = new Date(Date.now() + (expires_in * 1000));
  
  // Update stored tokens
  await connectionDoc.ref.update({
    accessToken: encryptToken(access_token),
    refreshToken: encryptToken(new_refresh_token || refreshToken),
    tokenExpiry: admin.firestore.Timestamp.fromDate(tokenExpiry)
  });
  
  return access_token;
}

/**
 * Scheduled function to refresh expiring tokens
 */
export const refreshExpiringTokens = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const db = admin.firestore();
  const oneHourFromNow = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600000));
  
  // Find connections with tokens expiring in the next hour
  const expiringConnections = await db.collection('planning_center_connections')
    .where('active', '==', true)
    .where('tokenExpiry', '<=', oneHourFromNow)
    .get();
  
  const refreshPromises = expiringConnections.docs.map(doc => 
    refreshPCToken(doc.id).catch(err => {
      console.error(`Failed to refresh token for user ${doc.id}:`, err);
    })
  );
  
  await Promise.all(refreshPromises);
  
  console.log(`Refreshed ${refreshPromises.length} Planning Center tokens`);
});
