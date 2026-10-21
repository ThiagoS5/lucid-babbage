import React from 'react';
import { X } from 'lucide-react';

interface EditorialDialogProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const EditorialDialog: React.FC<EditorialDialogProps> = ({
  open,
  title,
  eyebrow = 'Painel',
  onClose,
  children,
  footer,
}) => {
  if (!open) return null;

  return (
    <div className="editorial-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="editorial-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="editorial-dialog__header">
          <div>
            <div className="editorial-eyebrow text-[8px]">{eyebrow}</div>
            <h2 className="editorial-dialog__title">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="editorial-dialog__close"
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="editorial-dialog__body">{children}</div>
        {footer && <div className="editorial-dialog__footer">{footer}</div>}
      </div>
    </div>
  );
};
