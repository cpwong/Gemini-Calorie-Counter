
import React, { useRef, useCallback, useState } from 'react';
import { UploadIcon, CameraIcon } from './icons/Icons';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  isLoading: boolean;
  onOpenCamera: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, isLoading, onOpenCamera }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };
  
  const handleDragEvent = useCallback((e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
       setIsDragging(isEntering);
    }
  }, [isLoading]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        onImageSelect(file);
    }
  }, [isLoading, onImageSelect]);

  const handleCameraClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoading) {
      onOpenCamera();
    }
  };


  return (
    <>
      <div
        className={`relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg transition-colors duration-300
          ${isDragging ? 'border-indigo-400 bg-gray-700/50' : 'border-gray-600 hover:border-indigo-500'}
          ${isLoading ? 'cursor-wait bg-gray-700/50' : 'cursor-pointer'}`}
        onClick={handleClick}
        onDragEnter={(e) => handleDragEvent(e, true)}
        onDragLeave={(e) => handleDragEvent(e, false)}
        onDragOver={(e) => handleDragEvent(e, true)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          disabled={isLoading}
        />
        <div className="text-center">
          <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
          <p className="mt-2 text-lg font-semibold text-gray-300">
            <span className="text-indigo-400">Upload a file</span> or drag and drop
          </p>
          <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
        </div>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center rounded-lg">
              <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="flex items-center w-full my-6">
          <div className="flex-grow border-t border-gray-600"></div>
          <span className="flex-shrink mx-4 text-gray-500 uppercase text-sm">Or</span>
          <div className="flex-grow border-t border-gray-600"></div>
      </div>

      <button
          type="button"
          onClick={handleCameraClick}
          disabled={isLoading}
          className="inline-flex items-center gap-2 w-full max-w-sm justify-center px-6 py-3 border border-gray-600 text-base font-medium rounded-md shadow-sm text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
          <CameraIcon className="w-5 h-5"/>
          Use Camera
      </button>
    </>
  );
};
