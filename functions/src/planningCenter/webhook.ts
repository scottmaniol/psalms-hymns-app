import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { decryptToken } from '../utils/encryption';
import { matchSongToHymnal } from '../utils/songMatcher';
import { PCSong, SerializedPlaylistItem, Song } from '../types';

/**
 * Get hymnal data from Firestore (cached)
 */
async function getHymnalData(): Promise<Song[]> {
  const db = admin.firestore();
  
  // Try to get from cache collection
  const cacheDoc = await db.collection('_cache').doc('hymnal_data').get();
  
  if (cacheDoc.exists && cacheDoc.data()?.songs) {
    return cacheDoc.data()!.songs;
  }
  
  // If not cached, fetch song_metadata
  const metadataSnapshot = await db.collection('song_metadata').get();
  const songs: Song[] = [];
  
  metadataSnapshot.forEach(doc => {
    const data = doc.data();
    songs.push({
      id: doc.id,
      number: doc.id,
      title: data.title || '',
      tune: data.tune || null,
      category: data.category || '',
      author: data.author || '',
      composer: data.composer || '',
      meter: data.meter || '',
      key: data.key || '',
      lyrics: data.lyrics || ''
    });
  });
  
  // Cache for 1 hour
  await db.collection('_cache').doc('hymnal_data').set({
    songs,
    updated: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return songs;
}

/**
 * Fetch service items (songs) from Planning Center
 */
async function fetchServiceItems(planData: any, accessToken: string): Promise<PCSong[]> {
  // Parse token for Basic Auth (appId:secret format)
  const tokenParts = accessToken.includes(':') ? accessToken.split(':') : [accessToken, accessToken];
  const appId = tokenParts[0];
  const secret = tokenParts[1] || tokenParts[0];

  // Use the items link from the plan data if available
  const itemsUrl = planData.links?.items || planData.relationships?.items?.links?.related;
  
  if (!itemsUrl) {
    console.error('No items URL found in plan data');
    throw new Error('Cannot fetch items - no URL provided');
  }

  console.log('Fetching items from:', itemsUrl);

  const response = await axios.get(itemsUrl, {
    auth: {
      username: appId,
      password: secret
    }
  });
  
  // Filter to only song items
  return response.data.data.filter((item: any) => 
    item.type === 'Item' && item.attributes.item_type === 'song'
  );
}

/**
 * Webhook handler for Planning Center events
 */
export const planningCenterWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));
    
    // Verify it's a POST request
    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method);
      res.status(405).send('Method not allowed');
      return;
    }
    
    // Planning Center wraps events in a data array
    const webhookData = req.body.data;
    if (!Array.isArray(webhookData) || webhookData.length === 0) {
      console.log('Invalid webhook structure');
      res.status(400).send('Invalid webhook payload');
      return;
    }
    
    const eventDelivery = webhookData[0];
    const eventName = eventDelivery.attributes?.name;
    
    if (!eventName) {
      console.log('No event name found in payload');
      res.status(400).send('Invalid webhook payload');
      return;
    }
    
    // Parse the actual payload (it's a JSON string in the attributes)
    const payload: any = JSON.parse(eventDelivery.attributes.payload);
    
    console.log('Received Planning Center webhook:', eventName);
    // Log item type for debugging
    console.log('Item type:', payload.data.attributes.item_type);
    
    // Handle different event types
    switch (eventName) {
      case 'services.v2.events.plan.created':
        await handlePlanCreated(payload);
        break;
        
      case 'services.v2.events.plan_item.created':
        await handleItemCreated(payload);
        break;
        
      case 'services.v2.events.plan_item.destroyed':
        await handleItemDestroyed(payload);
        break;
        
      case 'services.v2.events.plan_item.updated':
        await handleItemUpdated(payload);
        break;
        
      default:
        console.log('Unhandled event type:', eventName);
    }
    
    res.status(200).send('Webhook processed');
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

/**
 * Handle plan.created event - create new playlist
 */
async function handlePlanCreated(payload: any) {
  const db = admin.firestore();
  const planId = payload.data.id;
  const planAttributes = payload.data.attributes;
  
  console.log('Handling plan created:', planId);
  
  // Find all active PC connections
  const connections = await db.collection('planning_center_connections')
    .where('active', '==', true)
    .get();
  
  console.log(`Found ${connections.size} active PC connections`);
  
  // Process each connection
  for (const connectionDoc of connections.docs) {
    const connection = connectionDoc.data();
    
    console.log(`Processing connection ${connectionDoc.id}, linkedOrgId: ${connection.linkedOrgId}`);
    
    if (!connection.linkedOrgId) {
      console.log(`Skipping connection ${connectionDoc.id} - no linked org`);
      continue;
    }
    
    try {
      // Get access token (Personal Access Token doesn't expire)
      const accessToken = decryptToken(connection.pcToken);
      console.log(`Decrypted token for user ${connection.userId}`);
      
      // Fetch service items
      const serviceItems = await fetchServiceItems(payload.data, accessToken);
      
      // Get hymnal data
      const hymnalData = await getHymnalData();
      
      // Match songs
      const playlistItems: SerializedPlaylistItem[] = [];
      
      for (const pcSong of serviceItems) {
        const matchedSong = matchSongToHymnal(pcSong, hymnalData);
        
        if (matchedSong) {
          // Construct URLs (adjust based on your app's structure)
          const accompanimentUrl = `https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2Faudio%2F${matchedSong.number}.mp3?alt=media`;
          
          playlistItems.push({
            songNumber: matchedSong.number,
            label: 'Piano',
            url: accompanimentUrl
          });
        }
      }
      
      if (playlistItems.length === 0) {
        console.log('No matching songs found for service');
        continue;
      }
      
      // Create playlist
      const playlistData = {
        userId: connection.userId,
        name: planAttributes.dates || `Service ${planId.substring(0, 8)}`,
        items: playlistItems,
        organizationId: connection.linkedOrgId,
        isPlanningCenterSync: true,
        pcServiceId: planId,
        autoSync: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        order: 9999
      };
      
      const playlistRef = await db.collection('playlists').add(playlistData);
      
      // Create service mapping
      await db.collection('pc_service_mappings').add({
        pcServiceId: planId,
        pcServiceName: planAttributes.dates || 'Untitled Service',
        playlistId: playlistRef.id,
        organizationId: connection.linkedOrgId,
        userId: connection.userId,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        songCount: playlistItems.length
      });
      
      console.log(`Created playlist ${playlistRef.id} for service ${planId}`);
      
    } catch (error) {
      console.error(`Error processing connection ${connectionDoc.id}:`, error);
    }
  }
}

/**
 * Handle item.created event - add song to existing playlist
 */
async function handleItemCreated(payload: any) {
  const db = admin.firestore();
  const itemData = payload.data;
  
  // CRITICAL FIX: Check if this is a song item FIRST before doing any processing
  if (itemData.type !== 'Item' || itemData.attributes?.item_type !== 'song') {
    console.log('Skipping non-song item created:', itemData.attributes?.item_type);
    return;
  }
  
  // Extract service ID from relationships
  const planId = itemData.relationships?.plan?.data?.id;
  
  if (!planId) {
    console.log('No plan ID found in item.created event');
    return;
  }
  
  console.log('Handling song item created for plan:', planId);
  
  // Find the playlist mapping for this service
  const mappings = await db.collection('pc_service_mappings')
    .where('pcServiceId', '==', planId)
    .get();
  
  if (mappings.empty) {
    console.log('No playlist mapping found for service:', planId);
    console.log('Creating new playlist for existing service...');
    
    // Service was created before webhook was set up - need to fetch full plan data first
    // Get the service_type_id and plan_id from the item's self link
    const selfLink = itemData.links?.self;
    if (!selfLink) {
      console.log('No self link found in item data, cannot create playlist');
      return;
    }

    const match = selfLink.match(/service_types\/(\d+)\/plans\/(\d+)/);
    if (!match || match.length < 3) {
      console.log('Could not parse service_type_id and plan_id from self link');
      return;
    }

    const serviceTypeId = match[1];
    const fullPlanId = match[2];

    const planUrl = `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/plans/${fullPlanId}`;
    
    // Get connection to fetch plan data
    const connections = await db.collection('planning_center_connections')
      .where('active', '==', true)
      .get();
    
    if (connections.empty) {
      console.log('No active connections found');
      return;
    }
    
    const connection = connections.docs[0].data();
    const accessToken = decryptToken(connection.pcToken);
    
    // Parse token for Basic Auth
    const tokenParts = accessToken.includes(':') ? accessToken.split(':') : [accessToken, accessToken];
    const appId = tokenParts[0];
    const secret = tokenParts[1] || tokenParts[0];
    
    // Fetch the full plan data
    const planResponse = await axios.get(planUrl, {
      auth: {
        username: appId,
        password: secret
      }
    });
    
    // Now create playlist with full plan data
    await handlePlanCreated({ data: planResponse.data.data });
    
    // The playlist now exists with all current songs - no need to add this specific item
    console.log('Playlist created with all existing songs');
    return;
  }
  
  for (const mappingDoc of mappings.docs) {
    const mapping = mappingDoc.data();
    const playlistRef = db.collection('playlists').doc(mapping.playlistId);
    const playlistDoc = await playlistRef.get();
    
    if (!playlistDoc.exists || !playlistDoc.data()?.autoSync) {
      continue;
    }
    
    try {
      // CRITICAL FIX: Get connection for access token by querying userId field
      const connectionSnapshot = await db.collection('planning_center_connections')
        .where('userId', '==', mapping.userId)
        .where('active', '==', true)
        .limit(1)
        .get();
      
      if (connectionSnapshot.empty) {
        console.log('No active connection found for user:', mapping.userId);
        continue;
      }
      
      const connectionDoc = connectionSnapshot.docs[0];
      
      const connection = connectionDoc.data();
      const accessToken = decryptToken(connection.pcToken);
      
      // Parse token for Basic Auth
      const tokenParts = accessToken.includes(':') ? accessToken.split(':') : [accessToken, accessToken];
      const appId = tokenParts[0];
      const secret = tokenParts[1] || tokenParts[0];
      
      // Use self link from item data
      const itemUrl = itemData.links?.self;
      if (!itemUrl) {
        console.log('No self link found for item');
        continue;
      }
      
      // Fetch the specific item
      const itemResponse = await axios.get(itemUrl, {
        auth: {
          username: appId,
          password: secret
        }
      });
      
      const pcSong: PCSong = itemResponse.data.data;
      
      // Double-check it's a song (should be caught earlier, but being defensive)
      if (pcSong.type !== 'Item' || pcSong.attributes.item_type !== 'song') {
        console.log('Item is not a song, skipping');
        continue;
      }
      
      // Match to hymnal
      const hymnalData = await getHymnalData();
      const matchedSong = matchSongToHymnal(pcSong, hymnalData);
      
      if (!matchedSong) {
        console.log('No match found for added song');
        continue;
      }
      
      // Add to playlist
      const accompanimentUrl = `https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2Faudio%2F${matchedSong.number}.mp3?alt=media`;
      
      const newItem: SerializedPlaylistItem = {
        songNumber: matchedSong.number,
        label: 'Piano',
        url: accompanimentUrl
      };
      
      await playlistRef.update({
        items: admin.firestore.FieldValue.arrayUnion(newItem)
      });
      
      // Update mapping
      await mappingDoc.ref.update({
        songCount: (mapping.songCount || 0) + 1,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Added song ${matchedSong.number} to playlist ${mapping.playlistId}`);
      
    } catch (error) {
      console.error('Error adding item to playlist:', error);
    }
  }
}

/**
 * Handle item.destroyed event - remove song from playlist
 */
async function handleItemDestroyed(payload: any) {
  const db = admin.firestore();
  const itemData = payload.data;
  
  // CRITICAL FIX: Check if this is a song item FIRST before doing any processing
  if (itemData.type !== 'Item' || itemData.attributes?.item_type !== 'song') {
    console.log('Skipping non-song item destroyed:', itemData.attributes?.item_type);
    return;
  }
  
  const planId = itemData.relationships?.plan?.data?.id;
  
  if (!planId) {
    console.log('No plan ID found in item.destroyed event');
    return;
  }
  
  console.log('Handling song item destroyed for plan:', planId);
  
  // Find the playlist mapping
  const mappings = await db.collection('pc_service_mappings')
    .where('pcServiceId', '==', planId)
    .get();
  
  if (mappings.empty) {
    console.log('No playlist mapping found for service:', planId);
    return;
  }
  
  for (const mappingDoc of mappings.docs) {
    const mapping = mappingDoc.data();
    const playlistRef = db.collection('playlists').doc(mapping.playlistId);
    const playlistDoc = await playlistRef.get();
    
    if (!playlistDoc.exists || !playlistDoc.data()?.autoSync) {
      console.log('Playlist does not exist or autoSync is disabled:', mapping.playlistId);
      continue;
    }
    
    // For deletion, we need to rebuild the entire playlist by re-fetching from PC
    // This is because the webhook doesn't tell us which exact hymn was deleted
    try {
      // CRITICAL FIX: Get connection for access token by querying userId field
      const connectionSnapshot = await db.collection('planning_center_connections')
        .where('userId', '==', mapping.userId)
        .where('active', '==', true)
        .limit(1)
        .get();
      
      if (connectionSnapshot.empty) {
        console.log('No active connection found for user:', mapping.userId);
        continue;
      }
      
      const connectionDoc = connectionSnapshot.docs[0];
      const connection = connectionDoc.data();
      const accessToken = decryptToken(connection.pcToken);
      
      // Parse token for Basic Auth
      const tokenParts = accessToken.includes(':') ? accessToken.split(':') : [accessToken, accessToken];
      const appId = tokenParts[0];
      const secret = tokenParts[1] || tokenParts[0];
      
      // Construct the plan URL directly from the item's self link
      // The destroyed item's self link looks like: /services/v2/service_types/{serviceTypeId}/plans/{planId}/items/{itemId}
      const selfLink = itemData.links?.self;
      if (!selfLink) {
        console.error('No self link found in destroyed item data, cannot rebuild playlist');
        continue;
      }
      
      // Extract service_type_id and plan_id from the self link
      const match = selfLink.match(/service_types\/(\d+)\/plans\/(\d+)/);
      if (!match || match.length < 3) {
        console.error('Could not parse service_type_id and plan_id from self link:', selfLink);
        continue;
      }
      
      const serviceTypeId = match[1];
      const fullPlanId = match[2];
      
      // Construct the plan URL
      const planUrl = `https://api.planningcenteronline.com/services/v2/service_types/${serviceTypeId}/plans/${fullPlanId}`;
      console.log('Fetching plan from:', planUrl);
      
      const planResponse = await axios.get(planUrl, {
        auth: {
          username: appId,
          password: secret
        }
      });
      
      // Re-fetch all service items using the plan data
      const serviceItems = await fetchServiceItems(planResponse.data.data, accessToken);
      console.log(`Found ${serviceItems.length} remaining songs in service after deletion`);
      
      const hymnalData = await getHymnalData();
      
      // Rebuild playlist
      const playlistItems: SerializedPlaylistItem[] = [];
      
      for (const pcSong of serviceItems) {
        const matchedSong = matchSongToHymnal(pcSong, hymnalData);
        
        if (matchedSong) {
          const accompanimentUrl = `https://firebasestorage.googleapis.com/v0/b/psalms-and-hymns-85ee4.firebasestorage.app/o/data%2Faudio%2F${matchedSong.number}.mp3?alt=media`;
          
          playlistItems.push({
            songNumber: matchedSong.number,
            label: 'Piano',
            url: accompanimentUrl
          });
        }
      }
      
      console.log(`Rebuilding playlist with ${playlistItems.length} matched songs`);
      
      // Update playlist
      await playlistRef.update({
        items: playlistItems
      });
      
      // Update mapping
      await mappingDoc.ref.update({
        songCount: playlistItems.length,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Successfully rebuilt playlist ${mapping.playlistId} after deletion. New song count: ${playlistItems.length}`);
      
    } catch (error) {
      console.error('Error handling item deletion for playlist', mapping.playlistId, ':', error);
      if (axios.isAxiosError(error)) {
        console.error('API Error Response:', error.response?.data);
      }
    }
  }
}

/**
 * Handle item.updated event
 */
async function handleItemUpdated(payload: any) {
  // For now, treat updates like deletion and rebuild
  // In the future, could be more sophisticated
  await handleItemDestroyed(payload);
}
