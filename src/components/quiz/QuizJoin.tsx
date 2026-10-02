import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Button, FormField, Input, Modal } from '@/components/ui';

export function quizJoinUrl(code: string) {
  const url = new URL(`${window.location.origin}/quizzes`);
  url.searchParams.set('join', code);
  return url.toString();
}

export function codeFromScan(raw: string) {
  const text = raw.trim();
  try {
    const url = new URL(text);
    const join = url.searchParams.get('join');
    if (join) return join.toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch {
    // Plain code, not a link.
  }
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: 220 })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!src) return <div className="h-52 w-52 rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  return <img src={src} alt="Quiz join QR code" className="h-52 w-52 rounded-2xl bg-white p-2" />;
}

export function QuizCodeModal({
  open,
  title,
  code,
  onClose,
}: {
  open: boolean;
  title: string;
  code: string;
  onClose: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied');
    } catch {
      toast.error('Could not copy the code');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quiz launched"
      description={`Students join “${title}” with this code or by scanning the QR.`}
      footer={
        <>
          <Button variant="secondary" onClick={copy}>
            Copy code
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <p className="font-display text-4xl font-bold tracking-[0.28em] text-slate-900 dark:text-white">
          {code}
        </p>
        <QrImage value={quizJoinUrl(code)} />
        <p className="text-center text-xs text-slate-500">
          On a phone, the QR opens the quiz join page for a student who is already signed in.
        </p>
      </div>
    </Modal>
  );
}

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};

function canScanQr() {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

export function JoinQuizModal({
  open,
  initialCode,
  joining,
  onClose,
  onJoin,
}: {
  open: boolean;
  initialCode?: string;
  joining: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState(initialCode || '');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;

  useEffect(() => {
    if (open) setCode(initialCode || '');
  }, [open, initialCode]);

  const stopScan = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning || !streamRef.current) return undefined;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video) return undefined;
    video.srcObject = stream;
    let stopped = false;
    const Detector = (
      window as unknown as {
        BarcodeDetector: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
      }
    ).BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });
    const tick = async () => {
      if (stopped || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        const raw = codes[0]?.rawValue;
        if (raw) {
          const next = codeFromScan(raw);
          if (next) {
            stopped = true;
            setCode(next);
            stopScan();
            onJoinRef.current(next);
            return;
          }
        }
      } catch {
        // Keep trying until the camera closes.
      }
      if (!stopped) requestAnimationFrame(() => void tick());
    };
    void video.play().then(() => {
      if (!stopped) void tick();
    });
    return () => {
      stopped = true;
    };
  }, [scanning]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startScan = async () => {
    if (!canScanQr()) {
      toast.error('This browser cannot scan a QR code. Type the code instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScanning(true);
    } catch {
      toast.error('Camera permission is needed to scan a QR code.');
      stopScan();
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        stopScan();
        onClose();
      }}
      title="Join with code / QR"
      description="Enter the code your teacher shows, or scan the QR."
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              stopScan();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button disabled={joining || code.trim().length < 4} onClick={() => onJoin(code)}>
            {joining ? 'Joining…' : 'Join quiz'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Quiz code" htmlFor="quiz-join-code">
          <Input
            id="quiz-join-code"
            value={code}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="AB12CD"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </FormField>
        {scanning ? (
          <div className="space-y-2">
            <video ref={videoRef} className="aspect-square w-full rounded-2xl bg-black object-cover" muted playsInline />
            <Button variant="secondary" size="sm" onClick={stopScan}>
              Stop camera
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => void startScan()}>
            Scan QR
          </Button>
        )}
      </div>
    </Modal>
  );
}
