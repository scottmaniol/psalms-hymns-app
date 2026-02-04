export interface PlanningCenterConnection {
  userId: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  tokenExpiry: Date;
  pcOrganizationId: string;
  pcOrganizationName: string;
  linkedOrgId: string; // app organization ID
  active: boolean;
  createdAt: Date;
  lastSync: Date;
}

export interface PCServiceMapping {
  pcServiceId: string;
  pcServiceName: string;
  playlistId: string;
  organizationId: string;
  userId: string;
  lastUpdated: Date;
  songCount: number;
}

export interface Song {
  id: string;
  number: string;
  title: string;
  tune: string | null;
  category: string;
  author: string;
  composer: string;
  meter: string;
  key?: string;
  lyrics: string;
}

export interface SerializedPlaylistItem {
  songNumber: string;
  label: string;
  url: string;
}

export interface PCWebhookPayload {
  event: {
    name: string; // e.g., "services.v2.events.plan.created"
    data: {
      id: string;
      type: string;
      attributes: any;
      relationships?: any;
    };
  };
}

export interface PCSong {
  id: string;
  type: string;
  attributes: {
    title: string;
    item_type?: string;
    arrangement?: {
      name: string;
    };
  };
}
