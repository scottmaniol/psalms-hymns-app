import { ServiceTemplate, ServiceSection } from '../types';

/**
 * Generate the default liturgical service template
 */
export function createDefaultTemplate(orgId: string, userId: string): ServiceTemplate {
  const sections: ServiceSection[] = [
    { id: 'preservice', title: 'Preparation & Gathering', order: 0 },
    { id: 'revelation', title: 'Revelation: God Calls Us To Worship Him', order: 1 },
    { id: 'adoration', title: 'Adoration: We Praise Our Triune God', order: 2 },
    { id: 'confession', title: 'Confession: God Calls Us to Confess Our Sins', order: 3 },
    { id: 'propitiation', title: 'Propitiation: God Declares Us Forgiven Through Christ', order: 4 },
    { id: 'praise', title: 'We Praise God for Our Salvation', order: 5 },
    { id: 'proclamation', title: 'Proclamation: God Speaks to Us Through His Word', order: 6 },
    { id: 'dedication', title: 'Dedication: We Respond to God\'s Word', order: 7 },
    { id: 'communion', title: 'Communion: The Lord Invites Us to His Table', order: 8 },
    { id: 'supplication', title: 'Supplication: We Bring Our Requests Before the Lord', order: 9 },
    { id: 'commission', title: 'Commission: God Sends Us Forth to Serve Him', order: 10 }
  ];

  return {
    orgId,
    name: 'Gospel-Shaped Service',
    sections,
    isDefault: true,
    createdBy: userId
  };
}

/**
 * Generate a unique ID for a section
 */
export function generateSectionId(): string {
  return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new blank section
 */
export function createBlankSection(order: number): ServiceSection {
  return {
    id: generateSectionId(),
    title: 'New Section',
    order
  };
}

/**
 * Reorder sections after deletion or reordering
 */
export function reorderSections(sections: ServiceSection[]): ServiceSection[] {
  return sections
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      ...section,
      order: index
    }));
}

/**
 * Convert constants.ts SERVICE_SECTIONS to ServiceSection array
 */
export function convertConstantsToSections(constantsSections: readonly { key: string; title: string }[]): ServiceSection[] {
  return constantsSections.map((section, index) => ({
    id: section.key,
    title: section.title,
    order: index
  }));
}
