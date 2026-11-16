import { turnoutText } from '@shared/scoring';
import type { Results } from '@shared/types';
import { ResultsBreakdown } from './ResultsBreakdown';
import { Icon } from './ui/Icon';

/** Every movie got a veto. No fallback pick: inventing a recommendation would break the promise. */
export function NoMatchView({ results }: { results: Results }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex animate-fade-up flex-col items-center pt-4 text-center">
        {/* The two circles, apart: no overlap this time. */}
        <svg viewBox="0 0 140 80" className="w-48" aria-hidden="true">
          <defs>
            <radialGradient id="nm-a" cx="0.35" cy="0.35">
              <stop offset="0" stopColor="#fcd34d" />
              <stop offset="1" stopColor="#d97706" />
            </radialGradient>
            <radialGradient id="nm-b" cx="0.35" cy="0.35">
              <stop offset="0" stopColor="#fb7185" />
              <stop offset="1" stopColor="#be123c" />
            </radialGradient>
          </defs>
          <circle cx="34" cy="40" r="28" fill="url(#nm-a)" opacity="0.85" />
          <circle cx="106" cy="40" r="28" fill="url(#nm-b)" opacity="0.85" />
          <path d="M66 40h8" stroke="#78716c" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />
        </svg>
        <h1 className="mt-6 text-3xl font-black tracking-tight text-balance">Bu sefer ortak payda çıkmadı 🎬</h1>
        <p className="mt-3 max-w-md leading-relaxed text-stone-400">
          Her film en az bir veto aldı. Veto bir filmi doğrudan elediği için önerebileceğimiz bir film yok; rastgele birini
          seçmiyoruz.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-500">
          <Icon name="users" className="size-4" />
          {turnoutText(results)}
        </p>
      </div>

      <div className="rounded-3xl bg-white/[0.035] p-5 ring-1 ring-white/[0.07]">
        <p className="font-semibold">Ne yapabilirsiniz?</p>
        <p className="mt-1 text-[15px] text-stone-400">
          Yeni bir turda veto alan filmleri çıkarıp farklı filmler ekleyin. Liste aşağıda en az veto alandan en çoğa sıralı.
        </p>
      </div>

      <ResultsBreakdown results={results} open />
    </div>
  );
}
