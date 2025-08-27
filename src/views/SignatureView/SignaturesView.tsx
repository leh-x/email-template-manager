
import React, { useCallback, useEffect, useState } from 'react';
import { core } from '@tauri-apps/api';
import clipboard from 'tauri-plugin-clipboard-api';

import SignatureCard from '../../components/SignatureCard/SignatureCard';
import viewStyles from './SignatureView.module.css';

import elements from '../../ui/elements.module.css';

import { useToast } from '../../ui/toast';
import { STRINGS } from '../../ui/strings';
import { COLOURS } from '../../ui/theme/theme';
import { CopyIcon20, EditIcon20, TrashIcon16, PlusIcon20 } from '../../ui/icons';

const LEFT_MIN_WIDTH = 100;
const GUTTER = '1rem';
const PREVIEW_MAX_WIDTH = 450;
const PREVIEW_BG = COLOURS.panel;
const SIGNATURE_LOGO_WIDTH = 300;

export default function SignaturesView() {

  const [signatureName, setSignatureName] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [selectedLocation, setSelectedLocation] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [signatureList, setSignatureList] = useState<
    { signatureName: string; userName: string }[]
  >([]);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [, setLastSelectedSignature] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const { showToast } = useToast();

  interface Signature {
  signature_name: string;
  name: string;
  position: string;
  department: string;
  company: string;
  location: {
    name: string;
    address: string;
  };
  image_filename: string;
  }

  const handleSave = () => {
    const signature = {
      signature_name: signatureName,
      name,
      position,
      department,
      company,
      location: {
        name: selectedLocation,
        address: locations[selectedLocation] ?? ''
      },
      image_filename: imageFileName
    };

    core.invoke('save_signature_to_file', { signature })
      .then(() => {
        showToast({ message: STRINGS.savedChanges, variant: 'success'}); 
        console.log('Signature saved to file!')
        reloadSignatureList();
      })
      .catch(err => console.error('Failed to save signature:', err));
  };

  const reloadSignatureList = () => {
    core.invoke<string[]>('load_signatures')
      .then((names) => {
        Promise.all(
          names.map((name) =>
            core.invoke<Signature>('load_signature_file', { name })
              .then((sig) => ({
                signatureName: sig.signature_name,
                userName: sig.name,
              }))
          )
        ).then(setSignatureList);
      })
      .catch((err) => console.error('Failed to reload signatures:', err));
  };


  const handleSelectSignature = useCallback(
    (name: string, mode: 'preview' | 'edit' = 'preview') => {
      // 1) Load the full signature file for this name
      core
        .invoke<Signature>('load_signature_file', { name })
        .then((sig) => {
          // 2) Populate UI state from the loaded signature
          setSignatureName(sig.signature_name);
          setName(sig.name);
          setPosition(sig.position);
          setDepartment(sig.department);
          setCompany(sig.company);
          setSelectedLocation(sig.location.name);
          setImageFileName(sig.image_filename);
          setViewMode(mode);
          setLastSelectedSignature(name);

          // 3) Persist ONLY this view's last-selected field (safe partial update)
          core
            .invoke('update_cache', {
              patch: { signature_view_last_selected_signature: name },
            })
            .catch((err) => console.error('Failed to update cache:', err));

          // 4) Load image (if any) as base64 for preview/copy
          if (sig.image_filename) {
            core
              .invoke<string>('get_signature_image_base64', {
                filename: sig.image_filename,
              })
              .then(setImageBase64)
              .catch((err) => {
                setImageBase64(null);
                console.error('Failed to load image:', err);
              });
          } else {
            setImageBase64(null);
          }
        })
        .catch((err) => console.error('Failed to load signature:', err));
    },
    [] // setters are stable; no deps needed. Keeps the callback identity stable.
  );


  const handleDeleteSignature = (name: string) => {

    core.invoke('delete_signature_file', { name })
      .then(() => {
        setSignatureList((prev) => prev.filter((sig) => sig.signatureName !== name));
        // optionally clear current preview if you deleted the currently open one...
        showToast({ message: STRINGS.deleted(name), variant: 'success' });
      })
      .catch((err) => {
        console.error('Failed to delete signature:', err);
        showToast({ message: 'Failed to delete signature', variant: 'danger' });
      });
  };

  const handleCreateNewSignature = () => {
  // Clear all the form fields
  setSignatureName('');
  setName('');
  setPosition('');
  setDepartment('');
  setCompany('');
  setSelectedLocation('');              // or Object.keys(locations)[0] ?? '' if you want a default
  setImageFileName('');
  setImageBase64(null);

  // Switch to edit mode so the user can fill it out
  setViewMode('edit');

  // Do NOT touch lastSelectedSignature or save the cache here;
  // this is a new, unsaved draft.
  };

  const handleCopyToClipboard = async () => {
    const html = `
      <div>
        <strong>${name}</strong><br/>
        ${position}, ${department}<br/>
        ${company}<br/>
        ${locations[selectedLocation] ?? ''}<br/>
        ${
          imageBase64
                  ? `
                    <img
                      src="data:image/png;base64,${imageBase64}"
                      width="${SIGNATURE_LOGO_WIDTH}"
                      style="display:block;width:${SIGNATURE_LOGO_WIDTH}px;height:auto;margin-top:1rem;border:0;outline:0;text-decoration:none;"
                      alt="Signature image"
                    />`
                  : ''
        }
      </div>
    `;
    try {
      await clipboard.writeHtml(html);

      showToast({ message: STRINGS.copiedToClipboard, variant: 'success'});
      console.log('Copied to clipboard!');
      
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFileName(file.name);
    }
  };

  useEffect(() => {
    core.invoke<{ signature_view_last_selected_signature: string | null }>('load_cache')
      .then((cache) => {
        if (cache.signature_view_last_selected_signature) {
          setLastSelectedSignature(cache.signature_view_last_selected_signature);
        }
      }).catch((err) => console.error('Failed to load cache:', err));
  }, []);

  useEffect(() => {
    core.invoke<string[]>('load_signatures')
      .then((names) => {
        Promise.all(
          names.map((name) =>
            core.invoke<Signature>('load_signature_file', { name })
              .then((sig) => ({
                signatureName: sig.signature_name,
                userName: sig.name,
              }))
          )
        ).then((list) => {
          setSignatureList(list);

          // Load cache and select signature
          core.invoke<{ signature_view_last_selected_signature: string | null }>('load_cache')
            .then((cache) => {
              const fallback = list[0]?.signatureName;
              const toSelect = cache.signature_view_last_selected_signature ?? fallback;
              if (toSelect && viewMode === 'preview') 
                {
                  handleSelectSignature(toSelect, 'preview');
                }
            })
            .catch((err) => console.error('Failed to load cache:', err));
        });
      })
      .catch((err) => console.error('Failed to load signatures:', err));
  }, [handleSelectSignature, viewMode]);


  useEffect(() => {
    core.invoke<Record<string, string>>('load_locations')
      .then(setLocations)
      .catch(err => console.error('Failed to load locations:', err));
  }, []);

  return (
    <div 
      style=
      {{ 
        display: 'flex', 
        height: '100%', 
        padding: '1rem' 
      }}
    >
      {/* Left column: for signature list */}
      <div 
        style=
        {{ 
          minWidth: LEFT_MIN_WIDTH,
          flex: `1 1 ${LEFT_MIN_WIDTH}px`, // grows/shrinks but never below min
          borderRight: `1px solid ${COLOURS.divider}`,
          paddingRight: GUTTER, // padding on the left side of divider
          overflowY: 'auto',
        }}
      > 

        {/* Left column header with + button */}
        <div
          style={{
            position: 'sticky',   // stays visible while list scrolls
            top: 0,
            background: '#fff',
            padding: '0.25rem 0 0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            zIndex: 1,
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
            Signatures
          </h4>

          <button
            type="button"
            aria-label="Create new signature"
            title="Create new signature"
            onClick={handleCreateNewSignature}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              border: '1px solid #d0d7de',
              background: '#fff',
              color: '#111827',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              padding: 0,
              userSelect: 'none',
            }}
          >
            {/* Plus Icon */}
            <PlusIcon20/>
          </button>
        </div>
   
        {signatureList.map(({ signatureName, userName }) => (
          <SignatureCard
            key={signatureName}
            signatureName={signatureName}
            userName={userName}
            onSelect={() => handleSelectSignature(signatureName, 'preview')}
            onEdit={() => handleSelectSignature(signatureName, 'edit')}
            onDelete={() => handleDeleteSignature(signatureName)}
          />
        ))}
      </div>
     
      {/* Right column: Signature Preview */}      
      <div style={{ flex: '3 1 0', paddingLeft: GUTTER, overflowY: 'auto' }}>
        {viewMode === 'preview' ? (
          // ==== PREVIEW CONTAINER ====
          <div
            style={{
              position: 'relative',
              background: PREVIEW_BG,
              border: `1px solid ${COLOURS.divider}`,
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              padding: '1rem 1rem 1.25rem 1rem',
              maxWidth: PREVIEW_MAX_WIDTH,
              width: '100%',
            }}
          >
            {/* Header: Title on the left, icon actions in the top-right */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                paddingRight: 80, // leave some breathing room so text doesn't collide with icons
              }}
            >
              <h3
                title={signatureName || 'Signature Preview'}
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: `${COLOURS.text}`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {signatureName}
              </h3>
            </div>

            {/* Icon toolbar (top-right corner) */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                display: 'flex',
                gap: 8,
              }}
            >
              {/* Copy */}
              <button
                type="button"
                aria-label="Copy signature to clipboard"
                title="Copy signature to clipboard"
                onClick={handleCopyToClipboard}
                className={elements.iconBtn}
              >
                {/* Copy SVG */}
                <CopyIcon20 />
              </button>

              {/* Edit */}
              <button
                type="button"
                aria-label="Edit signature"
                title="Edit signature"
                onClick={() => setViewMode('edit')}
                className={elements.iconBtn}
              >
                {/* Edit SVG */}
                <EditIcon20 />
              </button>
              
                {/* Delete */}
                <button
                  type="button"
                  aria-label="Delete signature"
                  title="Delete signature"
                  onClick={() => signatureName && handleDeleteSignature(signatureName)}
                  className={`${elements.iconBtn} ${viewStyles.danger}`}
                  disabled={!signatureName}
                >
                  {/* Trash SVG */}
                  <TrashIcon16 />
                </button>
            </div>

            {/* Signature contents */}
            <div style={{ marginTop: '0.75rem', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                <strong>{name}</strong>
                <br />
                {position}, {department}
                <br />
                {company}
                <br />
                {locations[selectedLocation]}
              </p>

              {imageBase64 && (
                <img
                  src={`data:image/png;base64,${imageBase64}`}
                  alt="Signature"
                  style={{ maxWidth: 300, marginTop: '1rem' }}
                />
              )}
            </div>
          </div>
        ) : (
          // ==== EDIT VIEW ====
          <div style={{ maxWidth: PREVIEW_MAX_WIDTH, width: '100%' }}>
            <h3 style={{ marginTop: 0 }}>Create or Edit Signature</h3>
            <form onSubmit={(e) => e.preventDefault()}>
              {/* Signature Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label
                  className= { elements.subtitle }
                >
                  Signature Name:
                </label>
                <br />
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className= { elements.input }
                />
              </div>

              {/* Name and Position */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label
                    className= { elements.subtitle }
                  >
                    Name<span style={{ color: 'red' }}> *</span>:
                  </label>
                  <br />
                  <input
                    type="text"
                    value= { name }
                    onChange= {(e) => setName(e.target.value)}
                    className= { elements.input }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label 
                    className= { elements.subtitle }
                  >
                    Position<span style={{ color: 'red' }}> *</span>:
                  </label>
                  <br />
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className= { elements.input }
                  />
                </div>
              </div>

              {/* Company and Department */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label 
                    className= { elements.subtitle }
                  >
                    Company:
                  </label>
                  <br />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className= { elements.input }
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    className= { elements.subtitle }
                  >
                    Department:
                  </label>
                  <br />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className= { elements.input }
                  />
                </div>
              </div>

              {/* Location Dropdown and File Picker */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label
                    className= { elements.subtitle }
                  >
                    Location:
                  </label>
                  <br />
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className= { elements.select }
                  >
                    <option disabled value="">
                      -- Select Location --
                    </option>
                    {Object.entries(locations).map(([name, address]) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    className= { elements.subtitle }
                  >
                    Company Logo or Signature Image:
                  </label>
                  <br />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className= { elements.input }
                  />
                </div>
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={handleSave}>
                  Save
                </button>
                <button type="button" onClick={() => setViewMode('preview')}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
