"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  extractTextFromImageAction,
  findBoundingBoxesForTextAction,
} from "@/actions/gemini-actions";

const VISUALIZATION_STYLES = [
  { value: "highlight", label: "Highlight Style" },
  { value: "box", label: "Bounding Box Style" },
] as const;

type VisualizationStyle = (typeof VISUALIZATION_STYLES)[number]["value"];

const DEFAULT_MODEL = "gemini-2.0-pro-exp-02-05";

const GEMINI_MODELS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.0-pro-exp-02-05", label: "Gemini 2.0 Pro Exp" },
  { value: "gemini-1.5-pro-latest", label: "Gemini 1.5 Pro" },
] as const;

type GeminiModel = (typeof GEMINI_MODELS)[number]["value"];

const COLORS = [
  "#FFD700", // Gold
  "#90EE90", // Light Green
  "#87CEEB", // Sky Blue
  "#FFA07A", // Light Salmon
  "#DDA0DD", // Plum
  "#F0E68C", // Khaki
];

const EXAMPLES = [
  {
    id: 1,
    label: "Find invoice items",
    text: "For each line item in the invoice, extract the quantity, description, unit price, and amount.",
    imagePath: "/examples/invoice.jpg",
  },
  {
    id: 2,
    label: "Extract tax form fields",
    text: "Extract the form number, fiscal start date, fiscal end date, and the plan liabilities beginning of the year and end of the year.",
    imagePath: "/examples/tax_form.jpg",
  },
  {
    id: 3,
    label: "Find multiple phrases",
    text: 'Extract the sections for "richest behaviour intelligence" and "unified risk platform" and their content',
    imagePath: "/examples/text_doc.jpg",
  },
] as const;

type BoundingBoxContent = {
  coordinates: { x0: number; y0: number; x1: number; y1: number };
  text: string;
};

type ExtractedField = {
  label: string;
  value: string;
};

type ProcessingStatus = {
  stage: "idle" | "extracting" | "finding" | "complete" | "error";
  message: string;
};

function ProcessingIndicator({ status }: { status: ProcessingStatus }) {
  if (status.stage === "idle") return null;

  return (
    <div className="rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      {status.stage === "error" ? (
        <div className="text-red-400 text-sm font-mono whitespace-pre-wrap">
          {status.message}
        </div>
      ) : status.stage !== "complete" ? (
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            {status.stage === "extracting"
              ? "Extracting context..."
              : "Extracting bounding boxes..."}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ExtractedFieldsSkeleton() {
  return (
    <div className="h-fit rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4 lg:sticky lg:top-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60">
          Extracted Information
        </h3>
        <div className="text-xs text-white/40">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg bg-[#1C1C1C]/40 p-3"
          >
            <Skeleton className="mt-1 h-3 w-3 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GeminiTest() {
  const [selectedModel, setSelectedModel] =
    useState<GeminiModel>(DEFAULT_MODEL);
  const [visualStyle, setVisualStyle] =
    useState<VisualizationStyle>("highlight");
  const [searchContent, setSearchContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [status, setStatus] = useState<ProcessingStatus>({
    stage: "idle",
    message: "",
  });
  const [boxes, setBoxes] = useState<BoundingBoxContent[]>([]);
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setStatus({ stage: "idle", message: "" });
    }
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview("");
    setStatus({ stage: "idle", message: "" });
    setBoxes([]);
    setExtractedFields([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processImage = async (base64Data: string, content: string) => {
    setStatus({ stage: "extracting", message: "Analyzing image content..." });
    setBoxes([]);
    setExtractedFields([]);

    // Step 1: Extract text fields
    const extractResponse = await extractTextFromImageAction(
      base64Data,
      content
    );

    if (!extractResponse.isSuccess || !extractResponse.data) {
      setStatus({
        stage: "error",
        message: `Failed to extract text from image.\n\nError: ${extractResponse.message}${extractResponse.data?.debug?.rawResponse ? `\n\nDebug:\n${extractResponse.data.debug.rawResponse}` : ""}`,
      });
      return;
    }

    setExtractedFields(extractResponse.data.fields);
    setStatus({ stage: "finding", message: "Locating extracted content..." });

    // Step 2: Find bounding boxes for the extracted values
    const searchTexts = extractResponse.data.fields.map((field) => ({
      value: field.value,
      label: field.label,
    }));
    const boxesResponse = await findBoundingBoxesForTextAction(
      base64Data,
      searchTexts
    );

    if (!boxesResponse.isSuccess || !boxesResponse.data) {
      setStatus({
        stage: "error",
        message: `Failed to locate content in image.\n\nError: ${boxesResponse.message}${boxesResponse.data?.debug?.rawResponse ? `\n\nDebug:\n${boxesResponse.data.debug.rawResponse}` : ""}`,
      });
      return;
    }

    setBoxes(boxesResponse.data.boxes);
    setStatus({ stage: "complete", message: "" });
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

    const [header, base64Data] = imagePreview.split(",");
    await processImage(base64Data, searchContent);
  };

  const handleExampleClick = async (example: (typeof EXAMPLES)[number]) => {
    setSearchContent(example.text);
    setBoxes([]);
    setExtractedFields([]);
    setImagePreview("");

    try {
      const response = await fetch(example.imagePath);
      const blob = await response.blob();
      const filename = example.imagePath.split("/").pop() || "";
      const file = new File([blob], filename, {
        type: "image/jpeg",
      });

      setImage(file);
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        setImagePreview(dataUrl);
        const [header, base64Data] = dataUrl.split(",");
        await processImage(base64Data, example.text);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error loading example image:", error);
      setStatus({
        stage: "error",
        message:
          "Failed to load example image. Please try again or use a different image.",
      });
    }
  };

  useEffect(() => {
    if (!imagePreview || !canvasRef.current || boxes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Calculate dimensions to maintain aspect ratio while fitting the container
      const containerWidth = canvas.parentElement?.clientWidth || img.width;
      const scale = containerWidth / img.width;

      canvas.width = containerWidth;
      canvas.height = img.height * scale;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      boxes.forEach((box, index) => {
        const { coordinates } = box;
        const width = (coordinates.x1 - coordinates.x0) * canvas.width;
        const height = (coordinates.y1 - coordinates.y0) * canvas.height;
        const x = coordinates.x0 * canvas.width;
        const y = coordinates.y0 * canvas.height;
        const color = COLORS[index % COLORS.length];

        ctx.save();

        if (visualStyle === "highlight") {
          ctx.fillStyle = `${color}33`;
          ctx.strokeStyle = `${color}66`;
          ctx.lineWidth = 2;
          ctx.fillRect(x, y, width, height);
          ctx.strokeRect(x, y, width, height);
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);

          const cornerLength = Math.min(width, height) * 0.2;
          ctx.beginPath();

          ctx.moveTo(x, y + cornerLength);
          ctx.lineTo(x, y);
          ctx.lineTo(x + cornerLength, y);

          ctx.moveTo(x + width - cornerLength, y);
          ctx.lineTo(x + width, y);
          ctx.lineTo(x + width, y + cornerLength);

          ctx.moveTo(x + width, y + height - cornerLength);
          ctx.lineTo(x + width, y + height);
          ctx.lineTo(x + width - cornerLength, y + height);

          ctx.moveTo(x + cornerLength, y + height);
          ctx.lineTo(x, y + height);
          ctx.lineTo(x, y + height - cornerLength);

          ctx.stroke();
        }

        ctx.restore();
      });
    };

    img.src = imagePreview;
  }, [imagePreview, boxes, visualStyle]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#1C1C1C] text-white">
      <div className="relative z-10 container mx-auto max-w-7xl p-4">
        <h1 className="mb-8 text-4xl font-medium text-white/90">VLM BB</h1>
        <p className="mb-8 -mt-6 text-lg text-white/60">
          Visual Language Model Bounding Box Detection
        </p>

        <div className="space-y-4">
          <div>
            <Select
              value={selectedModel}
              onValueChange={(value: GeminiModel) => setSelectedModel(value)}
            >
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
          </div>

          <div className="flex flex-col gap-2">
            <div className="relative flex h-[64px] items-center rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm px-4">
              <input
                ref={fileInputRef}
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

          <div className="relative flex flex-col rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm">
            <Textarea
              value={searchContent}
              onChange={(e) => setSearchContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Enter the content you want to find in the image"
              className="min-h-[100px] resize-none border-0 bg-transparent p-4 pb-14 text-lg text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              <Button
                onClick={() => setSearchContent("")}
                className="bg-transparent hover:bg-white/5 text-white/60 border-white/20 text-sm font-medium transition-colors"
                variant="outline"
              >
                Clear
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-blue-500/80 hover:bg-blue-500/90 text-white/90 border-0 rounded-lg h-[38px] text-sm font-medium transition-colors"
              >
                Find Content
              </Button>
            </div>
          </div>

          <div className="-mt-2">
            <h2 className="mb-3 text-center">
              <span className="italic text-sm font-light tracking-wide text-white/40">
                Try these examples
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  onClick={() => handleExampleClick(example)}
                  className="group rounded-lg border border-white/5 bg-[#2A2A2A]/20 px-4 py-3 text-sm text-white/50 transition-colors hover:border-white/10 hover:bg-[#2A2A2A]/40 hover:text-white/90"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <ProcessingIndicator status={status} />

          {imagePreview && status.stage === "complete" && (
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <div className="rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4 animate-in fade-in duration-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white/60">
                      Document Preview
                    </h3>
                    <Select
                      value={visualStyle}
                      onValueChange={(value: VisualizationStyle) =>
                        setVisualStyle(value)
                      }
                    >
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
                  <canvas
                    ref={canvasRef}
                    className="h-auto w-full object-contain"
                  />
                </div>
              </div>

              {extractedFields.length > 0 && (
                <div className="h-fit rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm p-4 lg:sticky lg:top-4 animate-in slide-in-from-right-4 duration-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-white/60">
                      Extracted Information
                    </h3>
                    <div className="text-xs text-white/40">
                      {extractedFields.length} items found
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {extractedFields.map((field, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded-lg bg-[#1C1C1C]/40 p-3 transition-colors hover:bg-[#1C1C1C]/60"
                      >
                        <div
                          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white/60">
                            {field.label}
                          </p>
                          <p className="text-sm text-white/90">{field.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
