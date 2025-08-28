// src/views/EmailCompilerView/EmailCompilerView.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { core } from '@tauri-apps/api';
import clipboard from 'tauri-plugin-clipboard-api';
import TemplateList, { TemplateFile } from '../components/TemplateList/TemplateList';

import { CopyIcon20, SaveIcon24, ChevronDownIcon16 } from '../ui/icons';
import { COLOURS } from '../ui/theme/theme';
import { useToast } from '../ui/toast';
import { STRINGS } from '../ui/strings';

import elements from '../ui/elements.module.css';

type SignatureFile = {
  signature_name: string;
  name: string;
  position: string;
  department: string;
  company: string;
  location: { name: string; address: string };
  image_filename: string | null;
};

const LEFT_MIN_WIDTH = 220;
const LEFT_MAX_WIDTH = 350;
const GUTTER = '1rem';
const EDITOR_MIN_HEIGHT = 220;
const SIGNATURE_LOGO_WIDTH = 300;

export default function EmailCompilerView() {
  // Left column selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateFile | null>(null);

  // Editor body
  const [templateBody, setTemplateBody] = useState('');

  // Salutation / Valediction / Recipient
  const [salutations, setSalutations] = useState<string[]>([]);
  const [valedictions, setValedictions] = useState<string[]>([]);
  const [selectedSalutation, setSelectedSalutation] = useState<string>('');
  const [selectedValediction, setSelectedValediction] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');

  // Signatures
  const [signatureNames, setSignatureNames] = useState<string[]>([]);
  const [selectedSignatureName, setSelectedSignatureName] = useState<string>('');
  const [selectedSignature, setSelectedSignature] = useState<SignatureFile | null>(null);
  const [signatureImageB64, setSignatureImageB64] = useState<string | null>(null);

  const { showToast } = useToast();
  const [showPreview, setShowPreview] = useState(false);

  // Load salutations, valedictions, and signature names
  useEffect(() => {
    // Load salutations and default to the first item (keep "— none —" as an explicit choice).
    core.invoke<string[]>('load_salutations')
      .then((arr) => {
        setSalutations(arr);
        setSelectedSalutation((prev) => prev || (arr[0] ?? ''));
      })
      .catch(() => {
        const fallback = ['Hello', 'Hi', 'Good morning'];
        setSalutations(fallback);
        setSelectedSalutation((prev) => prev || fallback[0]);
      });

    // Load valedictions and default to the first item (keep "— none —" as an explicit choice).
    core.invoke<string[]>('load_valedictions')
      .then((arr) => {
        setValedictions(arr);
        setSelectedValediction((prev) => prev || (arr[0] ?? ''));
      })
      .catch(() => {
        const fallback = ['Thanks', 'Sincerely', 'Kind regards'];
        setValedictions(fallback);
        setSelectedValediction((prev) => prev || fallback[0]);
      });

    core.invoke<string[]>('load_signatures')
      .then(setSignatureNames)
      .catch((err) => console.error('Failed to load signatures', err));
  }, []);

  // Handle template selection from the list
  const handleSelectTemplate = (tpl: TemplateFile) => {
    setSelectedTemplate(tpl);
    setTemplateBody(tpl.content);
  };

  // Persist changes to template body
  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await core.invoke('save_template', { name: selectedTemplate.name, content: templateBody });
      showToast({ message: STRINGS.savedChanges, variant: 'success' });
      // reflect last modified locally
      setSelectedTemplate((prev) =>
        prev ? { ...prev, content: templateBody, last_modified: new Date().toISOString() } : prev
      );
    } catch (err) {
      console.error('Failed to save template', err);
    }
  };

  // Load full signature when selection changes
  useEffect(() => {
    if (!selectedSignatureName) {
      setSelectedSignature(null);
      setSignatureImageB64(null);
      return;
    }
    core.invoke<SignatureFile>('load_signature_file', { name: selectedSignatureName })
      .then((sig) => {
        setSelectedSignature(sig);
        if (sig.image_filename) {
          core.invoke<string>('get_signature_image_base64', { filename: sig.image_filename })
            .then(setSignatureImageB64)
            .catch(() => setSignatureImageB64(null));
        } else {
          setSignatureImageB64(null);
        }
      })
      .catch((err) => console.error('Failed to load signature file', err));
  }, [selectedSignatureName]);


  useEffect(() => {
    core.invoke<{
      email_view_last_selected_signature: string | null,
      email_view_last_selected_salutation: string | null,
      email_view_last_selected_valediction: string | null
    }>('load_cache')
      .then((cache) => {
        if (cache.email_view_last_selected_salutation) {
          setSelectedSalutation(cache.email_view_last_selected_salutation);
        }
        if (cache.email_view_last_selected_valediction) {
          setSelectedValediction(cache.email_view_last_selected_valediction);
        }
        if (cache.email_view_last_selected_signature) {
          setSelectedSignatureName(cache.email_view_last_selected_signature);
        }
      })
      .catch((err) => console.error('Failed to load cache:', err));
  }, []);


  useEffect(() => {
    const t = setTimeout(() => {
      const patch: Record<string, string | null> = {
        email_view_last_selected_salutation: selectedSalutation || null,
        email_view_last_selected_valediction: selectedValediction || null,
        email_view_last_selected_signature: selectedSignatureName || null,
      };
      core.invoke('update_cache', { patch })
        .catch(err => console.error('Failed to update cache:', err));
    }, 300);
    return () => clearTimeout(t);
  }, [selectedSalutation, selectedValediction, selectedSignatureName]);


  // Compose HTML + plaintext
  const composed = useMemo(() => {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const nl2br = (s: string) => escapeHtml(s).replace(/\r?\n/g, '<br/>');

    // Inside useMemo(...)
    const name = recipient.trim();

    // Start from the selected salutation, but strip any trailing comma so we don't get "Hello, Alex,"
    const salBase = (selectedSalutation || '').replace(/,\s*$/, '').trim();

    // If there's a name, append it with a single space; otherwise just use the salutation
    const sal = salBase ? (name ? `${salBase} ${name}` : salBase) : '';

    // "ensure one comma" rule still applies:
    const salHtml = sal ? `<p>${nl2br(sal)}${sal.endsWith(',') ? '' : ','}</p>` : '';
    const bodyHtml = `<div>${nl2br(templateBody)}</div>`;
    const valHtml = selectedValediction ? `<p style="margin-top:1rem;">${nl2br(selectedValediction)}${selectedValediction.endsWith(',') ? '' : ','}</p>` : '';

    const sigHtml = (() => {
      if (!selectedSignature) return '';
      const s = selectedSignature;
      const img = signatureImageB64
        ? `<br><img src="data:image/png;base64,${signatureImageB64}" width="${SIGNATURE_LOGO_WIDTH}"
                 style="display:block;width:${SIGNATURE_LOGO_WIDTH}px;height:auto;margin-top:1rem;border:0;outline:0;text-decoration:none;"
                 alt="Signature image" />`
        : '';
      return `
        <div>
          <strong>${escapeHtml(s.name)}</strong><br/>
          ${escapeHtml(`${s.position}, ${s.department}`)}<br/>
          ${escapeHtml(s.company)}<br/>
          ${escapeHtml(s.location?.address ?? '')}
          ${img}
        </div>
      `;
    })();

    const html = `
      <div style="font-family:-apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111827;">
        ${salHtml}${bodyHtml}${valHtml}${sigHtml}
      </div>
    `;

    const plain = [
      sal ? (sal.endsWith(',') ? sal : `${sal},`) : '',
      templateBody,
      selectedValediction ? `${selectedValediction},` : '',
      selectedSignature
        ? [
            selectedSignature.name,
            `${selectedSignature.position}, ${selectedSignature.department}`,
            selectedSignature.company,
            selectedSignature.location?.address ?? '',
          ].filter(Boolean).join('\n')
        : '',
    ]
      .filter((s) => s && s.trim().length > 0)
      .join('\n\n');

    return { html, plain };
  }, [selectedSalutation, recipient, templateBody, selectedValediction, selectedSignature, signatureImageB64]);

  const handleCopy = async () => {
    try {
      await clipboard.writeHtml(composed.html);
      showToast({ message: STRINGS.copiedToClipboard, variant: 'success' });
    } catch (err) {
      console.error('Failed to copy composed email', err);
    }
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        height: '100dvh', 
        padding: '1rem',
        boxSizing: 'border-box',
        width: '100%',                  // helps avoid accidental expansion past viewport
      // NOTE: do NOT set overflowX:'hidden' here if you want page-level horizontal
      // scroll to be possible; keep default so only the *page* can scroll sideways.
      }}
    >
      {/* LEFT: reuse TemplateList (Templates + search + favourites) */}
      <div
        style={{
          // Give the column a responsive width that never exceeds LEFT_MAX_WIDTH
          width: `clamp(${LEFT_MIN_WIDTH}px, 26vw, ${LEFT_MAX_WIDTH}px)`,
          flex: '0 0 auto',
          borderRight: `1px solid ${COLOURS.divider}`,
          paddingRight: GUTTER,
          overflowY: 'auto',                // independent vertical scroll
          overflowX: 'hidden',              // never show a horizontal scrollbar here
          minHeight: 0,                     // required for scroll inside flex child
        }}
      >
        <TemplateList
          selectedName={selectedTemplate?.name ?? null}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>

      {/* RIGHT: Composer */}
      <div 
        style={{ 
          flex: '1 1 auto', 
          minWidth: 0,                      // <-- CRUCIAL: allow shrinking within flex
          paddingLeft: GUTTER,
          overflowY: 'auto',                // independent vertical scroll
          overflowX: 'hidden',              // never show a horizontal scrollbar here
        }}
      >
        {/* Row 1: Salutation + Recipient + Copy */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'min-content 3fr 0.5fr', 
            gap: 8, 
            marginBottom: 12, 
            alignItems: 'end' }}>
          <div>
            <label
              className= { elements.subtitle }
            >
              Opening
            </label>

            <select
              value={selectedSalutation}
              onChange={(e) => setSelectedSalutation(e.target.value)}
              className= { elements.select }
            >
              <option value="">— none —</option>
              {salutations.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>


          <div>
            <label 
              className= { elements.subtitle }
            >
              Recipient
            </label>

            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g., Alex"
              className= { elements.input }
            />
          </div>
        </div>

        {/* Row 2: Template editor + Save */}
        <div style={{ marginBottom: 12 }}>
          <label
            className= { elements.subtitle }
          >
            Template body
          </label>

          <div
              style={{
                position: 'relative',
                // allow the overlayed toolbar to stay within rounded corners if you wish
                // overflow: 'hidden',
              }}
            >
              {/* Floating toolbar – visually inside the editor area */}
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  gap: 8,
                  zIndex: 1,
                }}
                aria-label="Editor toolbar"
              >
                <button
                  type="button"
                  onClick= { handleSaveTemplate }
                  disabled= { !selectedTemplate }
                  className= { elements.iconBtn }
                  title="Save changed template"
                  aria-label="Save changed Template"
                >
                  <SaveIcon24/>
                </button>
              </div>

              {/* The textarea gets extra top padding so text never hides under the toolbar */}
              <textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                placeholder={selectedTemplate ? '' : 'Select a template to edit…'}
                readOnly={!selectedTemplate}
                wrap="soft"
                style={{
                  boxSizing: 'border-box',  // prevents right-edge overflow
                  width: '100%',
                  maxWidth: '100%',
                  minHeight: EDITOR_MIN_HEIGHT,
                  maxHeight: '70vh',
                  padding: '44px 12px 12px 12px', // <-- extra top padding for toolbar clearance
                  borderRadius: 8,
                  border: `1px solid ${COLOURS.border}`,
                  resize: 'vertical',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                  fontSize: 14,
                  lineHeight: 1.5,
                  background: selectedTemplate ? '#fff' : '#f9fafb',
                }}
              />
          </div>
        </div>

        {/* Row 3: Valediction */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'min-content min-content 1fr', 
            gap: 8, 
            marginBottom: 12 
          }}
        >
          <div>
            <label 
              className= { elements.subtitle }
            >
              Closing
            </label>
            <select
              value={selectedValediction}
              onChange={(e) => setSelectedValediction(e.target.value)}
              className= { elements.select }
            >
              <option value="">— none —</option>
              {valedictions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Row 4: Signature */}
          <div>
            <label 
              className= { elements.subtitle }
            >
              Signature
            </label>

            <select
              value={selectedSignatureName}
              onChange={(e) => setSelectedSignatureName(e.target.value)}
              className= { elements.select }
            >
              <option value="">— none —</option>
              {signatureNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div
          style={{
            borderTop: `1px solid ${COLOURS.divider}`,
            marginTop: '1rem',
            paddingTop: '0.5rem',
            background: '#f3f4f6',
            borderRadius: 8,
            padding: '1rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setShowPreview(prev => !prev)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={elements.subtitle}>Preview</span>
              <ChevronDownIcon16
                style={{
                  transition: 'transform 0.2s ease',
                  transform: showPreview ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // prevent collapsing when clicking copy
                handleCopy();
              }}
              className={elements.iconBtn}
              title="Copy composed email"
              aria-label="Copy composed email"
            >
              <CopyIcon20 />
            </button>
          </div>

          {showPreview && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                border: `1px solid ${COLOURS.border}`,
                borderRadius: 8,
                background: '#fff',
                fontFamily: 'sans-serif',
                color: '#111827'
              }}
              dangerouslySetInnerHTML={{ __html: composed.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}