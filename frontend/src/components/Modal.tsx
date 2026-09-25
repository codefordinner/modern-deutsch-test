import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// The one dialog shell for every modal in the app. It provides what a dialog has to:
//  - role="dialog" + aria-modal + a title the dialog is labelled by;
//  - Escape closes it;
//  - Tab / Shift+Tab stay inside (focus trap), and focus goes back to the
//    element that opened the dialog when it closes;
//  - the page behind doesn't scroll;
//  - a click on the dimmed backdrop closes it (optional: forms turn it off so a
//    stray click doesn't throw away what has been typed).

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  /** The body: `.modal-body` and (optionally) `.modal-footer` blocks, or a form wrapping both. */
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root: HTMLElement): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => el.getClientRects().length > 0);

// Open dialogs, topmost last: only the topmost one reacts to the keyboard.
const openDialogs: HTMLElement[] = [];

let scrollLocks = 0;
let savedBodyStyle: { overflow: string; paddingRight: string } | null = null;

function lockPageScroll() {
  if (scrollLocks++ > 0) return;
  const { body } = document;
  savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  // Hiding the scrollbar would make the page jump sideways; pad by its width.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  body.style.overflow = 'hidden';
}

function unlockPageScroll() {
  if (--scrollLocks > 0 || !savedBodyStyle) return;
  document.body.style.overflow = savedBodyStyle.overflow;
  document.body.style.paddingRight = savedBodyStyle.paddingRight;
  savedBodyStyle = null;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, size = 'lg', closeOnBackdrop = true, children }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogs.push(dialog);
    lockPageScroll();

    // Move focus into the dialog unless a field inside already took it (autoFocus).
    if (!dialog.contains(document.activeElement)) {
      const focusable = getFocusable(dialog);
      const target = focusable.find((el) => !el.closest('.modal-header')) ?? focusable[0] ?? dialog;
      target.focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (event.shiftKey && (active === first || active === dialog || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(dialog), 1);
      unlockPageScroll();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only a press that both started and ended on the backdrop counts (not a text selection dragged out of the dialog).
        if (closeOnBackdrop && pressStartedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal-content modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <button type="button" className="icon-btn" aria-label="Закрыть" title="Закрыть (Esc)" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};
