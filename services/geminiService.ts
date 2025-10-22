
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, UserBox, DetectionResult } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const boundingBoxSchema = {
    type: Type.OBJECT,
    properties: {
      x: { type: Type.NUMBER },
      y: { type: Type.NUMBER },
      width: { type: Type.NUMBER },
      height: { type: Type.NUMBER },
    },
    required: ["x", "y", "width", "height"],
};

const detectedItemSchema = {
    type: Type.OBJECT,
    properties: {
      boundingBox: boundingBoxSchema,
    },
    required: ["boundingBox"],
};

export async function detectFoodItems(base64ImageData: string, mimeType: string): Promise<DetectionResult> {
    const prompt = `
      Analyze the provided image to locate all distinct food items.
      For each item found, provide a bounding box that tightly encloses it.
      The bounding box should be defined by normalized coordinates (x, y, width, height) where (x, y) is the top-left corner.
      Return a JSON array of objects, where each object contains a 'boundingBox' property.
      If no food items are found, return an empty array.
    `;
  
    const imagePart = {
      inlineData: { data: base64ImageData, mimeType: mimeType },
    };
    
    const textPart = { text: prompt };
  
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: detectedItemSchema,
        },
      },
    });
  
    const jsonString = response.text.trim();
    if (!jsonString) {
      return [];
    }
  
    try {
      const parsedJson = JSON.parse(jsonString);
      return parsedJson as DetectionResult;
    } catch (error) {
      console.error("Failed to parse JSON response for detection:", error);
      throw new Error("The API returned an invalid response format during detection.");
    }
}


const identifiedItemSchema = {
  type: Type.OBJECT,
  properties: {
    id: {
      type: Type.STRING,
      description: "The unique ID of the corresponding input bounding box.",
    },
    name: {
      type: Type.STRING,
      description: "The name of the food item identified in the box.",
    },
    calories: {
      type: Type.INTEGER,
      description: "The estimated number of calories for this food item.",
    },
  },
  required: ["id", "name", "calories"],
};

export async function identifyItemsInBoxes(base64ImageData: string, mimeType: string, boxes: UserBox[]): Promise<AnalysisResult> {
  const boxesForPrompt = boxes.map(({ id, boundingBox }) => ({ id, boundingBox }));
  
  const prompt = `
    Analyze the food items within the specific regions of this image that I provide.
    I will give you a JSON array of objects, where each object has an 'id' and a 'boundingBox'.
    The boundingBox coordinates are normalized (0-1).
    For each object, identify the single main food item inside its corresponding bounding box.
    Return a JSON array where each element contains the original 'id', the identified food 'name',
    and your best estimate for the 'calories'.
    If a box contains no identifiable food, omit it from the result array.
    Here are the bounding boxes: ${JSON.stringify(boxesForPrompt)}
  `;

  const imagePart = {
    inlineData: {
      data: base64ImageData,
      mimeType: mimeType,
    },
  };
  
  const textPart = { text: prompt };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: identifiedItemSchema,
      },
    },
  });

  const jsonString = response.text.trim();
  if (!jsonString) {
    return [];
  }
  
  try {
    const parsedJson = JSON.parse(jsonString);
    return parsedJson as AnalysisResult;
  } catch (error) {
    console.error("Failed to parse JSON response:", error);
    throw new Error("The API returned an invalid response format.");
  }
}
