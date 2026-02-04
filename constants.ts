
export const FIREBASE_BUCKET_NAME = "psalms-and-hymns-85ee4.firebasestorage.app";

// --- Service Planning Constants ---

export const SERVICE_SECTIONS = [
  { key: 'preservice', title: 'Preparation & Gathering' },
  { key: 'revelation', title: 'Revelation: God Calls Us To Worship Him' },
  { key: 'adoration', title: 'Adoration: We Praise Our Triune God' },
  { key: 'confession', title: 'Confession: God Calls Us to Confess Our Sins' },
  { key: 'propitiation', title: 'Propitiation: God Declares Us Forgiven Through Christ' },
  { key: 'praise', title: 'We Praise God for Our Salvation' },
  { key: 'proclamation', title: 'Proclamation: God Speaks to Us Through His Word' },
  { key: 'dedication', title: 'Dedication: We Respond to God\'s Word' },
  { key: 'communion', title: 'Communion: The Lord Invites Us to His Table' },
  { key: 'supplication', title: 'Supplication: We Bring Our Requests Before the Lord' },
  { key: 'commission', title: 'Commission: God Sends Us Forth to Serve Him' }
] as const;

export const ELEMENT_TYPES = [
  { value: 'song', label: 'Song' },
  { value: 'prayer', label: 'Prayer' },
  { value: 'scripture', label: 'Scripture' },
  { value: 'sermon', label: 'Sermon' },
  { value: 'other', label: 'Other' }
] as const;
