import React, { useState, useEffect } from 'react';
import { X, Plus, Edit3, Trash2, GripVertical, Save, Copy } from 'lucide-react';
import { ServiceTemplate, ServiceSection } from '../types';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { createDefaultTemplate, createBlankSection, reorderSections, generateSectionId } from '../utils/templateUtils';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  user: User;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  isOpen,
  onClose,
  orgId,
  user
}) => {
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch templates for organization
  useEffect(() => {
    if (!orgId) return;

    const q = query(
      collection(db, 'serviceTemplates'),
      where('orgId', '==', orgId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const templatesList: ServiceTemplate[] = [];
      snapshot.forEach(doc => {
        templatesList.push({ id: doc.id, ...doc.data() } as ServiceTemplate);
      });
      
      // Always update templates state first
      setTemplates(templatesList.sort((a, b) => a.isDefault ? -1 : b.isDefault ? 1 : 0));
      
      // Auto-create "Gospel-Shaped Service" template if no default exists
      const hasDefault = templatesList.some(t => t.isDefault);
      if (!hasDefault && user) {
        try {
          const defaultTemplate = createDefaultTemplate(orgId, user.uid);
          await addDoc(collection(db, 'serviceTemplates'), {
            ...defaultTemplate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          // The snapshot listener will automatically re-fire and update with the new template
        } catch (err) {
          console.error('Error creating default template:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [orgId, user]);

  const handleCreateTemplate = async () => {
    setIsCreating(true);
    try {
      const newTemplate = createDefaultTemplate(orgId, user.uid);
      newTemplate.name = 'New Template';
      newTemplate.isDefault = false;
      
      const docRef = await addDoc(collection(db, 'serviceTemplates'), {
        ...newTemplate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setEditingTemplate({ ...newTemplate, id: docRef.id });
    } catch (err) {
      console.error('Error creating template:', err);
      alert('Failed to create template');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveTemplate = async (template: ServiceTemplate) => {
    if (!template.id) return;

    try {
      const templateRef = doc(db, 'serviceTemplates', template.id);
      await updateDoc(templateRef, {
        name: template.name,
        sections: template.sections,
        isDefault: template.isDefault,
        updatedAt: serverTimestamp()
      });
      setEditingTemplate(null);
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteDoc(doc(db, 'serviceTemplates', templateId));
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template');
    }
  };

  const handleSetDefault = async (template: ServiceTemplate) => {
    if (!template.id) return;

    try {
      // Unset other defaults
      for (const t of templates) {
        if (t.id && t.isDefault && t.id !== template.id) {
          await updateDoc(doc(db, 'serviceTemplates', t.id), { isDefault: false });
        }
      }

      // Set new default
      await updateDoc(doc(db, 'serviceTemplates', template.id), { 
        isDefault: true,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error setting default template:', err);
      alert('Failed to set default template');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Service Templates</h2>
              <p className="text-sm text-slate-500 mt-1">Customize sections for your services</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {editingTemplate ? (
            <TemplateEditor
              template={editingTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => setEditingTemplate(null)}
              onChange={setEditingTemplate}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Your Templates</h3>
                <button
                  onClick={handleCreateTemplate}
                  disabled={isCreating}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={18} />
                  {isCreating ? 'Creating...' : 'New Template'}
                </button>
              </div>

              {templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <p>No templates yet. Create one to get started!</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {templates.map(template => (
                    <div
                      key={template.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800">{template.name}</h4>
                            {template.isDefault && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">
                            {template.sections.length} sections
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!template.isDefault && (
                            <button
                              onClick={() => handleSetDefault(template)}
                              className="text-xs px-3 py-1 border border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            >
                              Set as Default
                            </button>
                          )}
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Edit template"
                          >
                            <Edit3 size={16} />
                          </button>
                          {!template.isDefault && (
                            <button
                              onClick={() => handleDeleteTemplate(template.id!)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Delete template"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Template Editor Component
interface TemplateEditorProps {
  template: ServiceTemplate;
  onSave: (template: ServiceTemplate) => void;
  onCancel: () => void;
  onChange: (template: ServiceTemplate) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  onChange
}) => {
  const [draggedSection, setDraggedSection] = useState<ServiceSection | null>(null);

  const updateTemplateName = (name: string) => {
    onChange({ ...template, name });
  };

  const addSection = () => {
    const newSection = createBlankSection(template.sections.length);
    onChange({ ...template, sections: [...template.sections, newSection] });
  };

  const updateSection = (sectionId: string, title: string) => {
    const updatedSections = template.sections.map(s =>
      s.id === sectionId ? { ...s, title } : s
    );
    onChange({ ...template, sections: updatedSections });
  };

  const deleteSection = (sectionId: string) => {
    const filtered = template.sections.filter(s => s.id !== sectionId);
    const reordered = reorderSections(filtered);
    onChange({ ...template, sections: reordered });
  };

  const handleDragStart = (section: ServiceSection) => {
    setDraggedSection(section);
  };

  const handleDrop = (targetSection: ServiceSection) => {
    if (!draggedSection || draggedSection.id === targetSection.id) {
      setDraggedSection(null);
      return;
    }

    const sections = [...template.sections];
    const draggedIndex = sections.findIndex(s => s.id === draggedSection.id);
    const targetIndex = sections.findIndex(s => s.id === targetSection.id);

    const [removed] = sections.splice(draggedIndex, 1);
    sections.splice(targetIndex, 0, removed);

    const reordered = reorderSections(sections);
    onChange({ ...template, sections: reordered });
    setDraggedSection(null);
  };

  return (
    <div className="space-y-6">
      {/* Template Name */}
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Template Name</label>
        <input
          type="text"
          value={template.name}
          onChange={(e) => updateTemplateName(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="e.g., Contemporary Service, Traditional Liturgy"
        />
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-bold text-slate-700">Sections</label>
          <button
            onClick={addSection}
            className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded transition-colors"
          >
            <Plus size={14} />
            Add Section
          </button>
        </div>

        <div className="space-y-2">
          {template.sections.map((section) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(section)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(section)}
              className={`flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg ${
                draggedSection?.id === section.id ? 'opacity-50' : ''
              }`}
            >
              <div className="text-slate-400 cursor-grab active:cursor-grabbing">
                <GripVertical size={18} />
              </div>
              <input
                type="text"
                value={section.title}
                onChange={(e) => updateSection(section.id, e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                onClick={() => deleteSection(section.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Delete section"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(template)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          <Save size={18} />
          Save Template
        </button>
      </div>
    </div>
  );
};

export default TemplateManager;
