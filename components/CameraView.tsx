import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (isMounted) {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          streamRef.current = stream;
        } else {
            stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        if (isMounted) {
            setError('Could not access the camera. Please check permissions and try again.');
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const imageFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(imageFile);
        } else {
            setError('Failed to capture image.');
            setIsCapturing(false);
        }
      }, 'image/jpeg', 0.95);
    } else {
        setError('Failed to get canvas context.');
        setIsCapturing(false);
    }
  }, [onCapture, isCapturing]);

  return (
    <div className="w-full max-w-2xl mx-auto aspect-[4/3] relative bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
        <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-4 z-10">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500"
                >
                    Back
                </button>
            </div>
        )}

        {!error && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex justify-center items-center z-10">
                <button
                    onClick={onCancel}
                    className="absolute left-4 px-4 py-2 text-sm bg-black/30 text-white rounded-full hover:bg-black/50 backdrop-blur-sm"
                    aria-label="Cancel"
                >
                    Cancel
                </button>

                <button
                    onClick={handleCapture}
                    disabled={isCapturing}
                    className="w-16 h-16 rounded-full bg-white/90 p-1 flex items-center justify-center ring-2 ring-white ring-offset-4 ring-offset-black/20 focus:outline-none focus:ring-indigo-400 disabled:opacity-50 transition"
                    aria-label="Take photo"
                >
                    <div className="w-full h-full rounded-full bg-white ring-2 ring-inset ring-black/50"></div>
                </button>
            </div>
        )}
    </div>
  );
};
