// src/components/TemplateCard/TemplateCard.tsx
import React from 'react';
import styles from './TemplateCard.module.css';
import { StarIcon20, StarOutline20 } from '../../ui/icons';
import { COLOURS } from '../../ui/theme/theme';

export interface TemplateCardProps {
  name: string;
  content: string;
  last_modified: string;
  isFavourite: boolean;
  selected?: boolean;
  onSelect: (name: string) => void;
  onToggleFavourite: (name: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
  name,
  content,
  last_modified,
  isFavourite,
  selected = false,
  onSelect,
  onToggleFavourite,
}) => {
  return (
    <div
      className={`${styles.card} ${selected ? styles.active : ''}`}
      onClick={() => onSelect(name)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(name)}
      title={name}
    >
      <div className={styles.header}>
        <button
          className={styles.star}
          aria-label={isFavourite ? 'Unfavourite' : 'Favourite'}
          title={isFavourite ? 'Unfavourite' : 'Favourite'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavourite(name);
          }}
          style={{
            color: isFavourite ? COLOURS.favourite : COLOURS.unfavourite,
          }}
        >
          {isFavourite ? <StarIcon20 /> : <StarOutline20 />}
        </button>

        <div className={styles.title}>{name}</div>
      </div>

      <div className={styles.meta}>
        Last modified: {new Date(last_modified).toLocaleString()}
      </div>

      <div className={styles.content}>
        {/* small preview (first line) */}
        {content?.split(/\r?\n/)[0] ?? ''}
      </div>
    </div>
  );
};

export default TemplateCard;