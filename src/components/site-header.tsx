import Link from "next/link";
import { Brand } from "./brand";
import { Icon } from "./icon";
export function SiteHeader({ active = "workbench" }: { active?: "workbench" | "setup" }) {
  return <header className="site-header"><div className="page-width header-inner">
    <Brand />
    <nav aria-label="Main navigation">
      <Link href="/" className={active === "workbench" ? "nav-link active" : "nav-link"} aria-current={active === "workbench" ? "page" : undefined}>Workbench</Link>
      <Link href="/setup" className={active === "setup" ? "nav-link active" : "nav-link"} aria-current={active === "setup" ? "page" : undefined}><Icon name="key" size={15} /> API setup</Link>
    </nav>
    <span className="prototype-label"><span />Independent prototype</span>
  </div></header>;
}

