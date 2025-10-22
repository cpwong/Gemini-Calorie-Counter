
export interface BoundingBox {
  x: number; // top-left x (normalized 0-1)
  y: number; // top-left y (normalized 0-1)
  width: number; // width (normalized 0-1)
  height: number; // height (normalized 0-1)
}

// Represents a box drawn by the user, which can later be populated with analysis results
export interface UserBox {
  id: string;
  boundingBox: BoundingBox;
  name?: string;
  calories?: number;
}


// Represents the data returned by the API for a single identified item
export interface IdentifiedItem {
    id: string; // Corresponds to the id of a UserBox
    name: string;
    calories: number;
}

// The overall result from the Gemini API analysis for identification
export type AnalysisResult = IdentifiedItem[];


// Represents a single item found during the initial detection phase
export interface DetectedItem {
    boundingBox: BoundingBox;
}

// The overall result from the initial detection phase
export type DetectionResult = DetectedItem[];
