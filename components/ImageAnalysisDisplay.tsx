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

  const labelRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [labelStyles, setLabelStyles] = useState<{ [id: string]: React.CSSProperties }>({});

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
  
  useEffect(() => {
    // We only run this logic when displaying results, not during editing.
    if (isEditing || boxes.length === 0 || isLoading) {
      if (Object.keys(labelStyles).length > 0) {
        setLabelStyles({}); // Clear styles if we enter editing mode
      }
      return;
    }

    // Use a timeout to ensure the DOM is updated and refs are set before we measure.
    const timer = setTimeout(() => {
      const allLabels = Array.from(labelRefs.current.entries())
        .filter(([, el]) => el)
        .map(([id, el]) => ({ id, el: el! }));
        
      if (allLabels.length === 0) return;
      
      const newStyles: { [id: string]: React.CSSProperties } = {};
      const placedRects: DOMRect[] = [];

      // Sort boxes by their vertical position to process top ones first. This provides a more stable layout.
      const sortedBoxes = [...boxes].sort((a, b) => a.boundingBox.y - b.boundingBox.y);

      for (const box of sortedBoxes) {
        const labelInfo = allLabels.find(l => l.id === box.id);
        if (!labelInfo) continue;
        
        const initialRect = labelInfo.el.getBoundingClientRect();
        let topOffset = 0;
        let attempts = 0;
        const maxAttempts = 30; // Max number of times to try moving a label up

        while (attempts < maxAttempts) {
          // Create a new rect for the potential new position
          const adjustedRect = new DOMRect(
            initialRect.x,
            initialRect.y + topOffset,
            initialRect.width,
            initialRect.height
          );

          // Check for collision with already placed labels
          const hasCollision = placedRects.some(placed =>
            !(adjustedRect.right < placed.left ||
              adjustedRect.left > placed.right ||
              adjustedRect.bottom < placed.top ||
              adjustedRect.top > placed.bottom)
          );
          
          if (!hasCollision) {
            placedRects.push(adjustedRect);
            break; // Found a clear spot
          }
          
          // If collision, move label up and try again
          topOffset -= 5; // Move up by 5px
          attempts++;
        }
        
        if (topOffset !== 0) {
            newStyles[box.id] = {
                transform: `translateY(${topOffset}px)`,
                zIndex: 100 - attempts, // Labels that moved more get higher z-index
            };
        }
      }
      setLabelStyles(newStyles);
    }, 150); // A small delay is needed for layout to stabilize

    return () => clearTimeout(timer);
  }, [boxes, isEditing, isLoading, imgRenderedSize]);


  const toImageCoords = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - imgRenderedSize.offsetX) / imgRenderedSize.width;
    const y = (clientY - rect.top - imgRenderedSize.offsetY) / imgRenderedSize.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, [imgRenderedSize]);
  
  const toScreenStyle = (box: BoundingBox) => ({
    left: `${imgRenderedSize.offsetX + box.x * imgRenderedSize.width}px`,
    top: `${imgRenderedSize.offsetY + box.y * imgRenderedSize.height}px`,
    width: `${box.width * imgRenderedSize.width}px`,
    height: `${box.height * imgRenderedSize.height}px`,
  });

  const handleInteractionStart = useCallback((clientX: number, clientY: number, targetElement: EventTarget | null) => {
    if (!isEditing || !containerRef.current || !targetElement) return;
    const coords = toImageCoords(clientX, clientY);
    if (!coords) return;
    
    const target = targetElement as HTMLElement;
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
        const newBox: UserBox = { id: uuid(), boundingBox: { x: coords.x, y: coords.y, width: 0, height: 0 } };
        onBoxesChange([...boxes, newBox]);
        setActiveBoxId(newBox.id);
        setInteraction({ mode: 'drawing', startX: coords.x, startY: coords.y });
    }
  }, [isEditing, toImageCoords, boxes, onBoxesChange]);

  const handleInteractionMove = useCallback((clientX: number, clientY: number) => {
    if (interaction.mode === 'none' || !isEditing) return;
    const coords = toImageCoords(clientX, clientY);
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
  }, [interaction, isEditing, toImageCoords, boxes, onBoxesChange, activeBoxId]);

  const handleInteractionEnd = useCallback(() => {
    if (interaction.mode === 'drawing' || interaction.mode === 'resizing') {
        // Remove zero-sized boxes
        const newBoxes = boxes.filter(b => b.boundingBox.width > 0.005 && b.boundingBox.height > 0.005);
        if(newBoxes.length !== boxes.length) {
            onBoxesChange(newBoxes);
        }
    }
    setInteraction({ mode: 'none' });
  }, [interaction.mode, boxes, onBoxesChange]);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleInteractionStart(e.clientX, e.clientY, e.target);
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (interaction.mode !== 'none') {
        handleInteractionMove(e.clientX, e.clientY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    handleInteractionStart(touch.clientX, touch.clientY, touch.target);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (interaction.mode !== 'none') {
      const touch = e.touches[0];
      handleInteractionMove(touch.clientX, touch.clientY);
    }
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
        onMouseUp={handleInteractionEnd}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleInteractionEnd}
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
          style={{ ...toScreenStyle(item.boundingBox), cursor: isEditing ? 'move' : 'default', touchAction: 'none' }}
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
                            style={{ 
                                cursor: `${handle.split('-')[0] === 'top' || handle.split('-')[0] === 'bottom' ? 'ns' : 'ew'}-resize`,
                                touchAction: 'none'
                             }}
                            data-handle={handle}
                            data-box-id={item.id}
                        />
                    ))}
                    <button 
                      onClick={() => handleDelete(item.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => { // Use onTouchStart for better reliability on mobile
                        e.stopPropagation();
                        e.preventDefault();
                        handleDelete(item.id);
                      }}
                      className="absolute -top-3 -right-3 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold border-2 border-gray-900 hover:bg-red-500 z-30"
                      aria-label="Delete box"
                    >
                      &times;
                    </button>
                </>
            )}

            {!isEditing && item.name && item.calories && (
                <div 
                  ref={el => {
                    if (el) labelRefs.current.set(item.id, el);
                    else labelRefs.current.delete(item.id);
                  }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-md whitespace-nowrap transition-transform duration-200"
                  style={labelStyles[item.id] || {}}
                >
                  <span className="capitalize">{item.name}</span> - {item.calories} kcal
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-indigo-600"></div>
                </div>
            )}
        </div>
      ))}
    </div>
  );
};
