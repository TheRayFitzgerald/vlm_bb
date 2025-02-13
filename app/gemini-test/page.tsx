"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findContentCoordinatesWithGeminiAction } from "@/actions/gemini-actions";

const VISUALIZATION_STYLES = [
  { value: "highlight", label: "Highlight Style" },
  { value: "box", label: "Bounding Box Style" },
] as const;

type VisualizationStyle = typeof VISUALIZATION_STYLES[number]["value"];

const GEMINI_MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  {
    value: "gemini-2.0-flash-lite-preview-02-05",
    label: "Gemini 2.0 Flash Lite",
  },
  { value: "gemini-2.0-pro-exp-02-05", label: "Gemini 2.0 Pro Exp" },
  { value: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro" },
  { value: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash" },
  { value: "gemini-1.5-flash-8b-latest", label: "Gemini 1.5 Flash 8B" },
];

const COLORS = [
  "#FFD700", // Gold
  "#90EE90", // Light Green
  "#87CEEB", // Sky Blue
  "#FFA07A", // Light Salmon
  "#DDA0DD", // Plum
  "#F0E68C", // Khaki
];

export default function GeminiTest() {
  const [selectedModel, setSelectedModel] = useState(GEMINI_MODELS[0].value);
  const [visualStyle, setVisualStyle] = useState<VisualizationStyle>("highlight");
  const [searchContent, setSearchContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [coordinates, setCoordinates] = useState<Array<{ x0: number; y0: number; x1: number; y1: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview("");
    setResult("");
    setCoordinates([]);
  };

  const handleSubmit = async () => {
    if (!image || !imagePreview) {
      alert("Please select an image");
      return;
    }

    if (!searchContent.trim()) {
      alert("Please enter content to search for");
      return;
    }

    setResult("Processing...");
    
    // Extract base64 data and mime type from the data URL
    const [header, base64Data] = imagePreview.split(",");
    const mimeType = header.match(/data:(.*?);/)?.[1] || "image/jpeg";

    const response = await findContentCoordinatesWithGeminiAction(
      base64Data,
      searchContent
    );

    if (response.isSuccess && response.data) {
      setResult(
        `Found ${response.data.coordinates.length} matches for: "${response.data.text}"\n\nAPI Response:\n${JSON.stringify(response, null, 2)}`
      );
      setCoordinates(response.data.coordinates);
    } else {
      setResult(`Error: ${response.message}`);
    }
  };

  useEffect(() => {
    if (!imagePreview || !canvasRef.current || coordinates.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size with padding
      canvas.width = img.width + 100;
      canvas.height = img.height + 100;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image with offset
      ctx.drawImage(img, 80, 20);

      // Draw bounding boxes based on selected style
      coordinates.forEach((box, index) => {
        const width = (box.x1 - box.x0) * img.width;
        const height = (box.y1 - box.y0) * img.height;
        const x = box.x0 * img.width + 80;
        const y = box.y0 * img.height + 20;
        const color = COLORS[index % COLORS.length];

        ctx.save();

        if (visualStyle === "highlight") {
          // Highlight style
          ctx.fillStyle = `${color}33`; // 20% opacity
          ctx.strokeStyle = `${color}66`; // 40% opacity
          ctx.lineWidth = 2;

          // Draw highlight background
          ctx.fillRect(x, y, width, height);

          // Draw highlight border
          ctx.strokeRect(x, y, width, height);
        } else {
          // Box style
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          
          // Draw box
          ctx.strokeRect(x, y, width, height);
          
          // Draw corner marks
          const cornerLength = Math.min(width, height) * 0.2;
          ctx.beginPath();
          
          // Top-left corner
          ctx.moveTo(x, y + cornerLength);
          ctx.lineTo(x, y);
          ctx.lineTo(x + cornerLength, y);
          
          // Top-right corner
          ctx.moveTo(x + width - cornerLength, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width, y + cornerLength);
          
          // Bottom-right corner
          ctx.moveTo(x + width, y + height - cornerLength);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x + width - cornerLength, y + height);
          
          // Bottom-left corner
          ctx.moveTo(x + cornerLength, y + height);
          ctx.lineTo(x, y + height);
          ctx.lineTo(x, y + height - cornerLength);
          
          ctx.stroke();
        }

        ctx.restore();
      });
    };

    img.src = imagePreview;
  }, [imagePreview, coordinates, visualStyle]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#1C1C1C] text-white">
      <div className="relative z-10 container mx-auto max-w-4xl p-4">
        <h1 className="mb-8 text-4xl font-medium text-white/90">
          VLM BB
        </h1>

        <div className="space-y-6">
          <div className="flex gap-4">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="flex-1 bg-[#2A2A2A]/80 border-0 text-white/90">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent className="bg-[#2A2A2A] text-white/90">
                {GEMINI_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={visualStyle} onValueChange={(value: VisualizationStyle) => setVisualStyle(value)}>
              <SelectTrigger className="w-[200px] bg-[#2A2A2A]/80 border-0 text-white/90">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent className="bg-[#2A2A2A] text-white/90">
                {VISUALIZATION_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative flex h-[64px] items-center rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm px-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-white/90 bg-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white/90 hover:file:bg-white/20"
              />
            </div>
            <Button 
              onClick={clearImage} 
              variant="outline" 
              className="bg-transparent text-white/60 border-white/20 hover:bg-white/5 hover:text-white/90 transition-colors"
            >
              Clear Image
            </Button>
          </div>

          <div className="relative flex h-[48px] items-center rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm">
            <Input
              value={searchContent}
              onChange={(e) => setSearchContent(e.target.value)}
              placeholder="Enter the content you want to find in the image"
              className="w-full border-0 bg-transparent px-6 text-lg text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="absolute right-2">
              <Button 
                onClick={handleSubmit}
                className="bg-blue-500/80 hover:bg-blue-500/90 text-white/90 border-0 rounded-lg px-6 h-[38px] text-sm font-medium transition-colors"
              >
                Find Content
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="mb-3 text-center">
              <span className="italic text-sm font-light tracking-wide text-white/40">
                Try finding these examples
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSearchContent("richest behaviour intelligence")}
                className="group rounded-lg border border-white/5 bg-[#2A2A2A]/20 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/10 hover:bg-[#2A2A2A]/40 hover:text-white/90"
              >
                <div className="text-xs text-white/30 group-hover:text-white/50">Example 1</div>
                &ldquo;richest behaviour intelligence&rdquo;
              </button>
              <button
                onClick={() => setSearchContent("unified risk platform")}
                className="group rounded-lg border border-white/5 bg-[#2A2A2A]/20 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/10 hover:bg-[#2A2A2A]/40 hover:text-white/90"
              >
                <div className="text-xs text-white/30 group-hover:text-white/50">Example 2</div>
                &ldquo;unified risk platform&rdquo;
              </button>
              <button
                onClick={() => setSearchContent("OCR is now solved")}
                className="group rounded-lg border border-white/5 bg-[#2A2A2A]/20 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/10 hover:bg-[#2A2A2A]/40 hover:text-white/90"
              >
                <div className="text-xs text-white/30 group-hover:text-white/50">Example 3</div>
                &ldquo;OCR is now solved&rdquo;
              </button>
            </div>
          </div>

          {result && (
            <div className="rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4">
              <pre className="whitespace-pre-wrap text-white/80 text-sm">{result}</pre>
            </div>
          )}

          {imagePreview && (
            <div className="mt-4 rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4">
              <canvas ref={canvasRef} className="h-auto max-w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
