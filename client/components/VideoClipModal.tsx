import React from "react";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";

interface VideoClipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string;
  nomeEsercizio?: string;
  cueEsecutiva?: string;
  patternMotorio?: string;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}?autoplay=1&playsinline=1&rel=0`;
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&playsinline=1&rel=0`;
  const youtuMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (youtuMatch) return `https://www.youtube.com/embed/${youtuMatch[1]}?autoplay=1&playsinline=1&rel=0`;
  return null;
}

export function VideoClipModal({
  open,
  onOpenChange,
  videoUrl = "",
  nomeEsercizio = "Esercizio",
  cueEsecutiva,
  patternMotorio,
}: VideoClipModalProps) {
  const embedUrl = getYouTubeEmbedUrl(videoUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-zinc-950 border-2 border-zinc-800 text-white shadow-2xl rounded-3xl">
        {/* Header con titolo e chiusura */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <div className="min-w-0 pr-2">
            <DialogTitle className="text-sm font-black text-white truncate tracking-tight">
              {nomeEsercizio}
            </DialogTitle>
            {patternMotorio && (
              <p className="text-[11px] font-bold text-[#e3ff00] truncate uppercase tracking-wider">
                {patternMotorio}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Video Player in Overlay (Loop e Autoplay) */}
        <div className="relative w-full aspect-video sm:aspect-4/3 bg-black flex items-center justify-center">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={nomeEsercizio}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          ) : (
            <div className="text-center p-6 text-zinc-400">
              <p className="font-semibold text-sm">Video dimostrativo non disponibile.</p>
            </div>
          )}
        </div>

        {/* Box Cue Esecutiva del Coach */}
        {cueEsecutiva && (
          <div className="p-3.5 bg-zinc-900 border-t border-zinc-800">
            <div className="flex items-start gap-2">
              <Sparkles className="size-4 text-[#e3ff00] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-black text-[#e3ff00] uppercase tracking-wider block mb-0.5">
                  Cue Esecutiva Coach:
                </span>
                <span className="text-zinc-200 font-medium leading-relaxed">
                  {cueEsecutiva}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer con Link Diretto YouTube opzionale */}
        {videoUrl && (
          <div className="px-4 py-2.5 bg-zinc-950 flex items-center justify-between text-xs border-t border-zinc-900">
            <span className="text-zinc-500 font-medium">Riproduzione rapida in-place</span>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#e3ff00] hover:underline font-bold"
            >
              Apri su YouTube <ExternalLink className="size-3" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
