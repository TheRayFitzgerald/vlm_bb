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
import { Card } from "@/components/ui/card";
import { findContentCoordinatesWithGeminiAction } from "@/actions/gemini-actions";

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

      // Draw bounding boxes as highlights
      coordinates.forEach((box, index) => {
        const width = (box.x1 - box.x0) * img.width;
        const height = (box.y1 - box.y0) * img.height;

        // Create highlight effect
        ctx.save();

        // Set highlight style
        ctx.fillStyle = `${COLORS[index % COLORS.length]}33`; // 20% opacity
        ctx.strokeStyle = `${COLORS[index % COLORS.length]}66`; // 40% opacity
        ctx.lineWidth = 2;

        // Draw highlight background
        ctx.fillRect(
          box.x0 * img.width + 80,
          box.y0 * img.height + 20,
          width,
          height
        );

        // Draw highlight border
        ctx.strokeRect(
          box.x0 * img.width + 80,
          box.y0 * img.height + 20,
          width,
          height
        );

        ctx.restore();
      });
    };

    img.src = imagePreview;
  }, [imagePreview, coordinates]);

  return (
    <div className="container mx-auto max-w-4xl p-4">
      <h1 className="mb-4 text-2xl font-bold">VLM Citation Demo</h1>

      <div className="space-y-4">
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger>
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {GEMINI_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="rounded border p-2"
          />
          <Button onClick={clearImage} variant="outline">
            Clear Image
          </Button>
        </div>

        <Input
          value={searchContent}
          onChange={(e) => setSearchContent(e.target.value)}
          placeholder="Enter the content you want to find in the image"
          className="w-full"
        />

        <Button onClick={handleSubmit}>Find Content</Button>

        {result && (
          <Card className="p-4">
            <pre className="whitespace-pre-wrap">{result}</pre>
          </Card>
        )}

        {imagePreview && (
          <div className="mt-4">
            <canvas ref={canvasRef} className="h-auto max-w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
