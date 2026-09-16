import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export default function NotFound() { return <><SiteHeader /><main id="main" className="page-width not-found"><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page is out of view.</h1><p>Return to the workbench to find your next step.</p><Link className="button button-primary" href="/">Back to workbench</Link></main><SiteFooter /></>; }

