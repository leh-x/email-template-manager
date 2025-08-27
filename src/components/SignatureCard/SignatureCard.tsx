// components/SignatureCard/SignatureCard.tsx
import React, { useState, useEffect, useRef } from 'react';
import styles from './SignatureCard.module.css';

interface SignatureCardProps {
  signatureName: string;
  userName: string;
  lastModified?: string;
  onEdit: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const SignatureCard: React.FC<SignatureCardProps> = ({
  signatureName,
  userName,
  lastModified,
  onEdit,
  onDelete,
  onSelect,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    const handleClick = () => {
      setMenuOpen(false);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div className={styles.card} onClick={onSelect}>
      <div className={styles.left}>
        <div className={styles.title}>{signatureName}</div>
        <div className={styles.subtitle}>{userName}</div>
      </div>
      <div className={styles.right}>
        {lastModified && <div className={styles.date}>{lastModified}</div>}

        {/* Menu wrapper around icon and dropdown */}        
        <div className={styles.menuWrapper} ref={menuRef}>
          <div
            className={styles.menuIcon}            
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}>
            {/* 3-dot SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
            <path fill="currentColor" d="M7 4c0-.14 0-.209.008-.267a.85.85 0 0 1 .725-.725C7.79 3 7.86 3 8 3s.209 0 .267.008a.85.85 0 0 1 .725.725C9 3.79 9 3.86 9 4s0 .209-.008.267a.85.85 0 0 1-.725.725C8.21 5 8.14 5 8 5s-.209 0-.267-.008a.85.85 0 0 1-.725-.725C7 4.21 7 4.14 7 4m0 4c0-.14 0-.209.008-.267a.85.85 0 0 1 .725-.725C7.79 7 7.86 7 8 7s.209 0 .267.008a.85.85 0 0 1 .725.725C9 7.79 9 7.86 9 8s0 .209-.008.267a.85.85 0 0 1-.725.725C8.21 9 8.14 9 8 9s-.209 0-.267-.008a.85.85 0 0 1-.725-.725C7 8.21 7 8.14 7 8m0 4c0-.139 0-.209.008-.267a.85.85 0 0 1 .724-.724c.059-.008.128-.008.267-.008s.21 0 .267.008a.85.85 0 0 1 .724.724c.008.058.008.128.008.267s0 .209-.008.267a.85.85 0 0 1-.724.724c-.058.008-.128.008-.267.008s-.209 0-.267-.008a.85.85 0 0 1-.724-.724C7 12.209 7 12.139 7 12"/>
            </svg>
          </div>
        
          {menuOpen && (
            <div className={styles.menu}>              
              
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent global click from interfering
                  setMenuOpen(false);  // Close the menu
                  onEdit();            // Trigger the edit action
                }}>
                {/* Edit SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="currentColor" d="M5 19h1.425L16.2 9.225L14.775 7.8L5 17.575zm-1 2q-.425 0-.712-.288T3 20v-2.425q0-.4.15-.763t.425-.637L16.2 3.575q.3-.275.663-.425t.762-.15t.775.15t.65.45L20.425 5q.3.275.437.65T21 6.4q0 .4-.138.763t-.437.662l-12.6 12.6q-.275.275-.638.425t-.762.15zM19 6.4L17.6 5zm-3.525 2.125l-.7-.725L16.2 9.225z"/>
                </svg>
                Edit
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}>
                {/* Trash SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" fill-rule="evenodd" d="M9 2H7a.5.5 0 0 0-.5.5V3h3v-.5A.5.5 0 0 0 9 2m2 1v-.5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2V3H2.251a.75.75 0 0 0 0 1.5h.312l.317 7.625A3 3 0 0 0 5.878 15h4.245a3 3 0 0 0 2.997-2.875l.318-7.625h.312a.75.75 0 0 0 0-1.5zm.936 1.5H4.064l.315 7.562A1.5 1.5 0 0 0 5.878 13.5h4.245a1.5 1.5 0 0 0 1.498-1.438zm-6.186 2v5a.75.75 0 0 0 1.5 0v-5a.75.75 0 0 0-1.5 0m3.75-.75a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5a.75.75 0 0 1 .75-.75" clip-rule="evenodd"/>
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignatureCard;
