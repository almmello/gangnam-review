import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ApiSetup } from "@/components/api-setup";
import { Icon } from "@/components/icon";
export const metadata: Metadata = { title: "API setup" };
export default function SetupPage() {
  return <><SiteHeader active="setup" /><main id="main" className="page-width setup-main"><Link href="/" className="back-link"><Icon name="arrow" className="rotate-180" size={16} />Back to workbench</Link><p className="eyebrow">THE ENGINE BEHIND THE EVIDENCE</p><h1 className="setup-title">A little intelligence.<br /><em>A lot of transparency.</em></h1><p className="setup-lead">Connect to the DeepSeek API. Your sources and the reasons behind each finding stay in view.</p><ApiSetup /></main><SiteFooter /></>;
}
