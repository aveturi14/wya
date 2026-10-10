import { site } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <a className="logo logo-lg" href="#top" aria-label="Back to top">
          wya<span>.</span>
        </a>
        <p>Plans that actually happen.</p>
        <nav aria-label="Footer">
          <a href="#how">How it works</a>
          <a href="#deposits">Deposits</a>
          <a href="#faq">FAQ</a>
          <a href={site.webAppUrl} target="_blank" rel="noopener noreferrer">
            Web app
          </a>
        </nav>
        <small>© {new Date().getFullYear()} wya</small>
      </div>
    </footer>
  );
}
