'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { extractInstagramUrl } from '@/utils/regex';

export default function SharedPage() {
  return (
    <Suspense fallback={null}>
      <SharedRedirect />
    </Suspense>
  );
}

function SharedRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sharedText = searchParams.get('text');

    if (!sharedText) {
      router.replace('/');
      return;
    }

    const cleanedUrl = extractInstagramUrl(sharedText);

    if (!cleanedUrl) {
      router.replace('/?error=invalid_link');
      return;
    }

    router.replace(`/?shareUrl=${encodeURIComponent(cleanedUrl)}`);
  }, [searchParams, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-cream">
      <p className="text-charcoal">Processing share...</p>
    </div>
  );
}
