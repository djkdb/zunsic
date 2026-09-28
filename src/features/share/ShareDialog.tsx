import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { renderShareCard, shareText, type ShareCardData } from './shareCard';

export function ShareDialog({ open, onClose, data }: { open: boolean; onClose: () => void; data: ShareCardData }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    renderShareCard(data)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setStatus('이미지를 생성하지 못했습니다. 텍스트 복사를 이용해 주세요.'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setBlob(null);
      setStatus('');
    };
  }, [open, data]);

  const file = blob ? new File([blob], 'market30-result.png', { type: 'image/png' }) : null;
  const canNativeShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'market30-result.png';
    a.click();
    setStatus('이미지를 저장했습니다.');
  };
  const nativeShare = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'MARKET//30', text: shareText(data) });
    } catch {
      /* user cancelled */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(data));
      setStatus('결과 텍스트를 복사했습니다.');
    } catch {
      setStatus('클립보드에 접근할 수 없습니다.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="share-title" className="w-full max-w-md">
      <div className="max-h-[92dvh] overflow-y-auto rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="share-title" className="label">
            결과 공유
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="h-8 w-8 text-[var(--color-muted)]">
            ✕
          </button>
        </div>
        <div className="aspect-[4/5] w-full overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)]">
          {url ? <img src={url} alt="결과 공유 카드 미리보기" className="h-full w-full object-contain" /> : <div className="label flex h-full items-center justify-center">이미지 생성 중…</div>}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-dim)]">공유 카드에는 요약 지표만 포함되며 거래 내역은 포함되지 않습니다.</p>
        <div className="mt-3 grid gap-2">
          {canNativeShare && (
            <Button variant="primary" onClick={nativeShare}>
              공유하기…
            </Button>
          )}
          <Button variant={canNativeShare ? 'outline' : 'primary'} onClick={download} disabled={!url}>
            이미지 저장 (PNG)
          </Button>
          <Button variant="outline" onClick={copy}>
            텍스트 복사
          </Button>
        </div>
        <p role="status" className="mt-2 min-h-4 text-center text-[11px] text-[var(--color-muted)]">
          {status}
        </p>
      </div>
    </Modal>
  );
}
