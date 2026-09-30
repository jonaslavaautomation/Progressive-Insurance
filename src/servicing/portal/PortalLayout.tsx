// FAO portal chrome (global header, customer/policy search, footer) for the servicing pages
// reached from the dashboard: pending cancel/renewal list and Customer Summary.
import type { ReactNode } from 'react';
import { Header, SearchBar } from '@/components/dashboard/Dashboard';

const FOOTER_LINKS = ['Contact Us', 'Site Map', 'Accessibility', "Agents' Privacy", 'Consumer/Customer Privacy', 'CA Notice at Collection', 'Do Not Sell or Share My Personal Information (CA Residents Only)', 'Legal and Regulatory', 'Terms of Use'];

export function PortalFooter() {
  return <footer className="mx-auto mt-[40px] max-w-[1440px] border-t border-[#d5d9dd] px-4 pb-6 pt-5 text-[11px] text-[#1b2a36] print:hidden">
    <div className="flex flex-wrap gap-x-[26px] gap-y-2">{FOOTER_LINKS.map((link) => <a key={link} href="#" onClick={(event) => event.preventDefault()} className="font-bold underline underline-offset-2 hover:text-[#0073cf]">{link}</a>)}</div>
    <p className="mt-4">ForAgentsOnly is a restricted use site for authorized users only. Training simulation. Copyright © 1997-{new Date().getFullYear()} Progressive Casualty Insurance Company. All rights reserved.</p>
  </footer>;
}

export function PortalLayout({ children }: { children: ReactNode }) {
  return <div className="app-zoom min-h-screen bg-white text-[#1b2a36]">
    <div className="print:hidden"><Header /><SearchBar /></div>
    <main className="mx-auto max-w-[1440px] px-4 pt-4">{children}</main>
    <PortalFooter />
  </div>;
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="mb-3 flex items-center gap-1 text-[12px] font-bold text-[#0073cf] underline underline-offset-2 hover:text-[#003865] print:hidden">← {label}</button>;
}
