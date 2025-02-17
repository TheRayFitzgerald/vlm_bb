"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ActionState } from "@/types";

interface BoundingBoxContent {
  coordinates: { x0: number; y0: number; x1: number; y1: number };
  text: string;
}

interface ExtractedField {
  label: string;
  value: string;
}

interface SearchContext {
  value: string;
  label: string;
}

export async function extractTextFromImageAction(
  base64Image: string,
  instruction: string
): Promise<
  ActionState<{ fields: ExtractedField[]; debug?: { rawResponse: string } }>
> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-pro-exp-02-05",
    });

    const prompt = `
    
      Given the following INSTRUCTION: ${instruction}.

      Your task is to extract ONLY the specific information requested in the above instruction.

      Rules for extraction:
      1. Focus exclusively on finding the information mentioned in the instruction
      2. Extract the complete text for each requested field
      3. Be precise with numbers, dates, and identifiers
      4. Include any relevant units or symbols
      5. If multiple instances exist, choose the clearest one

      Format your response as key-value pairs:
      [label]: [extracted text]

      Example format:
      Form Number: 5500-SF
      Start Date: 01/01/2023

      IMPORTANT:
      - Only extract information specifically requested in the instruction
      - Do not include any additional fields or explanatory text
      - Return exactly one value per requested field
      - Maintain the exact [label]: [value] format`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    // Parse the response into fields
    const fields = text
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const [label, ...valueParts] = line.split(":");
        return {
          label: label.trim(),
          value: valueParts.join(":").trim(),
        };
      });

    if (fields.length === 0) {
      return {
        isSuccess: false,
        message: "No fields extracted from the image",
        data: {
          fields: [],
          debug: { rawResponse: text },
        },
      };
    }

    return {
      isSuccess: true,
      message: "Successfully extracted text from image",
      data: {
        fields,
        debug: { rawResponse: text },
      },
    };
  } catch (error) {
    console.error("Error extracting text:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to extract text",
      data: {
        fields: [],
        debug: {
          rawResponse: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}

export async function findBoundingBoxesForTextAction(
  base64Image: string,
  searchTexts: SearchContext[]
): Promise<
  ActionState<{ boxes: BoundingBoxContent[]; debug?: { rawResponse: string } }>
> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-pro-exp-02-05",
    });

    const contextList = searchTexts
      .map(({ label, value }) => `"${value}" (from field "${label}")`)
      .join("\n");

    const prompt = `TASK: Find the exact location of each value in the image.

VALUES TO LOCATE:
${contextList}

OUTPUT FORMAT:
Return bounding boxes as arrays: [ymin, xmin, ymax, xmax, "matched text"]
Coordinates must be in range 0-1000

RULES:
1. Create ONE bounding box for each value listed above
2. Box must contain the COMPLETE value text
3. Box must be as TIGHT as possible around the value
4. Use the field name (in parentheses) to identify the correct text
5. Only box the value itself, not its label or surrounding text
6. If multiple instances exist, choose the clearest one

EXAMPLE:
For value "January 15, 2024" (from field "Start Date"):
[120, 450, 150, 600, "January 15, 2024"]

IMPORTANT:
- Return exactly one array per value
- Include the exact matched text in quotes
- Only output the arrays, no other text
- Ensure coordinates are precise`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();

    // Extract coordinates and text
    const regex =
      /\[?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*\]?/g;
    const matches = Array.from(text.matchAll(regex));

    if (matches.length === 0) {
      return {
        isSuccess: false,
        message: "No bounding boxes found in response",
        data: {
          boxes: [],
          debug: { rawResponse: text },
        },
      };
    }

    const boxes = matches.map((match) => ({
      coordinates: {
        x0: parseInt(match[2]) / 1000,
        y0: parseInt(match[1]) / 1000,
        x1: parseInt(match[4]) / 1000,
        y1: parseInt(match[3]) / 1000,
      },
      text: match[5],
    }));

    return {
      isSuccess: true,
      message: "Successfully found bounding boxes",
      data: {
        boxes,
        debug: { rawResponse: text },
      },
    };
  } catch (error) {
    console.error("Error finding bounding boxes:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to find bounding boxes",
      data: {
        boxes: [],
        debug: {
          rawResponse: error instanceof Error ? error.message : "Unknown error",
        },
      },
    };
  }
}
