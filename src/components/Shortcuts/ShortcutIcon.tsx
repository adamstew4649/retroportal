import { useState } from 'react';
import type { ShortcutIcon as ShortcutIconType } from '../../types';
import { faviconUrlFor } from '../../utils/url';
import { initialsFor } from '../../utils/text';

interface ShortcutIconProps {
  icon: ShortcutIconType;
  label: string;
  url: string;
  size?: 'small' | 'large';
}

export function ShortcutIcon({ icon, label, url, size = 'large' }: ShortcutIconProps) {
  const [failed, setFailed] = useState(false);
  const src =
    icon.type === 'favicon' ? faviconUrlFor(url) : icon.type === 'url' ? icon.value : '';

  if (icon.type === 'text' || (src && failed) || !src) {
    return (
      <span className={`shortcut-icon shortcut-icon--${size} shortcut-icon--text`} aria-hidden="true">
        {icon.type === 'text' ? icon.value : initialsFor(label)}
      </span>
    );
  }

  return (
    <img
      className={`shortcut-icon shortcut-icon--${size}`}
      src={src}
      alt=""
      width={size === 'large' ? 32 : 22}
      height={size === 'large' ? 32 : 22}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
