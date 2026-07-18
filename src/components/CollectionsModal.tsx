'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Plus } from 'lucide-react';
import { Collection } from '@/types/recipe';
import { useDeviceFrame } from '@/components/DeviceFrame';

interface CollectionsModalProps {
  collections: Collection[];
  initialSelected: string[];
  onCreateCollection: (name: string) => string;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

export function CollectionsModal({
  collections,
  initialSelected,
  onCreateCollection,
  onConfirm,
  onCancel,
}: CollectionsModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [newName, setNewName] = useState('');
  const framed = useDeviceFrame();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const id = onCreateCollection(name);
    setSelected((prev) => new Set(prev).add(id));
    setNewName('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className={`${framed ? 'absolute' : 'fixed'} inset-0 z-50 flex items-end justify-center bg-charcoal/40 backdrop-blur-sm sm:items-center sm:p-4`}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream p-5 sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-charcoal/15 sm:hidden" />
        <h2 className="mb-4 text-charcoal" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          Save to collections
        </h2>

        <div className="flex flex-col gap-1">
          {collections.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/60"
              >
                <span
                  className={`flex size-5 flex-none items-center justify-center rounded-md border transition-colors ${
                    on ? 'border-sage bg-sage text-white' : 'border-charcoal/25 bg-white'
                  }`}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="text-charcoal">{c.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="New collection name…"
            className="flex-1 rounded-full border border-charcoal/15 bg-white px-4 py-2.5 text-charcoal outline-none transition-shadow focus:ring-2 focus:ring-sage/40"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 rounded-full bg-sage px-4 text-white transition-colors hover:bg-sage-deep"
            style={{ fontWeight: 600 }}
          >
            <Plus className="size-4" /> Add
          </button>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-charcoal/15 bg-white py-3 text-charcoal transition-colors hover:bg-cream-deep"
            style={{ fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            className="flex-1 rounded-full bg-terracotta py-3 text-white transition-colors hover:bg-terracotta-dark"
            style={{ fontWeight: 600 }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
