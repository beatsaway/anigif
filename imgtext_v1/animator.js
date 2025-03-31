(function() {
    'use strict';
    
    // Main canvas and context
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    
    // Frame management
    const frames = [
        createBlankFrame(),
        createBlankFrame(),
        createBlankFrame()
    ];
    let currentFrameIndex = 0;
    const MAX_FRAMES = 12;
    
    // Image and text manipulation state
    let activeObject = null;
    let isDragging = false;
    let isScaling = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let objectStartX = 0;
    let objectStartY = 0;
    let scaleStartSize = 1;
    
    // Store multiple images and text annotations per frame
    const frameObjects = new Array(MAX_FRAMES);
    for (let i = 0; i < MAX_FRAMES; i++) {
        frameObjects[i] = [];
    }
    
    // Store text content for each frame
    const frameTextContent = new Array(MAX_FRAMES).fill('');
    
    // Text annotation elements
    const annotationText = document.getElementById('annotation-text');
    const textStylePopup = document.getElementById('text-style-popup');
    const fontFamily = document.getElementById('font-family');
    const fontSize = document.getElementById('font-size');
    const fontColor = document.getElementById('font-color');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    
    // Text style state
    let currentTextStyle = {
        fontFamily: 'Arial',
        fontSize: '14',
        color: '#000000',
        bold: false,
        italic: false,
        underline: false
    };
    
    // Frame thumbnails
    const framesContainer = document.getElementById('frames-container');
    let thumbnails = document.querySelectorAll('.frame .thumbnail');
    let frameElements = document.querySelectorAll('.frame');
    
    // Controls
    const clearFrameBtn = document.getElementById('clear-frame');
    const removeFrameBtn = document.getElementById('remove-frame');
    const clearAllBtn = document.getElementById('clear-all');
    const previewBtn = document.getElementById('preview');
    const saveGifBtn = document.getElementById('save-gif');
    const previewImg = document.getElementById('preview-gif');
    const addFrameBtn = document.getElementById('add-frame');
    
    // Frame duration control
    const frameDuration = document.getElementById('frame-duration');
    
    // Initialize
    init();
    
    function init() {
        // Event listeners for paste and image manipulation
        document.addEventListener('paste', handlePaste);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseout', handleMouseOut);
        
        // Deselect when clicking empty canvas area
        canvas.addEventListener('click', handleCanvasClick);
        
        // Delete key handler
        document.addEventListener('keydown', handleKeyDown);
        
        // Frame selection
        framesContainer.addEventListener('click', (e) => {
            const frameElement = e.target.closest('.frame');
            if (frameElement) {
                selectFrame(parseInt(frameElement.dataset.index));
            }
        });
        
        // Control panel events
        clearFrameBtn.addEventListener('click', clearCurrentFrame);
        removeFrameBtn.addEventListener('click', removeCurrentFrame);
        clearAllBtn.addEventListener('click', clearAllFrames);
        previewBtn.addEventListener('click', previewGif);
        saveGifBtn.addEventListener('click', saveGif);
        addFrameBtn.addEventListener('click', addNewFrame);
        const cloneFrameBtn = document.getElementById('clone-frame');
        cloneFrameBtn.addEventListener('click', cloneCurrentFrame);
        
        // Text annotation event listeners
        annotationText.addEventListener('input', () => {
            // If there's no active text object, create one
            if (!activeObject || activeObject.type !== 'text') {
                const textObj = {
                    type: 'text',
                    text: annotationText.value,
                    x: 50,
                    y: 50,
                    scale: 1,
                    style: { ...currentTextStyle }
                };
                frameObjects[currentFrameIndex].push(textObj);
                activeObject = textObj;
                redrawCanvas();
            } else {
                // Update existing text object
                activeObject.text = annotationText.value;
                redrawCanvas();
            }
        });
        
        // Select text object when input gets focus
        annotationText.addEventListener('focus', () => {
            // Find existing text object or create new one
            let textObj = frameObjects[currentFrameIndex].find(obj => obj.type === 'text');
            if (!textObj) {
                textObj = {
                    type: 'text',
                    text: annotationText.value,
                    x: 50,
                    y: 50,
                    scale: 1,
                    style: { ...currentTextStyle }
                };
                frameObjects[currentFrameIndex].push(textObj);
            }
            activeObject = textObj;
            redrawCanvas();
        });
        
        annotationText.addEventListener('select', showTextStylePopup);
        annotationText.addEventListener('mouseup', showTextStylePopup);
        
        // Style controls
        fontFamily.addEventListener('change', updateTextStyle);
        fontSize.addEventListener('change', updateTextStyle);
        fontColor.addEventListener('input', updateTextStyle);
        boldBtn.addEventListener('click', () => toggleStyle('bold'));
        italicBtn.addEventListener('click', () => toggleStyle('italic'));
        underlineBtn.addEventListener('click', () => toggleStyle('underline'));
        
        // Hide popup when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (!textStylePopup.contains(e.target) && !annotationText.contains(e.target)) {
                textStylePopup.style.display = 'none';
            }
        });
        
        // Load the first frame
        selectFrame(0);
    }
    
    function createBlankFrame() {
        // Create a blank frame with transparent background
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = canvas.width;
        frameCanvas.height = canvas.height;
        const frameCtx = frameCanvas.getContext('2d');
        
        // Ensure the context is clear (transparent)
        frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        
        return frameCanvas;
    }
    
    function updateThumbnails() {
        // Re-query the thumbnails in case they've been added/removed
        thumbnails = document.querySelectorAll('.frame .thumbnail');
        
        frames.forEach((frame, index) => {
            if (thumbnails[index]) {
                const thumbCtx = thumbnails[index].getContext('2d');
                
                // Clear thumbnail with transparent background
                thumbCtx.clearRect(0, 0, thumbnails[index].width, thumbnails[index].height);
                
                // Create a temporary canvas at full size
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Clear temp canvas
                tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
                
                // Draw all objects for this frame
                const objects = frameObjects[index];
                objects.forEach(obj => {
                    tempCtx.save();
                    
                    if (obj.type === 'text') {
                        // Set text styles
                        tempCtx.font = getTextFont(obj);
                        tempCtx.fillStyle = obj.style.color;
                        tempCtx.translate(obj.x, obj.y);
                        tempCtx.scale(obj.scale, obj.scale);
                        
                        // Split text into lines and draw each line
                        const lines = obj.text.split('\n');
                        const lineHeight = parseInt(obj.style.fontSize) * 1.2;
                        
                        lines.forEach((line, lineIndex) => {
                            // Preserve whitespace
                            const textLine = line.replace(/ /g, '\u00A0');
                            tempCtx.fillText(textLine, 0, parseInt(obj.style.fontSize) + (lineHeight * lineIndex));
                            
                            // Draw underline if needed
                            if (obj.style.underline) {
                                const width = tempCtx.measureText(textLine).width;
                                tempCtx.beginPath();
                                tempCtx.moveTo(0, parseInt(obj.style.fontSize) + 2 + (lineHeight * lineIndex));
                                tempCtx.lineTo(width, parseInt(obj.style.fontSize) + 2 + (lineHeight * lineIndex));
                                tempCtx.strokeStyle = obj.style.color;
                                tempCtx.stroke();
                            }
                        });
                    } else {
                        // Draw image
                        tempCtx.translate(obj.x, obj.y);
                        tempCtx.scale(obj.scale, obj.scale);
                        tempCtx.drawImage(obj.element, 0, 0);
                    }
                    tempCtx.restore();
                });
                
                // Scale down to thumbnail size
                thumbCtx.drawImage(
                    tempCanvas,
                    0, 0, tempCanvas.width, tempCanvas.height,
                    0, 0, thumbnails[index].width, thumbnails[index].height
                );
            }
        });
    }
    
    function addNewFrame() {
        if (frames.length >= MAX_FRAMES) {
            alert(`Maximum number of frames (${MAX_FRAMES}) reached!`);
            return;
        }
        
        // Save current frame
        saveCurrentFrame();
        
        // Create new frame
        frames.push(createBlankFrame());
        
        // Create new thumbnail
        const newFrameIndex = frames.length - 1;
        const newFrameElement = document.createElement('div');
        newFrameElement.className = 'frame';
        newFrameElement.dataset.index = newFrameIndex;
        
        const newThumbnail = document.createElement('canvas');
        newThumbnail.width = 80;
        newThumbnail.height = 60;
        newThumbnail.className = 'thumbnail';
        
        const newLabel = document.createElement('div');
        newLabel.className = 'frame-label';
        newLabel.textContent = `Frame ${newFrameIndex + 1}`;
        
        newFrameElement.appendChild(newThumbnail);
        newFrameElement.appendChild(newLabel);
        framesContainer.appendChild(newFrameElement);
        
        // Re-query for updated frame elements
        frameElements = document.querySelectorAll('.frame');
        
        // Select the new frame
        selectFrame(newFrameIndex);
    }
    
    function cloneCurrentFrame() {
        if (frames.length >= MAX_FRAMES) {
            alert(`Maximum number of frames (${MAX_FRAMES}) reached!`);
            return;
        }
        
        // Save current frame to ensure it's up to date
        saveCurrentFrame();
        
        // Create a new frame
        const clonedFrame = createBlankFrame();
        
        // Clone the frame objects (images and text)
        const clonedObjects = frameObjects[currentFrameIndex].map(obj => {
            if (obj.type === 'text') {
                // Clone text object
                return {
                    ...obj,
                    style: { ...obj.style }  // Deep clone the style object
                };
            } else {
                // Clone image object
                return { ...obj };  // Image element reference can be shared
            }
        });
        
        // Clone the text content
        const clonedTextContent = frameTextContent[currentFrameIndex];
        
        // Insert the cloned frame after the current frame
        const insertIndex = currentFrameIndex + 1;
        frames.splice(insertIndex, 0, clonedFrame);
        frameObjects.splice(insertIndex, 0, clonedObjects);
        frameTextContent.splice(insertIndex, 0, clonedTextContent);
        
        // Create new thumbnail for the cloned frame
        const newFrameElement = document.createElement('div');
        newFrameElement.className = 'frame';
        newFrameElement.dataset.index = insertIndex;
        
        const newThumbnail = document.createElement('canvas');
        newThumbnail.width = 80;
        newThumbnail.height = 60;
        newThumbnail.className = 'thumbnail';
        
        const newLabel = document.createElement('div');
        newLabel.className = 'frame-label';
        newLabel.textContent = `Frame ${insertIndex + 1}`;
        
        newFrameElement.appendChild(newThumbnail);
        newFrameElement.appendChild(newLabel);
        
        // Insert the new frame element after the current frame in the DOM
        const currentFrameElement = frameElements[currentFrameIndex];
        framesContainer.insertBefore(newFrameElement, currentFrameElement.nextSibling);
        
        // Re-query all frame elements
        frameElements = document.querySelectorAll('.frame');
        
        // Update the index attributes of all frame elements after the insertion point
        for (let i = insertIndex + 1; i < frameElements.length; i++) {
            frameElements[i].dataset.index = i;
            frameElements[i].querySelector('.frame-label').textContent = `Frame ${i + 1}`;
        }
        
        // Select the cloned frame
        selectFrame(insertIndex);
        
        // Update thumbnails to show the cloned content
        updateThumbnails();
    }
    
    function selectFrame(index) {
        // Update active frame
        currentFrameIndex = index;
        activeObject = null; // Deselect active object when switching frames
        
        // Update frame selection UI
        frameElements.forEach((el, i) => {
            if (i === index) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        // Update text annotation box with the current frame's text
        const textObj = frameObjects[currentFrameIndex].find(obj => obj.type === 'text');
        if (textObj) {
            annotationText.value = textObj.text;
            // Update current text style to match the frame's text object
            currentTextStyle = { ...textObj.style };
            updateTextStyleUI();
        } else {
            annotationText.value = frameTextContent[currentFrameIndex] || '';
        }
        
        redrawCanvas();
        updateThumbnails();
    }
    
    function saveCurrentFrame() {
        // Save all objects to the frame
        const frameCtx = frames[currentFrameIndex].getContext('2d');
        frameCtx.clearRect(0, 0, frames[currentFrameIndex].width, frames[currentFrameIndex].height);
        
        // Draw all objects in order
        frameObjects[currentFrameIndex].forEach(obj => {
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.scale(obj.scale, obj.scale);
            
            if (obj.type === 'text') {
                // Set text styles
                ctx.font = getTextFont(obj);
                ctx.fillStyle = obj.style.color;
                
                // Split text into lines and draw each line
                const lines = obj.text.split('\n');
                const lineHeight = parseInt(obj.style.fontSize) * 1.2; // Add some line spacing
                
                lines.forEach((line, index) => {
                    // Preserve whitespace by replacing spaces with non-breaking spaces
                    const textLine = line.replace(/ /g, '\u00A0');
                    ctx.fillText(textLine, 0, parseInt(obj.style.fontSize) + (lineHeight * index));
                    
                    // Draw underline if needed
                    if (obj.style.underline) {
                        const width = ctx.measureText(textLine).width;
                        ctx.beginPath();
                        ctx.moveTo(0, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                        ctx.lineTo(width, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                        ctx.strokeStyle = obj.style.color;
                        ctx.stroke();
                    }
                });
            } else {
                // Draw image
                ctx.drawImage(obj.element, 0, 0);
            }
            ctx.restore();
        });
    }
    
    function loadCurrentFrame() {
        // Load the current frame to the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frames[currentFrameIndex], 0, 0);
        updateThumbnails();
    }
    
    function handleCanvasClick(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicked on any object
        const objects = frameObjects[currentFrameIndex];
        let clickedObject = null;
        
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            const objWidth = obj.type === 'text' ? getTextWidth(obj) : obj.width;
            const objHeight = obj.type === 'text' ? getTextHeight(obj) : obj.height;
            
            if (x >= obj.x && x <= obj.x + objWidth * obj.scale &&
                y >= obj.y && y <= obj.y + objHeight * obj.scale) {
                clickedObject = obj;
                break;
            }
        }
        
        // Update active object
        activeObject = clickedObject;
        redrawCanvas();
    }
    
    function handlePaste(e) {
        e.preventDefault();
        
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        const newImage = {
                            type: 'image',
                            element: img,
                            x: (canvas.width - img.width) / 2,
                            y: (canvas.height - img.height) / 2,
                            width: img.width,
                            height: img.height,
                            scale: 1
                        };
                        
                        frameObjects[currentFrameIndex].push(newImage);
                        activeObject = newImage;
                        
                        redrawCanvas();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    }
    
    function handleMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // First check if we clicked on the active object's resize handle
        if (activeObject) {
            const scaleHandleSize = 10;
            const handleX = activeObject.x + (activeObject.width || 0) * activeObject.scale;
            const handleY = activeObject.y + (activeObject.height || getTextHeight(activeObject)) * activeObject.scale;
            
            if (Math.abs(x - handleX) <= scaleHandleSize && 
                Math.abs(y - handleY) <= scaleHandleSize) {
                isScaling = true;
                scaleStartSize = activeObject.scale;
                dragStartX = x;
                dragStartY = y;
                return;
            }
        }
        
        // Check if we clicked on any object
        const objects = frameObjects[currentFrameIndex];
        let clickedObject = null;
        
        // Search in reverse order to handle overlapping (top-most first)
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            const objWidth = obj.type === 'text' ? getTextWidth(obj) : obj.width;
            const objHeight = obj.type === 'text' ? getTextHeight(obj) : obj.height;
            
            if (x >= obj.x && x <= obj.x + objWidth * obj.scale &&
                y >= obj.y && y <= obj.y + objHeight * obj.scale) {
                clickedObject = obj;
                break;
            }
        }
        
        if (clickedObject) {
            activeObject = clickedObject;
            isDragging = true;
            dragStartX = x;
            dragStartY = y;
            objectStartX = clickedObject.x;
            objectStartY = clickedObject.y;
        } else {
            activeObject = null;
        }
        
        redrawCanvas();
    }
    
    function handleMouseMove(e) {
        if (!activeObject || (!isDragging && !isScaling)) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isDragging) {
            activeObject.x = objectStartX + (x - dragStartX);
            activeObject.y = objectStartY + (y - dragStartY);
            redrawCanvas();
        } else if (isScaling) {
            const dx = x - dragStartX;
            const dy = y - dragStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const direction = dx > 0 ? 1 : -1;
            
            activeObject.scale = Math.max(0.1, scaleStartSize + direction * (distance / 100));
            redrawCanvas();
        }
    }
    
    function handleMouseUp(e) {
        if (isDragging || isScaling) {
            // Save the final position/scale
            saveCurrentFrame();
            updateThumbnails();
            
            // Reset drag/scale states
            isDragging = false;
            isScaling = false;
            
            // Keep the object selected but not moving
            if (activeObject) {
                objectStartX = activeObject.x;
                objectStartY = activeObject.y;
            }
        }
    }
    
    function handleMouseOut() {
        // Only handle mouse out if we're currently dragging/scaling
        if (isDragging || isScaling) {
            handleMouseUp();
        }
    }
    
    function redrawCanvas() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw all objects for current frame
        const objects = frameObjects[currentFrameIndex];
        objects.forEach(obj => {
            ctx.save();
            
            if (obj.type === 'text') {
                // Set text styles
                ctx.font = getTextFont(obj);
                ctx.fillStyle = obj.style.color;
                ctx.translate(obj.x, obj.y);
                ctx.scale(obj.scale, obj.scale);
                
                // Split text into lines and draw each line
                const lines = obj.text.split('\n');
                const lineHeight = parseInt(obj.style.fontSize) * 1.2; // Add some line spacing
                
                lines.forEach((line, index) => {
                    // Preserve whitespace by replacing spaces with non-breaking spaces
                    const textLine = line.replace(/ /g, '\u00A0');
                    ctx.fillText(textLine, 0, parseInt(obj.style.fontSize) + (lineHeight * index));
                    
                    // Draw underline if needed
                    if (obj.style.underline) {
                        const width = ctx.measureText(textLine).width;
                        ctx.beginPath();
                        ctx.moveTo(0, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                        ctx.lineTo(width, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                        ctx.strokeStyle = obj.style.color;
                        ctx.stroke();
                    }
                });
            } else {
                // Draw image
                ctx.translate(obj.x, obj.y);
                ctx.scale(obj.scale, obj.scale);
                ctx.drawImage(obj.element, 0, 0);
            }
            ctx.restore();
            
            // Draw resize handle if this is the active object
            if (obj === activeObject) {
                const handleSize = 10;
                const objWidth = obj.type === 'text' ? getTextWidth(obj) : obj.width;
                const objHeight = obj.type === 'text' ? getTextHeight(obj) : obj.height;
                
                ctx.fillStyle = '#4CAF50';
                ctx.beginPath();
                ctx.arc(obj.x + objWidth * obj.scale,
                       obj.y + objHeight * obj.scale,
                       handleSize/2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    function clearCurrentFrame() {
        frameObjects[currentFrameIndex] = [];
        activeObject = null;
        redrawCanvas();
        updateThumbnails();
    }
    
    function clearAllFrames() {
        if (confirm('Are you sure you want to clear all frames?')) {
            for (let i = 0; i < frames.length; i++) {
                const frameCtx = frames[i].getContext('2d');
                frameCtx.clearRect(0, 0, frames[i].width, frames[i].height);
            }
            loadCurrentFrame();
        }
    }
    
    function removeCurrentFrame() {
        if (frames.length <= 1) {
            alert("Cannot remove the last frame!");
            return;
        }
        
        if (confirm('Are you sure you want to remove this frame?')) {
            // Store the current index we want to remove
            const indexToRemove = currentFrameIndex;
            
            // Determine which frame to select next based on current position
            let newIndex;
            
            if (indexToRemove === 0) {
                // If first frame is selected, jump to the new first frame (which will be index 0 after removal)
                newIndex = 0;
                
                // Remove frame data
                frames.splice(0, 1);
                frameObjects.splice(0, 1);
                frameObjects.push([]); // Add empty array for new last frame
                frameTextContent.splice(0, 1); // Remove text content
                frameTextContent.push(''); // Add empty text content for new frame
                frameElements[0].remove();
                
                // After removal, select the new first frame (still at index 0)
                currentFrameIndex = newIndex;
                activeObject = null;
            } else {
                // For any other frame, jump to previous frame
                newIndex = indexToRemove - 1;
                
                // Select the new frame first (this saves the current frame)
                selectFrame(newIndex);
                
                // Now remove the original frame and its data
                frames.splice(indexToRemove, 1);
                frameObjects.splice(indexToRemove, 1);
                frameObjects.push([]); // Add empty array for new last frame
                frameTextContent.splice(indexToRemove, 1); // Remove text content
                frameTextContent.push(''); // Add empty text content for new frame
                frameElements[indexToRemove].remove();
            }
            
            // Re-query the frame elements after DOM changes
            frameElements = document.querySelectorAll('.frame');
            
            // Update the index attributes of remaining frames
            frameElements.forEach((el, i) => {
                el.dataset.index = i;
                el.querySelector('.frame-label').textContent = `Frame ${i + 1}`;
            });
            
            // Need to update the active frame's visual indicator
            frameElements.forEach((el, i) => {
                if (i === newIndex) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
            
            // If we were removing the first frame, we need to explicitly redraw
            if (indexToRemove === 0) {
                redrawCanvas();
            }
            
            // Update thumbnails to reflect changes
            updateThumbnails();
        }
    }
    
    function previewGif() {
        createGif(true);
    }
    
    function saveGif() {
        createGif(false);
    }
    
    function createGif(isPreview) {
        // Save current frame before encoding
        saveCurrentFrame();
        
        // Create a new GIF encoder
        const encoder = new GIFEncoder(canvas.width, canvas.height);
        encoder.setRepeat(0); // 0 = repeat forever
        encoder.setDelay(Math.round(parseFloat(frameDuration.value) * 1000)); // Convert seconds to milliseconds
        encoder.setQuality(10); // Quality setting (1-30, lower is better)
        
        // Set transparent color to white (0xFFFFFF) to make it transparent in the GIF
        encoder.setTransparent(0xFFFFFF);
        
        // Start the encoder
        encoder.writeHeader();
        
        // Add each frame - we need to ensure all frames are the same size
        frames.forEach((frame, frameIndex) => {
            // Create a temporary canvas with the current canvas dimensions
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Fill with white background (this will become transparent)
            tempCtx.fillStyle = '#FFFFFF';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw all objects for this frame
            const objects = frameObjects[frameIndex];
            objects.forEach(obj => {
                tempCtx.save();
                
                if (obj.type === 'text') {
                    // Set text styles
                    tempCtx.font = getTextFont(obj);
                    tempCtx.fillStyle = obj.style.color;
                    tempCtx.translate(obj.x, obj.y);
                    tempCtx.scale(obj.scale, obj.scale);
                    
                    // Split text into lines and draw each line
                    const lines = obj.text.split('\n');
                    const lineHeight = parseInt(obj.style.fontSize) * 1.2; // Add some line spacing
                    
                    lines.forEach((line, index) => {
                        // Preserve whitespace by replacing spaces with non-breaking spaces
                        const textLine = line.replace(/ /g, '\u00A0');
                        tempCtx.fillText(textLine, 0, parseInt(obj.style.fontSize) + (lineHeight * index));
                        
                        // Draw underline if needed
                        if (obj.style.underline) {
                            const width = tempCtx.measureText(textLine).width;
                            tempCtx.beginPath();
                            tempCtx.moveTo(0, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                            tempCtx.lineTo(width, parseInt(obj.style.fontSize) + 2 + (lineHeight * index));
                            tempCtx.strokeStyle = obj.style.color;
                            tempCtx.stroke();
                        }
                    });
                } else {
                    // Draw image
                    tempCtx.translate(obj.x, obj.y);
                    tempCtx.scale(obj.scale, obj.scale);
                    tempCtx.drawImage(obj.element, 0, 0);
                }
                tempCtx.restore();
            });
            
            // Get the frame data and add to encoder
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
            encoder.addFrame(imageData);
        });
        
        // Finish the encoding
        encoder.finish();
        
        // Get the GIF data
        const binaryGif = encoder.stream().getData();
        const dataUrl = 'data:image/gif;base64,' + btoa(binaryGif);
        
        if (isPreview) {
            // Display the preview
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
        } else {
            // Create a download link
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'animation.gif';
            link.click();
        }
    }
    
    function showTextStylePopup() {
        const selection = annotationText.value.substring(
            annotationText.selectionStart,
            annotationText.selectionEnd
        );
        
        if (selection) {
            const rect = annotationText.getBoundingClientRect();
            textStylePopup.style.display = 'block';
            textStylePopup.style.left = rect.left + 'px';
            textStylePopup.style.top = (rect.top - textStylePopup.offsetHeight - 5) + 'px';
        }
    }
    
    function updateTextStyle() {
        currentTextStyle.fontFamily = fontFamily.value;
        currentTextStyle.fontSize = fontSize.value;
        currentTextStyle.color = fontColor.value;
        updateTextAnnotation();
        frameTextContent[currentFrameIndex] = annotationText.value;
    }
    
    function updateTextStyleUI() {
        // Update UI elements to reflect current text style
        fontFamily.value = currentTextStyle.fontFamily;
        fontSize.value = currentTextStyle.fontSize;
        fontColor.value = currentTextStyle.color;
        
        // Update style button states
        boldBtn.classList.toggle('active', currentTextStyle.bold);
        italicBtn.classList.toggle('active', currentTextStyle.italic);
        underlineBtn.classList.toggle('active', currentTextStyle.underline);
    }
    
    function toggleStyle(style) {
        currentTextStyle[style] = !currentTextStyle[style];
        updateTextAnnotation();
        frameTextContent[currentFrameIndex] = annotationText.value;
    }
    
    function handleTextInput() {
        updateTextAnnotation();
        frameTextContent[currentFrameIndex] = annotationText.value;
        updateThumbnails(); // Update thumbnails when text changes
    }
    
    function updateTextAnnotation() {
        const text = annotationText.value;
        frameTextContent[currentFrameIndex] = text;

        if (!text) {
            // Remove text annotation from current frame if it exists
            frameObjects[currentFrameIndex] = frameObjects[currentFrameIndex].filter(obj => obj.type !== 'text');
        } else {
            // Find existing text annotation or create new one
            let textObj = frameObjects[currentFrameIndex].find(obj => obj.type === 'text');
            if (!textObj) {
                textObj = {
                    type: 'text',
                    x: canvas.width / 2,
                    y: canvas.height / 2,
                    scale: 1
                };
                frameObjects[currentFrameIndex].push(textObj);
            }
            
            // Update text object properties
            textObj.text = text;
            textObj.style = { ...currentTextStyle };
        }
        
        redrawCanvas();
    }
    
    function getTextWidth(textObj) {
        ctx.save();
        ctx.font = getTextFont(textObj);
        // Get width of the widest line
        const lines = textObj.text.split('\n');
        const widths = lines.map(line => ctx.measureText(line).width);
        const maxWidth = Math.max(...widths);
        ctx.restore();
        return maxWidth;
    }
    
    function getTextHeight(textObj) {
        const lines = textObj.text.split('\n');
        const lineHeight = parseInt(textObj.style.fontSize) * 1.2; // Match the line height used in drawing
        return lineHeight * lines.length;
    }
    
    function getTextFont(textObj) {
        const style = textObj.style;
        let font = '';
        if (style.bold) font += 'bold ';
        if (style.italic) font += 'italic ';
        font += `${style.fontSize}px ${style.fontFamily}`;
        return font;
    }
    
    function handleKeyDown(e) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && activeObject) {
            // Remove the active object from the current frame
            frameObjects[currentFrameIndex] = frameObjects[currentFrameIndex].filter(obj => obj !== activeObject);
            
            // If it was a text object, clear the text content
            if (activeObject.type === 'text') {
                annotationText.value = '';
                frameTextContent[currentFrameIndex] = '';
            }
            
            // Clear the active object
            activeObject = null;
            
            // Redraw the canvas and update thumbnails
            redrawCanvas();
            updateThumbnails();
        } else if (e.key.toLowerCase() === 's' && activeObject && activeObject.type === 'image' && !isDragging && !isScaling) {
            // Smart resize when 'S' is pressed and an image is selected
            const img = activeObject.element;
            const canvasRatio = canvas.width / canvas.height;
            const imageRatio = img.width / img.height;
            
            let newScale;
            if (imageRatio > canvasRatio) {
                // Image is wider relative to canvas - fit to width if height doesn't exceed
                const scaleToWidth = canvas.width / img.width;
                const resultingHeight = img.height * scaleToWidth;
                if (resultingHeight <= canvas.height) {
                    newScale = scaleToWidth;
                } else {
                    // Height would exceed, so fit to height instead
                    newScale = canvas.height / img.height;
                }
            } else {
                // Image is taller relative to canvas - fit to height if width doesn't exceed
                const scaleToHeight = canvas.height / img.height;
                const resultingWidth = img.width * scaleToHeight;
                if (resultingWidth <= canvas.width) {
                    newScale = scaleToHeight;
                } else {
                    // Width would exceed, so fit to width instead
                    newScale = canvas.width / img.width;
                }
            }
            
            // Apply the new scale
            activeObject.scale = newScale;
            
            // Center the resized image
            activeObject.x = (canvas.width - (img.width * newScale)) / 2;
            activeObject.y = (canvas.height - (img.height * newScale)) / 2;
            
            // Update the canvas and thumbnails
            redrawCanvas();
            updateThumbnails();
        }
    }
    
    // Make needed functions available to resize.js
    window.updateThumbnails = updateThumbnails;
    window.saveCurrentFrame = saveCurrentFrame;
    window.frames = frames;
})();
