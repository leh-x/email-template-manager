// src/components/TemplateList/TemplateList.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { core } from '@tauri-apps/api';
import TemplateCard from '../TemplateCard/TemplateCard';
import styles from './TemplateList.module.css';

export type TemplateFile = {
  name: string;
  content: string;
  last_modified: string;
};

function normalizeFavourites(input: unknown): Set<string> {
  // Accept string[] or legacy map<string, boolean>
  const set = new Set<string>();
  if (Array.isArray(input)) {
    input.forEach((s) => typeof s === 'string' && set.add(s));
  } else if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v) set.add(k);
    }
  }
  return set;
}

interface TemplateListProps {
  selectedName: string | null;
  onSelectTemplate: (tpl: TemplateFile) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ selectedName, onSelectTemplate }) => {
  const [templates, setTemplates] = useState<TemplateFile[]>([]);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load templates + favourites on mount
  useEffect(() => {
    core.invoke<TemplateFile[]>('load_templates')
      .then(setTemplates)
      .catch((err) => {
        console.error(err);
        setError('Failed to load templates');
      });

    core.invoke<unknown>('load_favourites')
      .then((data) => setFavourites(normalizeFavourites(data)))
      .catch((err) => {
        console.error(err);
        setError((prev) => prev ?? 'Failed to load favourites');
      });
  }, []);

  const toggleFavourite = useCallback(async (filename: string) => {
    const next = new Set(favourites);
    if (next.has(filename)) next.delete(filename);
    else next.add(filename);
    setFavourites(next);

    // Save ONLY an array => resolves the TODO
    try {
      await core.invoke('save_favourites', { favourites: Array.from(next) });
    } catch (err) {
      console.error('Failed to save favourites', err);
    }
  }, [favourites]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? templates.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q)
        )
      : templates.slice();

    list.sort((a, b) => {
      const af = favourites.has(a.name) ? 0 : 1;
      const bf = favourites.has(b.name) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [templates, favourites, search]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.heading}>Templates</h4>
        <input
          type="search"
          placeholder="Search templates…"
          className={styles.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.list}>
        {filteredSorted.map((t) => (
          <TemplateCard
            key={t.name}
            name={t.name}
            content={t.content}
            last_modified={t.last_modified}
            isFavourite={favourites.has(t.name)}
            selected={selectedName === t.name}
            onSelect={() => onSelectTemplate(t)}
            onToggleFavourite={toggleFavourite}
          />
        ))}
      </div>
    </div>
  );
};

export default TemplateList;