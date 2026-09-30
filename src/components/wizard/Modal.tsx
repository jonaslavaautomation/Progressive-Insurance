// Carrier-style dialog: dimmed backdrop, white panel, slab title, close X, centered actions.
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children, footer, width = 760, className = '' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; className?: string }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(<div className={`fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#1b2a36]/55 px-4 pb-10 pt-[70px] ${className}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal aria-label={title} style={{ width }} className="relative max-w-full rounded-[4px] bg-white px-[34px] pb-[28px] pt-[30px] text-[14px] text-[#2e3a43] shadow-[0_8px_30px_rgba(0,0,0,.3)]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-[18px] top-[16px] text-[#2e3a43] outline-none hover:text-[#003865] focus-visible:shadow-[0_0_0_2px_#e87722]"><X size={22} /></button>
      <h2 className="mb-[14px] pr-8 font-slab text-[21px] font-bold leading-[27px]">{title}</h2>
      {children}
      {footer && <div className="mt-[26px] flex justify-center gap-[14px]">{footer}</div>}
    </div>
  </div>, document.body);
}
