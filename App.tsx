
import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ImageAnalysisDisplay } from './components/ImageAnalysisDisplay';
import { CameraView } from './components/CameraView';
import { identifyItemsInBoxes, detectFoodItems } from './services/geminiService';
import type { UserBox } from './types';
import { CameraIcon, SparklesIcon } from './components/icons/Icons';

type AppStage = 'upload' | 'camera' | 'processing' | 'editing' | 'analyzing' | 'results';
const uuid = () => crypto.randomUUID();

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>('upload');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [userBoxes, setUserBoxes] = useState<UserBox[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setStage('processing'); 
    setError(null);
    setUserBoxes([]);
    setImageUrl(null);
    setImageDimensions(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const originalUrl = e.target?.result as string;
      
      const img = new Image();
      img.onload = async () => {
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Failed to process image. Could not get canvas context.');
          setStage('upload');
          return;
        }
        ctx.drawImage(img, 0, 0);
        
        const convertedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64Data = convertedDataUrl.split(',')[1];
        
        try {
            const detectedItems = await detectFoodItems(base64Data, 'image/jpeg');
            const initialBoxes = detectedItems.map(item => ({
                id: uuid(),
                boundingBox: item.boundingBox,
            }));
            setUserBoxes(initialBoxes);
            setImageUrl(convertedDataUrl);
            setStage('editing');
        } catch (err) {
            console.error(err);
            setError('Failed to auto-detect food items. Please draw boxes manually.');
            // Fallback to manual editing mode on detection failure
            setImageUrl(convertedDataUrl); 
            setStage('editing');
        }
      };
      img.onerror = () => {
        setError('Failed to load image.');
        setStage('upload');
      };
      img.src = originalUrl;
    };
    reader.onerror = () => {
        setError('Failed to read file.');
        setStage('upload');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleIdentify = async () => {
    if (!imageUrl || userBoxes.length === 0) return;

    setStage('analyzing');
    setError(null);
    try {
      const base64Data = imageUrl.split(',')[1];
      const results = await identifyItemsInBoxes(base64Data, 'image/jpeg', userBoxes);
      
      const updatedBoxes = userBoxes.map(box => {
        const result = results.find(r => r.id === box.id);
        return result ? { ...box, name: result.name, calories: result.calories } : box;
      }).filter(box => box.name && box.calories); // Filter out boxes that didn't get a result

      setUserBoxes(updatedBoxes);
      setStage('results');
    } catch (err) {
      console.error(err);
      setError('Failed to analyze the image. Please try again.');
      setStage('editing'); // Revert to editing on error
    }
  };


  const handleReset = () => {
    setStage('upload');
    setImageUrl(null);
    setUserBoxes([]);
    setError(null);
    setImageDimensions(null);
  };

  const isAnalyzing = stage === 'analyzing';
  const isProcessing = stage === 'processing';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
                <SparklesIcon className="w-8 h-8 text-indigo-400" />
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Gemini Calorie Counter
                </h1>
            </div>
          <p className="mt-2 text-lg text-gray-400">
            {stage === 'upload' && 'Upload a photo or use your camera to get started.'}
            {stage === 'camera' && 'Center your meal in the frame and take a photo.'}
            {stage === 'processing' && 'Automatically detecting food items...'}
            {stage === 'editing' && 'Adjust the boxes, then click "Identify".'}
            {(stage === 'analyzing' || stage === 'results') && 'AI-powered calorie estimation for your meal.'}
          </p>
        </header>

        <main className="bg-gray-800/50 rounded-2xl shadow-2xl p-6 border border-gray-700 backdrop-blur-sm min-h-[300px] flex flex-col justify-center items-center">
          {stage === 'upload' && (
            <ImageUploader 
                onImageSelect={handleImageSelect} 
                isLoading={false} 
                onOpenCamera={() => setStage('camera')} 
            />
          )}

          {stage === 'camera' && (
            <CameraView onCapture={handleImageSelect} onCancel={handleReset} />
          )}

          {isProcessing && (
             <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-white font-semibold text-lg">Detecting food items...</p>
             </div>
          )}

          {imageUrl && (stage === 'editing' || stage === 'analyzing' || stage === 'results') && (
            <div className="flex flex-col items-center">
              <ImageAnalysisDisplay
                imageUrl={imageUrl}
                imageDimensions={imageDimensions}
                boxes={userBoxes}
                onBoxesChange={setUserBoxes}
                isEditing={stage === 'editing'}
                isLoading={isAnalyzing}
              />
              <div className="flex items-center gap-4 mt-6">
                <button
                  onClick={handleReset}
                  disabled={isAnalyzing || isProcessing}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-gray-600 text-base font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CameraIcon className="w-5 h-5"/>
                  Start Over
                </button>
                {(stage === 'editing' || stage === 'results') && (
                  <button
                    onClick={handleIdentify}
                    disabled={isAnalyzing || isProcessing || userBoxes.length === 0}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-indigo-900/50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <SparklesIcon className="w-5 h-5"/>
                    {stage === 'editing' ? 'Identify Foods' : 'Identify Again'}
                  </button>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 text-center p-4 bg-red-900/50 text-red-300 border border-red-700 rounded-lg">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-8 text-gray-500 text-sm">
            <p>Calorie estimates are generated by AI and may not be 100% accurate. Consult a professional for dietary advice.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;