'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

export default function ProductImage({
  src,
  alt,
  className,
  objectFit = 'contain',
}: {
  src: string;
  alt: string;
  className?: string;
  objectFit?: 'contain' | 'cover';
}) {
  const [err, setErr] = useState(false);

  if (err) {
    return (
      <div className={`grid place-items-center bg-[var(--card)] ${className ?? ''}`}>
        <Package size={40} className="text-[var(--gray-2)]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${objectFit === 'cover' ? 'object-cover' : 'object-contain'} ${className ?? ''}`}
      onError={() => setErr(true)}
    />
  );
}
