import { REPO_URL } from './Header';
import { GitHub, XLogo } from './icons';

export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-4 pb-14 text-[13px] text-muted">
      <div className="flex items-center gap-5">
        <span>
          Made by <span className="font-medium text-ink">Rishab</span>
        </span>
        <span className="h-3.5 w-px bg-line" aria-hidden="true" />
        <a
          href="https://x.com/Yrishavjs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-ink"
        >
          <XLogo />
          @Yrishavjs
        </a>
        <span className="h-3.5 w-px bg-line" aria-hidden="true" />
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-ink"
        >
          <GitHub width={14} height={14} />
          GitHub
        </a>
      </div>
      <p className="text-[12px] text-faint">
        MIT licensed · Switch sounds are real CC0 keyboard recordings
      </p>
    </footer>
  );
}
