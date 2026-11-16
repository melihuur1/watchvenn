import { useState } from 'react';
import { copyText, inviteUrl } from '../lib/clipboard';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { useToast } from './ui/Toaster';

/** The link is the whole invitation. Copy is the loudest button while you're still alone. */
export function InviteCard({ code, alone }: { code: string; alone: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(code);
  const canShare = typeof navigator.share === 'function';

  async function copy() {
    if (await copyText(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast('Kopyalanamadı. Linki seçip kendin kopyalayabilirsin.', 'error');
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'WatchVenn', text: 'Ne izleyeceğimize birlikte karar verelim:', url });
    } catch {
      // Cancelled by the user, or unsupported: nothing to do.
    }
  }

  return (
    <section
      aria-labelledby="invite-title"
      className="relative overflow-hidden rounded-3xl bg-linear-to-br from-amber-300/[0.09] via-white/[0.03] to-rose-500/[0.09] p-5 ring-1 ring-white/[0.08]"
    >
      <h2 id="invite-title" className="text-[13px] font-bold tracking-wider text-stone-400 uppercase">
        Arkadaşlarını davet et
      </h2>
      <div className="mt-3 rounded-2xl bg-black/30 px-4 py-3 ring-1 ring-white/10">
        <p className="text-xs font-semibold text-stone-500">Oda kodu</p>
        <p className="font-mono text-[1.7rem] leading-tight font-black tracking-[0.22em] text-stone-50" aria-label={code.split('').join(' ')}>
          {code}
        </p>
        <p className="mt-1 truncate text-sm text-stone-400" title={url}>
          {url.replace(/^https?:\/\//, '')}
        </p>
      </div>
      <div className={`mt-3 grid gap-2 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <Button variant={alone ? 'primary' : 'secondary'} icon={copied ? 'check' : 'copy'} onClick={copy}>
          {copied ? 'Kopyalandı' : 'Linki kopyala'}
        </Button>
        {canShare && (
          <Button variant="secondary" icon="share" onClick={share}>
            Paylaş
          </Button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? 'Davet linki kopyalandı' : ''}
      </p>
      {alone && (
        <p className="mt-3 flex gap-2 text-[13px] leading-snug text-stone-500">
          <Icon name="info" className="mt-px size-4 shrink-0" />
          Tek başına mı deniyorsun? Linki gizli pencerede aç: aynı tarayıcıdaki sekmeler aynı kişi sayılır.
        </p>
      )}
    </section>
  );
}
