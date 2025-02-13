"use client";

import { ExtractedCitation } from "@/types";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useState, useRef } from "react";

interface HighlightedWebpageProps {
  citation: ExtractedCitation;
}

export function HighlightedWebpage({ citation }: HighlightedWebpageProps) {
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [showMagnifier, setShowMagnifier] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const magnifierSize = 250;
  const zoom = 1.3;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate boundaries
    const halfMagnifier = magnifierSize / 2;
    const boundedX = Math.min(Math.max(halfMagnifier, x), rect.width - halfMagnifier);
    const boundedY = Math.min(Math.max(halfMagnifier, y), rect.height - halfMagnifier);

    setMagnifierPosition({ x: boundedX, y: boundedY });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="-mt-1 size-6 shrink-0">
          <Eye className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[80vh] max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(citation.url, '_blank')}
            className="text-sm mr-8"
          >
            View webpage
          </Button>
        </div>
        <div className="h-full overflow-auto">
          <div 
            className="relative" 
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setShowMagnifier(true)}
            onMouseLeave={() => setShowMagnifier(false)}
          >
            <img
              ref={imageRef}
              src={citation.screenshotUrl}
              alt="Webpage screenshot"
              className="w-full"
            />
            {citation.highlights?.map((highlight, index) => (
              <div
                key={index}
                className="absolute border-2 border-yellow-400 bg-yellow-400/20"
                style={{
                  left: `${highlight.bbox.x0 * 100}%`,
                  top: `${highlight.bbox.y0 * 100}%`,
                  width: `${(highlight.bbox.x1 - highlight.bbox.x0) * 100}%`,
                  height: `${(highlight.bbox.y1 - highlight.bbox.y0) * 100}%`,
                }}
              />
            ))}
            {showMagnifier && (
              <div
                className="pointer-events-none absolute rounded-full border border-gray-200 bg-white shadow-lg"
                style={{
                  left: magnifierPosition.x - magnifierSize / 2,
                  top: magnifierPosition.y - magnifierSize / 2,
                  width: magnifierSize,
                  height: magnifierSize,
                  overflow: 'hidden'
                }}
              >
                <div
                  className="absolute"
                  style={{
                    left: -magnifierPosition.x * zoom + magnifierSize / 2,
                    top: -magnifierPosition.y * zoom + magnifierSize / 2,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    src={citation.screenshotUrl}
                    alt="Magnified view"
                    className="max-w-none"
                    style={{
                      width: imageRef.current?.width,
                      height: imageRef.current?.height
                    }}
                  />
                  {citation.highlights?.map((highlight, index) => (
                    <div
                      key={`magnified-${index}`}
                      className="absolute border-2 border-yellow-400 bg-yellow-400/20"
                      style={{
                        left: `${highlight.bbox.x0 * 100}%`,
                        top: `${highlight.bbox.y0 * 100}%`,
                        width: `${(highlight.bbox.x1 - highlight.bbox.x0) * 100}%`,
                        height: `${(highlight.bbox.y1 - highlight.bbox.y0) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
