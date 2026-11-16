"use client";

import { useCallback, useState, useRef } from "react";
import {
  Download,
  FileText,
  ImageOff,
  Loader2,
  Maximize2,
  Play,
  Pause,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { downloadMediaMessage } from "@/lib/media/download";
import { useMediaBlobUrl } from "@/hooks/use-media-blob-url";

/**
 * The media renderers behind `<MessageBubble>`'s image / video / audio /
 * document cases. Split out of message-bubble.tsx so that file stays a
 * thin content switch — everything here is about the two affordances
 * issue #373 asked for: open it full-size, and save it.
 *
 * Both are less trivial than they look, because the two flavours of
 * `media_url` behave differently in the browser. See
 * `@/lib/media/blob-cache` for the proxy-vs-bucket split and
 * `@/lib/media/download` for why `<a download>` alone isn't enough.
 */

type Translator = ReturnType<typeof useTranslations>;

/** Inline media size cap, shared so the four bubbles can't drift apart. */
const MEDIA_BOX = "max-h-64 max-w-60";

export function MediaUnavailable({
  label,
  t,
}: {
  label: string;
  t: Translator;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <ImageOff className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{t("unavailable", { label })}</span>
    </div>
  );
}

/**
 * Kicks off a download and reports failure as a toast. Kept as a hook so
 * each bubble owns its own in-flight state — a slow 16 MB video shouldn't
 * put a spinner on every other attachment in the thread.
 */
function useMediaDownload(message: Message, t: Translator) {
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadMediaMessage(message);
    } catch {
      toast.error(t("downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }, [downloading, message, t]);

  return { downloading, download };
}

function MediaActionButton({
  icon: Icon,
  label,
  onClick,
  busy = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      // Own surface rather than inheriting the bubble's, so the same button
      // reads on the muted inbound fill, the primary outbound fill, and on
      // top of an arbitrary photo.
      className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function MediaPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-muted">
      {children}
    </div>
  );
}

export function MediaImageBubble({
  message,
  onOpen,
  t,
}: {
  message: Message;
  /** Opens the thread's lightbox on this message. Omitted ⇒ not clickable. */
  onOpen?: () => void;
  t: Translator;
}) {
  const { src, status } = useMediaBlobUrl(message.media_url);
  // The fetch can succeed and the bytes still not be a decodable image.
  const [broken, setBroken] = useState(false);
  const { downloading, download } = useMediaDownload(message, t);

  if (status === "error" || broken) {
    return (
      <MediaPlaceholder>
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </MediaPlaceholder>
    );
  }

  if (status !== "ready" || !src) {
    return (
      <MediaPlaceholder>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </MediaPlaceholder>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={t("imageAlt")}
      className={cn(MEDIA_BOX, "rounded-lg object-contain")}
      onError={() => setBroken(true)}
    />
  );

  return (
    <div className="group/media relative w-fit">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={t("viewImage")}
          className="block cursor-zoom-in rounded-lg outline-none ring-offset-2 ring-offset-transparent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {image}
        </button>
      ) : (
        image
      )}
      {/* Hover-only: on touch there is no hover, but tapping the image opens
          the viewer, which carries a full-size Download button. */}
      <div className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover/media:opacity-100 group-focus-within/media:opacity-100">
        <MediaActionButton
          icon={Download}
          label={t("download")}
          onClick={download}
          busy={downloading}
        />
      </div>
    </div>
  );
}

export function MediaVideoBubble({
  message,
  onOpen,
  t,
}: {
  message: Message;
  onOpen?: () => void;
  t: Translator;
}) {
  const { downloading, download } = useMediaDownload(message, t);

  return (
    <div className="relative w-fit">
      {/* Plain URL, not a blob: the element should stream rather than wait
          for up to 16 MB to land. */}
      <video
        src={message.media_url}
        controls
        preload="metadata"
        className={cn(MEDIA_BOX, "rounded-lg")}
      />
      {/* Top-right, clear of the native controls — and always visible, since
          expanding is the only way to watch a clip capped at 15rem wide and
          a touch device gets no hover. */}
      <div className="absolute right-2 top-2 flex gap-1">
        {onOpen && (
          <MediaActionButton
            icon={Maximize2}
            label={t("expandVideo")}
            onClick={onOpen}
          />
        )}
        <MediaActionButton
          icon={Download}
          label={t("download")}
          onClick={download}
          busy={downloading}
        />
      </div>
    </div>
  );
}

export function MediaAudioBubble({
  message,
  t,
}: {
  message: Message;
  t: Translator;
}) {
  const { downloading, download } = useMediaDownload(message, t);
  const { src: blobSrc, status } = useMediaBlobUrl(message.media_url);

  // Audio element reference & playback states
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loadError, setLoadError] = useState(false);

  // Effective src: prefer blob URL (loads securely in mobile memory with credentials), fallback to direct media_url
  const effectiveSrc = blobSrc || message.media_url;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio playback issue:", err);
          setLoadError(true);
        });
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-1.5 p-2 rounded-xl bg-card border border-border shadow-xs min-w-[240px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={effectiveSrc}
        preload="metadata"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setLoadError(true)}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        {/* Big Touch-friendly Play/Pause button */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer"
          title={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Progress scrub bar & time */}
        <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 accent-primary bg-muted rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed toggle button (1x / 1.5x / 2x) */}
        <button
          type="button"
          onClick={cycleSpeed}
          className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Playback speed"
        >
          {speed}x
        </button>

        {/* Download button */}
        <MediaActionButton
          icon={Download}
          label={t("download")}
          onClick={download}
          busy={downloading}
        />
      </div>

      {loadError && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-between pt-0.5">
          <span>Mobile format note</span>
          <button
            type="button"
            onClick={download}
            className="underline font-medium hover:text-foreground"
          >
            Download to play
          </button>
        </div>
      )}
    </div>
  );
}

export function MediaDocumentBubble({
  message,
  t,
}: {
  message: Message;
  t: Translator;
}) {
  const { downloading, download } = useMediaDownload(message, t);

  return (
    <div className="flex items-center gap-2">
      <a
        href={message.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted"
      >
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="truncate">{message.content_text || t("document")}</span>
      </a>
      <MediaActionButton
        icon={Download}
        label={t("download")}
        onClick={download}
        busy={downloading}
      />
    </div>
  );
}
