import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search, Save, Trash2, X } from "lucide-react";
import Button from "../Button";
import { Field, Input, Select, ToggleSwitch } from "../Field";
import * as adminApi from "../../api/admin";
import {
  cloneActions,
  cloneModuleConfig,
  getModuleConfigTemplate,
  getModuleTemplateActions,
  slugifySettingsKey,
} from "../../config/settingsWorkspace";

const SECTION_TABS = [
  { key: "actions", label: "Action Buttons" },
  { key: "dropdowns", label: "Dropdowns" },
  { key: "filters", label: "Filters" },
  { key: "verification", label: "Verification" },
];

function normalizeActions(module) {
  const saved = Array.isArray(module?.actions) ? module.actions : [];
  return saved.length > 0 ? cloneActions(saved) : getModuleTemplateActions(module?.key, module?.label);
}

function makeBlankSection(label, itemType) {
  return {
    key: slugifySettingsKey(label),
    label,
    itemType,
    items: [],
  };
}

function makeBlankField(name = "New Field") {
  return {
    key: slugifySettingsKey(name),
    name,
    type: "text",
    required: false,
  };
}

function makeBlankOption(label = "New Option") {
  return {
    key: slugifySettingsKey(label),
    label,
  };
}

function CompactField({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 inline-block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function ActionCard({
  action,
  onChange,
  onRemove,
  onAddField,
  onRemoveField,
  onUpdateField,
  onToggleRequired,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <CompactField label="Action Label" required>
            <Input
              value={action.label}
              onChange={(e) => onChange(action.key, { label: e.target.value })}
              placeholder="Enter action label"
              className="!rounded-lg !py-2 !px-3 text-sm"
            />
          </CompactField>
          <p className="mt-1.5 text-[11px] text-slate-400">
            Action Key: <span className="font-medium text-slate-600">{action.key}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(action.key)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Fields</p>
          <button
            type="button"
            onClick={() => onAddField(action.key)}
            className="inline-flex items-center gap-1.5 rounded-full bg-skillit px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-skillit-dark"
          >
            <Plus className="h-3 w-3" /> Add Field
          </button>
        </div>

        <div className="mt-2.5 space-y-2">
          {(action.fields || []).length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              No custom fields added yet.
            </p>
          )}

          {(action.fields || []).map((field) => (
            <div key={field.key} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
              <div className="grid gap-2.5 md:grid-cols-[1fr,150px,auto] md:items-end">
                <CompactField label="Field Name" required>
                  <Input
                    value={field.name}
                    onChange={(e) => onUpdateField(action.key, field.key, { name: e.target.value })}
                    placeholder="Age"
                    className="!rounded-lg !py-2 !px-3 text-sm"
                  />
                </CompactField>
                <CompactField label="Field Type" required>
                  <Select
                    value={field.type || "text"}
                    onChange={(e) => onUpdateField(action.key, field.key, { type: e.target.value })}
                    className="!rounded-lg !py-2 !px-3 text-sm"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="string">Mixed</option>
                  </Select>
                </CompactField>
                <div className="flex items-center gap-2.5 pb-1">
                  <ToggleSwitch
                    checked={Boolean(field.required)}
                    onChange={() => onToggleRequired(action.key, field.key)}
                    label={`${field.name} required`}
                    className="h-5 w-9"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveField(action.key, field.key)}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionEditor({
  title,
  description,
  sections,
  itemType,
  onChange,
  emptyText,
}) {
  const safeSections = Array.isArray(sections) ? sections : [];

  const updateSection = (sectionKey, patch) => {
    onChange(safeSections.map((section) => (section.key === sectionKey ? { ...section, ...patch } : section)));
  };

  const addSection = () => {
    const label = window.prompt(`Name the new ${title.toLowerCase().slice(0, -1)}`) || "";
    const trimmed = label.trim();
    if (!trimmed) return;
    onChange([
      ...safeSections,
      makeBlankSection(trimmed, itemType),
    ]);
  };

  const removeSection = (sectionKey) => {
    onChange(safeSections.filter((section) => section.key !== sectionKey));
  };

  const addItem = (sectionKey) => {
    onChange(
      safeSections.map((section) => {
        if (section.key !== sectionKey) return section;
        const nextItem = itemType === "fields" ? makeBlankField() : makeBlankOption();
        return { ...section, items: [...(section.items || []), nextItem] };
      })
    );
  };

  const updateItem = (sectionKey, itemKey, patch) => {
    onChange(
      safeSections.map((section) => {
        if (section.key !== sectionKey) return section;
        return {
          ...section,
          items: (section.items || []).map((item) => (item.key === itemKey ? { ...item, ...patch } : item)),
        };
      })
    );
  };

  const removeItem = (sectionKey, itemKey) => {
    onChange(
      safeSections.map((section) => {
        if (section.key !== sectionKey) return section;
        return {
          ...section,
          items: (section.items || []).filter((item) => item.key !== itemKey),
        };
      })
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <Button type="button" variant="outline" onClick={addSection} className="h-9 px-3 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add {title.slice(0, -1)}
        </Button>
      </div>

      {safeSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {safeSections.map((section) => (
            <div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2.5">
                <div className="grid flex-1 gap-2.5 md:grid-cols-[1fr,150px]">
                  <CompactField label="Section Name" required>
                    <Input
                      value={section.label}
                      onChange={(e) => updateSection(section.key, { label: e.target.value })}
                      className="!rounded-lg !py-2 !px-3 text-sm"
                    />
                  </CompactField>
                  <CompactField label="Key">
                    <Input value={section.key} readOnly className="!rounded-lg !py-2 !px-3 bg-slate-100 text-sm" />
                  </CompactField>
                </div>
                <button
                  type="button"
                  onClick={() => removeSection(section.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {itemType === "fields" ? "Fields" : "Items"}
                  </p>
                  <button
                    type="button"
                    onClick={() => addItem(section.key)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-skillit px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-skillit-dark"
                  >
                    <Plus className="h-3 w-3" />
                    Add {itemType === "fields" ? "Field" : "Item"}
                  </button>
                </div>

                <div className="mt-2.5 space-y-2">
                  {(section.items || []).length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                      No items added yet.
                    </p>
                  )}

                  {(section.items || []).map((item) => (
                    <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                      {itemType === "fields" ? (
                        <div className="grid gap-2.5 md:grid-cols-[1fr,150px,auto] md:items-end">
                          <CompactField label="Field Name" required>
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(section.key, item.key, { name: e.target.value })}
                              className="!rounded-lg !py-2 !px-3 text-sm"
                            />
                          </CompactField>
                          <CompactField label="Field Type" required>
                            <Select
                              value={item.type || "text"}
                              onChange={(e) => updateItem(section.key, item.key, { type: e.target.value })}
                              className="!rounded-lg !py-2 !px-3 text-sm"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="string">Mixed</option>
                            </Select>
                          </CompactField>
                          <div className="flex items-center gap-2.5 pb-1">
                            <ToggleSwitch
                              checked={Boolean(item.required)}
                              onChange={() => updateItem(section.key, item.key, { required: !item.required })}
                              label={`${item.name} required`}
                              className="h-5 w-9"
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(section.key, item.key)}
                              className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2.5 md:grid-cols-[1fr,auto] md:items-end">
                          <CompactField label={itemType === "checks" ? "Verification Item" : "Option"} required>
                            <Input
                              value={item.label}
                              onChange={(e) => updateItem(section.key, item.key, { label: e.target.value })}
                              className="!rounded-lg !py-2 !px-3 text-sm"
                            />
                          </CompactField>
                          <button
                            type="button"
                            onClick={() => removeItem(section.key, item.key)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-100 md:mb-0"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModuleManager({ modules = [], loading = false, onRefresh }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [activeTab, setActiveTab] = useState("actions");
  const [draftActions, setDraftActions] = useState([]);
  const [draftConfig, setDraftConfig] = useState({ dropdowns: [], filters: [], verifications: [] });
  const [saving, setSaving] = useState(false);

  const visibleModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = Array.isArray(modules) ? modules : [];
    const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.label).localeCompare(String(b.label)));
    if (!q) return sorted;
    return sorted.filter((mod) => mod.label?.toLowerCase().includes(q) || mod.key?.toLowerCase().includes(q));
  }, [modules, query]);

  const selectedModule = useMemo(
    () => (Array.isArray(modules) ? modules.find((mod) => mod.id === selectedId) || visibleModules[0] || null : null),
    [modules, selectedId, visibleModules]
  );
  const sectionTabs = useMemo(() => {
    return selectedModule?.key === "student"
      ? SECTION_TABS.filter((tab) => tab.key !== "verification")
      : SECTION_TABS;
  }, [selectedModule?.key]);

  useEffect(() => {
    if (!selectedModule) return;
    if (!selectedId || !visibleModules.some((mod) => mod.id === selectedId)) {
      setSelectedId(selectedModule.id);
    }
    setDraftActions(normalizeActions(selectedModule));
    const moduleConfig = cloneModuleConfig(selectedModule.config || getModuleConfigTemplate(selectedModule.key, selectedModule.label), selectedModule.key, selectedModule.label);
    setDraftConfig({
      dropdowns: moduleConfig.dropdowns || [],
      filters: moduleConfig.filters || [],
      verifications: selectedModule.key === "student" ? [] : moduleConfig.verifications || [],
    });
    setActiveTab("actions");
  }, [selectedModule, selectedId, visibleModules]);

  const updateAction = (actionKey, patch) => {
    setDraftActions((current) =>
      current.map((action) => (action.key === actionKey ? { ...action, ...patch } : action))
    );
  };

  const addAction = () => {
    setDraftActions((current) => [
      ...current,
      { key: slugifySettingsKey(`new-action-${Date.now()}-${current.length + 1}`), label: "New Action", fields: [] },
    ]);
  };

  const removeAction = (actionKey) => {
    setDraftActions((current) => current.filter((action) => action.key !== actionKey));
  };

  const addActionField = (actionKey) => {
    setDraftActions((current) =>
      current.map((action) => (action.key === actionKey ? { ...action, fields: [...(action.fields || []), makeBlankField()] } : action))
    );
  };

  const removeActionField = (actionKey, fieldKey) => {
    setDraftActions((current) =>
      current.map((action) =>
        action.key === actionKey
          ? { ...action, fields: (action.fields || []).filter((field) => field.key !== fieldKey) }
          : action
      )
    );
  };

  const updateActionField = (actionKey, fieldKey, patch) => {
    setDraftActions((current) =>
      current.map((action) => {
        if (action.key !== actionKey) return action;
        return {
          ...action,
          fields: (action.fields || []).map((field) => (field.key === fieldKey ? { ...field, ...patch } : field)),
        };
      })
    );
  };

  const toggleActionFieldRequired = (actionKey, fieldKey) => {
    updateActionField(actionKey, fieldKey, {
      required: !draftActions.find((a) => a.key === actionKey)?.fields?.find((f) => f.key === fieldKey)?.required,
    });
  };

  const handleSave = async () => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      const config = {
        forms: draftActions.map((action) => ({
          key: action.key,
          label: action.label,
          itemType: "fields",
          items: Array.isArray(action.fields) ? action.fields : [],
        })),
        dropdowns: draftConfig.dropdowns,
        filters: draftConfig.filters,
        verifications: selectedModule.key === "student" ? [] : draftConfig.verifications,
      };
      await adminApi.updateModule(selectedModule.id, { actions: draftActions, config });
      await onRefresh?.();
      window.dispatchEvent(new Event("module-config-updated"));
    } finally {
      setSaving(false);
    }
  };

  const sectionBody = () => {
    if (!selectedModule) {
      return (
        <div className="grid min-h-[320px] place-items-center text-sm text-slate-400">
          Select a module to manage its configuration.
        </div>
      );
    }

    if (activeTab === "actions") {
      return (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-skillit">Module Configuration</p>
              <h2 className="mt-1 text-xl font-display font-bold text-slate-800">{selectedModule.label}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Key: <span className="font-medium text-slate-700">{selectedModule.key}</span>
              </p>
            </div>
            <Button type="button" onClick={handleSave} loading={saving} className="h-10 px-4 text-sm">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Action Buttons</h3>
              <p className="text-xs text-slate-500">Add, edit, or remove buttons and their fields.</p>
            </div>
            <Button type="button" variant="outline" onClick={addAction} className="h-9 px-3 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Action
            </Button>
          </div>

          {draftActions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              No actions are configured for this module yet.
            </div>
          ) : (
            <div className="space-y-3">
              {draftActions.map((action) => (
                <ActionCard
                  key={action.key}
                  action={action}
                  onChange={updateAction}
                  onRemove={removeAction}
                  onAddField={addActionField}
                  onRemoveField={removeActionField}
                  onUpdateField={updateActionField}
                  onToggleRequired={toggleActionFieldRequired}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "dropdowns") {
      return (
        <CollectionEditor
          title="Dropdowns"
          description="Manage dropdown labels and options."
          sections={draftConfig.dropdowns}
          itemType="options"
          onChange={(next) => setDraftConfig((current) => ({ ...current, dropdowns: next }))}
          emptyText="No dropdowns have been configured yet."
        />
      );
    }

    if (selectedModule.key === "student" && activeTab === "verification") {
      return null;
    }

    if (activeTab === "filters") {
      return (
        <CollectionEditor
          title="Filters"
          description="Manage filter groups and values."
          sections={draftConfig.filters}
          itemType="options"
          onChange={(next) => setDraftConfig((current) => ({ ...current, filters: next }))}
          emptyText="No filters have been configured yet."
        />
      );
    }

    return (
      <CollectionEditor
        title="Verification"
        description="Manage verification blocks and check items."
        sections={draftConfig.verifications}
        itemType="checks"
        onChange={(next) => setDraftConfig((current) => ({ ...current, verifications: next }))}
        emptyText="No verification sections have been configured yet."
      />
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
      <aside className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-card">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules"
            className="pl-9 !rounded-xl !py-2.5 text-sm"
          />
        </div>

        <div className="mt-3 max-h-[calc(100vh-240px)] space-y-1.5 overflow-y-auto pr-1">
          {loading && <p className="px-2 py-2 text-xs text-slate-400">Loading modules...</p>}
          {!loading && visibleModules.length === 0 && (
            <p className="px-2 py-2 text-xs text-slate-400">No modules found.</p>
          )}
          {visibleModules.map((module) => {
            const active = module.id === selectedModule?.id;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => setSelectedId(module.id)}
                className={[
                  "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all",
                  active ? "bg-skillit text-white shadow-pop" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-tight">{module.label}</span>
                  <span className={`block truncate text-[11px] ${active ? "text-white/70" : "text-slate-400"}`}>{module.key}</span>
                </span>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
        {!selectedModule ? (
          <div className="grid min-h-[320px] place-items-center text-xs text-slate-400">
            Select a module to manage its configuration.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    activeTab === tab.key ? "bg-skillit text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {sectionBody()}
          </>
        )}
      </section>
    </div>
  );
}
