import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import { api } from '@/lib/api';

type Shot = { id: string; capturedAt: string; url: string };

export function CaptureGallery({
  assignmentId,
  studentName,
  onClose,
}: {
  assignmentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { data } = await api.get<{ captures: { id: string; capturedAt: string }[] }>(
          `/assessments/assignments/${assignmentId}/captures`
        );
        const loaded: Shot[] = [];
        for (const cap of data.captures) {
          const res = await api.get<Blob>(
            `/assessments/assignments/${assignmentId}/captures/${cap.id}`,
            { responseType: 'blob' }
          );
          const url = URL.createObjectURL(res.data);
          urls.current.push(url);
          loaded.push({ id: cap.id, capturedAt: cap.capturedAt, url });
        }
        if (!cancelled) setShots(loaded);
      } catch {
        if (!cancelled) setError('Could not load capture images.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      urls.current = [];
    };
  }, [assignmentId]);

  return (
    <Modal open title={`Camera captures · ${studentName}`} onClose={onClose} size="xl">
      {loading ? <p className="text-sm text-slate-500">Loading images…</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!loading && !error && shots.length === 0 ? (
        <p className="text-sm text-slate-500">No captures yet. Images appear when the student moves during the exam.</p>
      ) : null}
      {shots.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shots.map((shot) => (
            <figure key={shot.id} className="overflow-hidden rounded-xl border border-slate-200">
              <img src={shot.url} alt="" className="aspect-video w-full object-cover" />
              <figcaption className="px-2 py-1.5 text-[11px] text-slate-500">
                {new Date(shot.capturedAt).toLocaleString()}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
