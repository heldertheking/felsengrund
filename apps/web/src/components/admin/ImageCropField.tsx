import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-kf-ink-muted';
const fileInputClass =
  'mt-1 w-full rounded-lg border border-kf-edge bg-kf-surface px-3 py-2 text-sm text-kf-ink file:mr-3 file:rounded-md file:border-0 file:bg-kf-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white';
const secondaryButtonClass =
  'rounded-lg border border-kf-edge px-4 py-2 text-sm font-semibold text-kf-ink transition hover:border-kf-accent hover:text-kf-accent';

// Share of the editor the crop frame may take; the rest shows what the crop leaves out.
const FRAME_SHARE = 0.7;
const MAX_ZOOM_FACTOR = 4;

interface ImageCropFieldProps {
  label: string;
  /** Width / height of the output, e.g. 16 / 9 for offers or 1 for podcast covers. */
  aspect: number;
  /** Longest edge of the cropped output in px (never upscaled). */
  maxOutputSize: number;
  /** URL of the already stored image, shown until a new one is cropped. */
  currentUrl?: string;
  /** Receives the cropped file, or null when the selection is cleared. */
  onChange: (file: File | null) => void;
}

export function ImageCropField({ label, aspect, maxOutputSize, currentUrl, onChange }: ImageCropFieldProps) {
  const [source, setSource] = useState<{ url: string; name: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs are not garbage collected, so release them when replaced or unmounted.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useEffect(() => () => void (source && URL.revokeObjectURL(source.url)), [source]);

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // Picking the same file again must re-open the editor.
    if (file) setSource({ url: URL.createObjectURL(file), name: file.name });
  }

  function handleConfirm(file: File) {
    setPreview(URL.createObjectURL(file));
    setSource(null);
    onChange(file);
  }

  function handleClear() {
    setPreview(null);
    onChange(null);
  }

  const shown = preview ?? currentUrl;

  return (
    <div>
      <label className={labelClass}>{label}</label>
      {shown && (
        <img
          src={shown}
          alt=""
          style={{ aspectRatio: aspect }}
          className="mt-2 h-24 w-auto rounded-lg border border-kf-edge object-cover"
        />
      )}
      <input type="file" accept="image/*" onChange={handlePick} className={fileInputClass} />
      {preview && (
        <button type="button" onClick={handleClear} className="mt-2 text-xs font-semibold text-kf-accent underline">
          Neues Bild verwerfen
        </button>
      )}
      {source && (
        <CropDialog
          src={source.url}
          fileName={source.name}
          aspect={aspect}
          maxOutputSize={maxOutputSize}
          onCancel={() => setSource(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

interface CropDialogProps {
  src: string;
  fileName: string;
  aspect: number;
  maxOutputSize: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}

function CropDialog({ src, fileName, aspect, maxOutputSize, onCancel, onConfirm }: CropDialogProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  // 1 = the image just covers the frame (the smallest allowed crop), 4 = four times closer.
  const [zoomFactor, setZoomFactor] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setStage({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // The frame is smaller than the stage on purpose: the image keeps showing (dimmed) outside it,
  // so the editor can see exactly what the crop cuts off while positioning.
  const frameWidth = Math.min(stage.width * FRAME_SHARE, stage.height * FRAME_SHARE * aspect);
  const cropSize = frameWidth > 0 ? { width: frameWidth, height: frameWidth / aspect } : undefined;

  // react-easy-crop sizes the image to fit the whole stage and zooms relative to that, which is bigger
  // than the frame. Rescale so the lowest zoom is "image covers the frame": an image that matches the
  // frame's aspect then fits the bright area exactly, and anything else still fills it without bars.
  let baseZoom = 1;
  if (natural && cropSize) {
    const fit =
      natural.width > stage.width || natural.height > stage.height
        ? Math.min(stage.width / natural.width, stage.height / natural.height)
        : 1;
    baseZoom = Math.max(cropSize.width / (natural.width * fit), cropSize.height / (natural.height * fit));
  }

  const handleCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function handleConfirm() {
    if (!area) return;
    setBusy(true);
    setError(null);
    try {
      onConfirm(await cropToFile(src, area, fileName, maxOutputSize));
    } catch {
      setError('Das Bild konnte nicht zugeschnitten werden.');
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bild zuschneiden"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="flex max-h-full w-full max-w-4xl flex-col gap-4 rounded-2xl bg-kf-surface p-5 shadow-xl">
        <div>
          <h3 className="text-lg font-bold text-kf-ink">Bild zuschneiden</h3>
          <p className="text-sm text-kf-ink-muted">
            Der helle Bereich bleibt erhalten, der abgedunkelte Rand wird abgeschnitten. Bild ziehen zum Verschieben,
            Regler oder Mausrad zum Zoomen.
          </p>
        </div>

        <div ref={stageRef} className="relative h-[55vh] min-h-64 overflow-hidden rounded-lg bg-kf-ink">
          <Cropper
            image={src}
            crop={crop}
            zoom={baseZoom * zoomFactor}
            aspect={aspect}
            cropSize={cropSize}
            minZoom={baseZoom}
            maxZoom={baseZoom * MAX_ZOOM_FACTOR}
            showGrid
            onCropChange={setCrop}
            onZoomChange={(value) => setZoomFactor(value / baseZoom)}
            onMediaLoaded={(media) => setNatural({ width: media.naturalWidth, height: media.naturalHeight })}
            onCropComplete={handleCropComplete}
            style={{ cropAreaStyle: { border: '2px solid white', color: 'rgba(0, 0, 0, 0.55)' } }}
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-kf-ink-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM_FACTOR}
            step={0.01}
            value={zoomFactor}
            onChange={(e) => setZoomFactor(Number(e.target.value))}
            className="flex-1 accent-kf-accent"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !area}
            className="rounded-lg bg-kf-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? 'Wird zugeschnitten …' : 'Zuschnitt übernehmen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/** Cuts `area` (source pixels) out of the image and downsizes it to `maxOutputSize` on the long edge. */
async function cropToFile(src: string, area: Area, originalName: string, maxOutputSize: number): Promise<File> {
  const image = await loadImage(src);
  const scale = Math.min(1, maxOutputSize / Math.max(area.width, area.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas not supported');
  // JPEG has no alpha; flatten transparent PNGs onto white instead of black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Export failed');

  // The API derives the stored extension from the file name, so it must match the JPEG output.
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
