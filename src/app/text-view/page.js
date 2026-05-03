import { Suspense } from 'react';
import TextViewContent from './TextViewContent';

export default function TextViewPage() {
  return (
    <Suspense fallback={null}>
      <TextViewContent />
    </Suspense>
  );
}
