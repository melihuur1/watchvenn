import { CenteredPage } from '../components/CenteredPage';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { navigate } from '../lib/router';

export function RoomNotFound() {
  useDocumentTitle('Oda bulunamadı');
  return (
    <CenteredPage>
      <div className="flex max-w-md animate-fade-up flex-col items-center text-center">
        {/* Two circles that no longer meet. */}
        <svg viewBox="0 0 120 64" className="w-44" aria-hidden="true">
          <circle cx="30" cy="32" r="24" fill="rgb(251 191 36 / 0.12)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 5" />
          <circle cx="90" cy="32" r="24" fill="rgb(244 63 94 / 0.12)" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4 5" />
        </svg>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Bu oda artık yok</h1>
        <p className="mt-3 leading-relaxed text-stone-400">
          Link hatalı ya da oda kapanmış olabilir. Odalar geçicidir: kimse bağlı değilken 15 dakika, en fazla da 6 saat yaşar.
        </p>
        <Button size="lg" iconRight="arrow-right" className="mt-8" onClick={() => navigate('/')}>
          Yeni oda oluştur
        </Button>
      </div>
    </CenteredPage>
  );
}
