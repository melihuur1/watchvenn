import { useEffect } from 'react';

export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · WatchVenn` : 'WatchVenn · Ne izlesek?';
  }, [title]);
}
