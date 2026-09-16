import { Icon } from "./icon";
import { site } from "@/lib/product";
export function SiteFooter() {
  return <footer className="site-footer page-width"><p>Built by Alexandre Mello <span aria-hidden="true">/</span> An independent review quality prototype.</p>
    <a href={site.sourceUrl} target="_blank" rel="noreferrer">Explore Gangnam Beauty Guide <Icon name="external" size={13} /></a>
  </footer>;
}

