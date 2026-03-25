type SettingsSwitchProps = {
  enabled: boolean;
  onChange: () => void;
  'aria-label'?: string;
  className?: string;
};

/**
 * Track uses flex justify-start / justify-end so the thumb stays visually centered
 * without fragile translate-x pixel math.
 */
export function SettingsSwitch({
  enabled,
  onChange,
  'aria-label': ariaLabel,
  className,
}: SettingsSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
      onClick={onChange}
      className={[
        'group relative flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1',
        'transition-[background-color,box-shadow] duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topo-5/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        enabled
          ? 'justify-end bg-topo-5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]'
          : 'justify-start bg-ink-faint/90 hover:bg-ink-faint',
        className ?? '',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none h-5 w-5 rounded-full bg-white',
          'shadow-[0_1px_3px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.06)]',
          'transition-transform duration-200 ease-out group-active:scale-90',
        ].join(' ')}
        aria-hidden
      />
    </button>
  );
}
