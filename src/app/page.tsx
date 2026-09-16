import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Workbench } from "@/components/workbench";
export default function Home() {
  return <><SiteHeader /><main id="main"><section className="hero"><div className="page-width hero-inner">
    <div><p className="eyebrow"><span /> THE EVIDENCE, IN FOCUS</p><h1>A clearer view of<br /><em>every review.</em></h1><p className="hero-copy">Discover the sources. Examine the evidence.<br />Bring clarity to the stories behind the clinics.</p></div>
    <div className="hero-note"><span className="vertical-line" /><p>Good decisions start<br />with better questions.</p><span className="tiny-label">A SOURCE-FIRST APPROACH</span></div>
  </div></section><Workbench /></main><SiteFooter /></>;
}

