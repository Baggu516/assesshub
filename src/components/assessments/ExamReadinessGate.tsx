import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';

type CheckState = 'checking' | 'ok' | 'fail';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function cameraErrorMessage(err: unknown) {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was blocked. Allow the camera for this site, then check again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is in use by another app. Close it, then check again.';
  }
  if (name === 'SecurityError') {
    return 'The camera needs a secure page (HTTPS).';
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser cannot use the camera.';
  }
  return 'The camera did not turn on. Check again.';
}

async function checkInternet() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, detail: 'This device is offline.' };
  }
  try {
    await api.get('/health', {
      timeout: 8000,
      params: { t: Date.now() },
    });
    return { ok: true, detail: 'Connected to Assess Hub.' };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return { ok: true, detail: 'Connected to Assess Hub.' };
    }
    return { ok: false, detail: 'Could not reach Assess Hub. Check your internet, then try again.' };
  }
}

async function openCamera(video: HTMLVideoElement) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('Camera unavailable', 'SecurityError');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  });
  video.srcObject = stream;
  await video.play();
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== 'live' || !track.enabled) {
    stopStream(stream);
    throw new Error('Camera is not sending video.');
  }
  if (video.videoWidth === 0) {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Camera did not produce a picture.')), 4000);
      video.onloadeddata = () => {
        window.clearTimeout(timer);
        resolve();
      };
    });
  }
  return stream;
}

export function ExamReadinessGate({
  title,
  durationMinutes,
  alreadyStarted,
  backTo,
  starting,
  onProceed,
}: {
  title: string;
  durationMinutes: number;
  alreadyStarted: boolean;
  backTo: string;
  starting: boolean;
  onProceed: (stream: MediaStream) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handedOff = useRef(false);
  const [videoState, setVideoState] = useState<CheckState>('checking');
  const [videoDetail, setVideoDetail] = useState('Turning the camera on…');
  const [netState, setNetState] = useState<CheckState>('checking');
  const [netDetail, setNetDetail] = useState('Checking the connection…');
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setVideoState('checking');
    setVideoDetail('Turning the camera on…');
    setNetState('checking');
    setNetDetail('Checking the connection…');

    const video = videoRef.current;
    if (!video) return undefined;

    openCamera(video)
      .then((stream) => {
        if (cancelled) {
          stopStream(stream);
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = stream;
        setVideoState('ok');
        setVideoDetail('Video is on.');
      })
      .catch((err) => {
        if (cancelled) return;
        setVideoState('fail');
        setVideoDetail(cameraErrorMessage(err));
      });

    checkInternet().then((result) => {
      if (cancelled) return;
      setNetState(result.ok ? 'ok' : 'fail');
      setNetDetail(result.detail);
    });

    function onOffline() {
      setNetState('fail');
      setNetDetail('This device is offline.');
    }
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener('offline', onOffline);
      if (!handedOff.current) {
        stopStream(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [runId]);

  const ready = videoState === 'ok' && netState === 'ok' && !starting;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a] p-4 text-slate-900">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-wide text-[#1e3a5f]">Online exam</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {alreadyStarted
            ? 'Your timer is already running. Video and internet must be working before you continue.'
            : `Video and internet must be working before the exam starts.${
                durationMinutes > 0 ? ` The ${durationMinutes}-minute timer starts when you proceed.` : ''
              }`}
        </p>

        <div className="mt-5 overflow-hidden rounded-xl bg-slate-900">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full -scale-x-100 object-cover"
          />
        </div>

        <ul className="mt-4 space-y-2">
          <StatusRow label="Video" state={videoState} detail={videoDetail} />
          <StatusRow label="Internet" state={netState} detail={netDetail} />
        </ul>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link to={backTo} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            Back
          </Link>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={starting} onClick={() => setRunId((n) => n + 1)}>
              Check again
            </Button>
            <Button
              disabled={!ready}
              onClick={() => {
                const stream = streamRef.current;
                if (!stream) return;
                handedOff.current = true;
                onProceed(stream);
              }}
            >
              {starting ? 'Starting…' : alreadyStarted ? 'Continue exam' : 'Proceed'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, state, detail }: { label: string; state: CheckState; detail: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
      <span
        className={clsx(
          'mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white',
          state === 'ok' && 'bg-emerald-500',
          state === 'fail' && 'bg-red-500',
          state === 'checking' && 'bg-slate-400'
        )}
      >
        {state === 'ok' ? 'OK' : state === 'fail' ? '!' : '…'}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
    </li>
  );
}
