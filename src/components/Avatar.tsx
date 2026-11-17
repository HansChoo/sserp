import { useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[11px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

const BG_PALETTE = [
  'bg-slate-800 text-white',
  'bg-blue-700 text-white',
  'bg-emerald-700 text-white',
  'bg-amber-700 text-white',
  'bg-indigo-700 text-white',
];

function pickColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BG_PALETTE[Math.abs(hash) % BG_PALETTE.length];
}

export function Avatar({ name, src, size = 'sm' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = SIZE_MAP[size];
  const initial = (name || '?').trim().slice(0, 1);

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={`${name} 프로필 사진`}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    );
  }

  return (
    <div
      aria-label={`${name} 이니셜 아바타`}
      className={`${sizeClass} ${pickColor(name)} rounded-full flex items-center justify-center font-semibold shrink-0 select-none`}
    >
      {initial}
    </div>
  );
}
