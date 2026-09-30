// Floating help/trainer popovers anchored to an icon. Rendered in a portal so card
// `overflow-hidden` never clips them; they follow the icon while the page scrolls.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Popover({ anchor, title, children, onClose, variant = 'help', width = 300 }: { anchor: RefObject<HTMLElement>; title: string; children: ReactNode; onClose: () => void; variant?: 'help' | 'trainer'; width?: number }) {
  const panel = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const track = () => setRect(anchor.current?.getBoundingClientRect() ?? null);
    track();
    window.addEventListener('scroll', track, true);
    window.addEventListener('resize', track);
    return () => { window.removeEventListener('scroll', track, true); window.removeEventListener('resize', track); };
  }, [anchor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(); };
    // Clicks on the anchor itself are left to its own toggle handler.
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) close.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [anchor]);

  if (!rect) return null;
  const left = Math.max(8, Math.min(rect.left - 16, window.innerWidth - width - 8));
  const below = rect.bottom + 180 < window.innerHeight;
  const style = below ? { left, top: rect.bottom + 8, width } : { left, bottom: window.innerHeight - rect.top + 8, width };
  const trainer = variant === 'trainer';
  return createPortal(<div ref={panel} role="dialog" aria-label={title} style={{ position: 'fixed', ...style }} className={`z-[100] rounded-[3px] border text-[13px] leading-[18px] shadow-[0_4px_14px_rgba(0,0,0,.22)] ${trainer ? 'border-[#e87722] bg-[#003865] text-white' : 'border-[#c9d7e0] bg-white text-[#2e3a43]'}`}>
    <div className={`flex items-center justify-between px-3 py-2 ${trainer ? 'border-b border-white/20' : 'border-b border-[#e4ecf1] bg-[#e4ecf1]'}`}><span className={`text-[12px] font-bold uppercase tracking-[.4px] ${trainer ? 'text-[#f5a45d]' : 'text-[#003865]'}`}>{title}</span><button type="button" aria-label="Close" onClick={onClose} className={trainer ? 'text-white/80 hover:text-white' : 'text-[#5c6670] hover:text-[#003865]'}><X size={15} /></button></div>
    <div className="px-3 py-2.5">{children}</div>
  </div>, document.body);
}
