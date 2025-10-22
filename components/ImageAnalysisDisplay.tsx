
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { UserBox, BoundingBox } from '../types';

interface ImageAnalysisDisplayProps {
  imageUrl: string;
  imageDimensions: { width: number; height: number } | null;
  boxes: UserBox[];
  onBoxesChange: (boxes: UserBox[]) => void;
  isEditing: boolean;
  isLoading: boolean;
}

type InteractionMode = 
  | { mode: 'none' }
  | { mode: 'drawing'; startX: number; startY: number; }
  | { mode: 'moving'; boxId: string; startX: number; startY: number; startBox: BoundingBox; }
  | { mode: 'resizing'; boxId: string; handle: string; startX: number; startY: number; startBox: BoundingBox; };

const uuid = () => crypto.randomUUID();

export const ImageAnalysisDisplay: React.FC<ImageAnalysisDisplayProps> = ({ imageUrl, imageDimensions, boxes, onBoxesChange, isEditing, isLoading }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgRenderedSize, setImgRenderedSize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionMode>({ mode: 'none' });

  const calculateImageRenderSize = useCallback(() => {
    if (!containerRef.current || !imageDimensions) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight < 100 ? 500 : containerRef.current.offsetHeight; // Give default height on first render
    const containerAR = containerWidth / containerHeight;
    const imageAR = imageDimensions.width / imageDimensions.height;
    
    let width: number, height: number, offsetX = 0, offsetY = 0;

    if (imageAR > containerAR) {
      width = containerWidth;
      height = width / imageAR;
      offsetY = (containerHeight - height) / 2;
    } else {
      height = containerHeight;
      width = height * imageAR;
      offsetX = (containerWidth - width) / 2;
    }
    setImgRenderedSize({ width, height, offsetX, offsetY });
  }, [imageDimensions]);

  useEffect(() => {
    calculateImageRenderSize();
    window.addEventListener('resize', calculateImageRenderSize);
    return () => window.removeEventListener('resize', calculateImageRenderSize);
  }, [calculateImageRenderSize]);
  
  const toImageCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - imgRenderedSize.offsetX) / imgRenderedSize.width;
    const y = (clientY - rect.top - imgRenderedSize.offsetY) / imgRenderedSize.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
  
  const toScreenStyle = (box: BoundingBox) => ({
    left: `${imgRenderedSize.offsetX + box.x * imgRenderedSize.width}px`,
    top: `${imgRenderedSize.offsetY + box.y * imgRenderedSize.height}px`,
    width: `${box.width * imgRenderedSize.width}px`,
    height: `${box.height * imgRenderedSize.height}px`,
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditing || !containerRef.current) return;
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    
    const target = e.target as HTMLElement;
    const boxId = target.dataset.boxId;
    const handle = target.dataset.handle;

    if (handle && boxId) {
        const startBox = boxes.find(b => b.id === boxId)?.boundingBox;
        if(startBox) {
            setInteraction({ mode: 'resizing', boxId, handle, startX: coords.x, startY: coords.y, startBox });
        }
    } else if (boxId) {
        const startBox = boxes.find(b => b.id === boxId)?.boundingBox;
        if (startBox) {
            setActiveBoxId(boxId);
            setInteraction({ mode: 'moving', boxId, startX: coords.x, startY: coords.y, startBox });
        }
    } else {
        setActiveBoxId(null);
        setInteraction({ mode: 'drawing', startX: coords.x, startY: coords.y });
        const newBox: UserBox = { id: uuid(), boundingBox: { x: coords.x, y: coords.y, width: 0, height: 0 } };
        onBoxesChange([...boxes, newBox]);
        setActiveBoxId(newBox.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interaction.mode === 'none' || !isEditing) return;
    const coords = toImageCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (interaction.mode === 'drawing') {
      const { startX, startY } = interaction;
      const x = Math.min(startX, coords.x);
      const y = Math.min(startY, coords.y);
      const width = Math.abs(coords.x - startX);
      const height = Math.abs(coords.y - startY);
      onBoxesChange(boxes.map(b => b.id === activeBoxId ? { ...b, boundingBox: { x, y, width, height } } : b));
    }
    
    if (interaction.mode === 'moving') {
      const { boxId, startX, startY, startBox } = interaction;
      const dx = coords.x - startX;
      const dy = coords.y - startY;
      let newX = startBox.x + dx;
      let newY = startBox.y + dy;
      
      newX = Math.max(0, Math.min(1 - startBox.width, newX));
      newY = Math.max(0, Math.min(1 - startBox.height, newY));

      onBoxesChange(boxes.map(b => b.id === boxId ? { ...b, boundingBox: { ...b.boundingBox, x: newX, y: newY } } : b));
    }

    if (interaction.mode === 'resizing') {
        const { boxId, handle, startX, startY, startBox } = interaction;
        let { x, y, width, height } = startBox;
        const dx = coords.x - startX;
        const dy = coords.y - startY;

        if (handle.includes('bottom')) height += dy;
        if (handle.includes('top')) { y += dy; height -= dy; }
        if (handle.includes('right')) width += dx;
        if (handle.includes('left')) { x += dx; width -= dx; }

        if (width < 0) { x += width; width = -width; }
        if (height < 0) { y += height; height = -height; }
        
        onBoxesChange(boxes.map(b => b.id === boxId ? { ...b, boundingBox: { x, y, width, height } } : b));
    }
  };

  const handleMouseUp = () => {
    if (interaction.mode === 'drawing' || interaction.mode === 'resizing') {
        // Remove zero-sized boxes
        const newBoxes = boxes.filter(b => b.boundingBox.width > 0.005 && b.boundingBox.height > 0.005);
        if(newBoxes.length !== boxes.length) {
            onBoxesChange(newBoxes);
        }
    }
    setInteraction({ mode: 'none' });
  };

  const handleDelete = (boxId: string) => {
    onBoxesChange(boxes.filter(b => b.id !== boxId));
  }
  
  const resizeHandles: (keyof BoundingBox | string)[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  return (
    <div 
        ref={containerRef} 
        className="relative w-full max-w-2xl mx-auto aspect-[4/3] flex items-center justify-center select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      <img
        src={imageUrl}
        alt="Food analysis"
        className="block max-w-full max-h-full rounded-lg shadow-lg object-contain"
        style={{ cursor: isEditing ? 'crosshair' : 'default' }}
        draggable={false}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm z-30">
          <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white font-semibold text-lg">Analyzing your meal...</p>
        </div>
      )}
      {boxes.map((item) => (
        <div
          key={item.id}
          className={`absolute border-2 rounded-md transition-colors duration-200
            ${activeBoxId === item.id && isEditing ? 'border-indigo-400 z-20' : ''}
            ${activeBoxId !== item.id && isEditing ? 'border-gray-500 hover:border-indigo-500 z-10' : ''}
            ${!isEditing ? 'border-indigo-500' : ''}
          `}
          style={{ ...toScreenStyle(item.boundingBox), cursor: isEditing ? 'move' : 'default' }}
          data-box-id={item.id}
        >
            {isEditing && activeBoxId === item.id && (
                <>
                    {resizeHandles.map(handle => (
                        <div
                            key={handle}
                            className={`absolute w-3 h-3 bg-indigo-400 rounded-full -m-1.5 border-2 border-gray-900 z-30
                            ${handle.includes('top') ? 'top-0' : 'bottom-0'}
                            ${handle.includes('left') ? 'left-0' : 'right-0'}
                            `}
                            style={{ cursor: `${handle.split('-')[0] === 'top' || handle.split('-')[0] === 'bottom' ? 'ns' : 'ew'}-resize` }}
                            data-handle={handle}
                            data-box-id={item.id}
                        />
                    ))}
                    <button 
                      onClick={() => handleDelete(item.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold border-2 border-gray-900 hover:bg-red-500 z-30"
                      aria-label="Delete box"
                    >
                      &times;
                    </button>
                </>
            )}

            {!isEditing && item.name && item.calories && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-md whitespace-nowrap">
                  <span className="capitalize">{item.name}</span> - {item.calories} kcal
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-indigo-600"></div>
                </div>
            )}
        </div>
      ))}
    </div>
  );
};
