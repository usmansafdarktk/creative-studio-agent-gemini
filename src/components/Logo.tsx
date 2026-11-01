/** Falcon Studio mark: a warm orange tile with a stack of slides. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#F26A21" />
      <rect x="7" y="9.5" width="15" height="11" rx="2.5" fill="#fff" opacity=".45" transform="rotate(-8 14.5 15)" />
      <rect x="10" y="11" width="15" height="11" rx="2.5" fill="#fff" />
      <rect x="12.5" y="14" width="6" height="1.8" rx=".9" fill="#F26A21" />
      <rect x="12.5" y="17.2" width="9" height="1.4" rx=".7" fill="#0C0C0D" opacity=".25" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[19px] font-extrabold tracking-[-0.03em] text-ink">
        Falcon<span className="font-light text-ink-2"> Studio</span>
      </span>
    </span>
  );
}
