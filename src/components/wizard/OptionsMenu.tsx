// Header OPTIONS menu: Save & Exit, Duplicate Quote, Print/Email/Fax, Quote Comment,
// Product Guides, plus trainer-only tools below a divider.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Copy, Download, Lightbulb, Menu, Printer, RotateCcw, SquarePen, UserRoundPlus } from 'lucide-react';
import { useQuote } from '@/context/useQuote';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';
import { productGuides } from '@/data/trainingHints';

const focusable = 'outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_#e87722]';

function Item({ icon, label, onClick, trailing, active = false }: { icon: ReactNode; label: string; onClick: () => void; trailing?: ReactNode; active?: boolean }) {
  return <li><button type="button" onClick={onClick} className={`flex w-full items-center gap-[12px] px-[16px] py-[10px] text-left text-[14px] text-[#2e3a43] outline-none hover:bg-[#eef3f6] focus-visible:bg-[#eef3f6] ${active ? 'shadow-[inset_0_0_0_2px_#e87722]' : ''}`}><span className="text-[#003865]">{icon}</span><span className="flex-1 underline-offset-2 hover:underline">{label}</span>{trailing}</button></li>;
}

export function OptionsMenu() {
  const { state, showDashboard, showDocuments, duplicateQuote, updatePolicy, loadSampleQuote, resetQuote, toggleHints } = useQuote();
  const [open, setOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [dialog, setDialog] = useState<'comment' | { guide: number } | null>(null);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState('');
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const run = (action: () => void) => () => { setOpen(false); action(); };
  const duplicate = () => {
    if (!window.confirm('Duplicate this quote? The copy gets a new quote number and must be re-rated.')) return;
    setNotice(`Quote duplicated. New Quote #: ${duplicateQuote()}`);
  };
  const openComment = () => { setComment(state.policy.comment); setDialog('comment'); };
  const guide = dialog && typeof dialog === 'object' ? productGuides[dialog.guide] : null;

  return <div ref={menu} className="relative">
    <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)} className={`flex items-center gap-[12px] ${focusable}`}><Menu size={28} strokeWidth={2} /><span className="text-[14px] font-bold underline underline-offset-2">OPTIONS</span><ChevronDown size={18} strokeWidth={2.4} className={open ? 'rotate-180' : ''} /></button>
    {open && <ul role="menu" className="absolute right-0 top-[44px] z-40 w-[250px] rounded-[3px] border border-[#cfdbe3] bg-white py-[6px] shadow-[0_4px_14px_rgba(0,0,0,.22)]">
      <Item icon={<Download size={18} />} label="Save & Exit" onClick={run(showDashboard)} />
      <Item icon={<Copy size={18} />} label="Duplicate Quote" onClick={run(duplicate)} />
      <Item icon={<Printer size={18} />} label="Print/Email/Fax" onClick={run(showDocuments)} active={state.ui.view === 'documents'} />
      <Item icon={<SquarePen size={18} />} label="Quote Comment" onClick={run(openComment)} trailing={state.policy.comment ? <span className="h-[8px] w-[8px] rounded-full bg-[#e87722]" aria-label="Has comment" /> : undefined} />
      <Item icon={<BookOpen size={18} />} label="Product Guides" onClick={() => setGuidesOpen(!guidesOpen)} trailing={<ChevronDown size={16} className={`text-[#003865] ${guidesOpen ? 'rotate-180' : ''}`} />} />
      {guidesOpen && productGuides.map((entry, index) => <li key={entry.title}><button type="button" onClick={run(() => setDialog({ guide: index }))} className="flex w-full items-center gap-2 py-[7px] pl-[46px] pr-[16px] text-left text-[13px] text-[#003865] underline-offset-2 hover:bg-[#eef3f6] hover:underline"><ChevronRight size={13} />{entry.title}</button></li>)}
      {state.trainerMode && <>
        <li className="mt-[6px] border-t border-[#e4ecf1] px-[16px] pb-[2px] pt-[8px] text-[10px] font-bold uppercase tracking-[.6px] text-[#7b858a]">Trainer mode</li>
        <Item icon={<Lightbulb size={18} />} label={`Training Hints: ${state.ui.hintMode ? 'ON' : 'OFF'}`} onClick={run(toggleHints)} />
        <Item icon={<UserRoundPlus size={18} />} label="Load Practice Customer" onClick={run(loadSampleQuote)} />
      </>}
      <Item icon={<RotateCcw size={18} />} label="Start New Quote" onClick={run(() => { if (window.confirm('Discard this quote and start a new one?')) resetQuote(); })} />
    </ul>}
    {notice && <div role="status" className="fixed right-[24px] top-[72px] z-[95] rounded-[3px] border border-[#0f7a52] bg-[#e6f4ef] px-[16px] py-[10px] text-[14px] font-medium text-[#0b5d3f] shadow-lg">{notice}</div>}
    {dialog === 'comment' && <Modal title="Quote Comment" width={560} onClose={() => setDialog(null)} footer={<><button type="button" className={modalButton.secondary} onClick={() => setDialog(null)}>Cancel</button><button type="button" className={modalButton.blue} onClick={() => { updatePolicy({ comment: comment.trim() }); setDialog(null); setNotice('Quote comment saved.'); }}>Save Comment</button></>}>
      <label htmlFor="quote-comment" className="mb-2 block text-[14px]">Comments are saved with Quote #: {state.policy.quoteNumber || '—'} and are visible to anyone who opens this quote.</label>
      <textarea id="quote-comment" value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} rows={6} className="w-full rounded-[4px] border border-[#7b8a95] p-3 text-[14px] outline-none focus:border-[#003865] focus:shadow-[inset_0_0_0_1px_#003865,0_0_0_2px_#fff,0_0_0_4px_#e87722]" />
      <div className="mt-1 text-right text-[12px] text-[#5c6670]">{comment.length}/500</div>
    </Modal>}
    {guide && <Modal title={guide.title} width={640} onClose={() => setDialog(null)} footer={<button type="button" className={modalButton.blue} onClick={() => setDialog(null)}>Close</button>}>
      <ul className="list-disc space-y-2 pl-5 text-[14px] leading-[20px]">{guide.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </Modal>}
  </div>;
}
