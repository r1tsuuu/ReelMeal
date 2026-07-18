'use client';

import { useState } from 'react';
import { Collection } from '@/types/recipe';

interface CollectionsModalProps {
  collections: Collection[];
  initialSelected: string[];
  onCreateCollection: (name: string) => string;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export default function CollectionsModal({ collections, initialSelected, onCreateCollection, onConfirm, onCancel }: CollectionsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [newName, setNewName] = useState('');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = onCreateCollection(name);
    setSelected((prev) => new Set(prev).add(id));
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-charcoal/40">
      <div className="max-h-[70%] w-full overflow-y-auto rounded-t-3xl bg-cream p-5">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-charcoal/15" />
        <h2 className="mb-3 text-lg font-bold text-charcoal">Save to collections</h2>

        <div className="flex flex-col">
          {collections.map((c) => (
            <label key={c.id} className="flex items-center gap-3 py-2">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-[18px] w-[18px] accent-sage" />
              <span className="text-sm text-charcoal">{c.name}</span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection name…"
            className="flex-1 rounded-full border border-charcoal/20 bg-white px-3 py-2 text-sm"
          />
          <button type="button" onClick={handleAdd} className="rounded-full border border-charcoal/20 px-4 text-sm font-semibold text-charcoal">
            Add
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-charcoal/20 py-3 text-sm font-semibold text-charcoal">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            className="flex-1 rounded-full bg-terracotta py-3 text-sm font-semibold text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
