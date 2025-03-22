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
    const MAX_FRAMES = 24;
    
    // Drawing state
    let isDrawing = false;
    let isDrawingLine = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    
    // Undo functionality
    const undoStack = new Array(MAX_FRAMES);
    for (let i = 0; i < MAX_FRAMES; i++) {
        undoStack[i] = [];
    }
    
    // Frame thumbnails
    const framesContainer = document.getElementById('frames-container');
    let thumbnails = document.querySelectorAll('.frame .thumbnail');
    let frameElements = document.querySelectorAll('.frame');
    
    // Controls
    const brushSizeInput = document.getElementById('brush-size');
    const sizeDisplay = document.getElementById('size-display');
    const colorPicker = document.getElementById('color-picker');
    const clearFrameBtn = document.getElementById('clear-frame');
    const removeFrameBtn = document.getElementById('remove-frame');
    const clearAllBtn = document.getElementById('clear-all');
    const previewBtn = document.getElementById('preview');
    const saveGifBtn = document.getElementById('save-gif');
    const previewImg = document.getElementById('preview-gif');
    const addFrameBtn = document.getElementById('add-frame');
    
    // Drawing settings
    let brushSize = 5;
    let brushColor = '#7EC1E6';
    
    // Initialize
    init();
    
    function init() {
        // Set initial state
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = brushSize;
        ctx.strokeStyle = brushColor;
        
        // Event listeners for drawing
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseout', handleMouseOut);
        canvas.oncontextmenu = function(e) { e.preventDefault(); }; // Prevent context menu on right-click
        
        // Touch support
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', stopDrawing);
        
        // Undo support (Ctrl+Z)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            }
        });
        
        // Frame selection - Using event delegation for dynamically added frames
        framesContainer.addEventListener('click', (e) => {
            const frameElement = e.target.closest('.frame');
            if (frameElement) {
                selectFrame(parseInt(frameElement.dataset.index));
            }
        });
        
        // Control panel events
        brushSizeInput.addEventListener('input', updateBrushSize);
        colorPicker.addEventListener('input', updateColor);
        clearFrameBtn.addEventListener('click', clearCurrentFrame);
        removeFrameBtn.addEventListener('click', removeCurrentFrame);
        clearAllBtn.addEventListener('click', clearAllFrames);
        previewBtn.addEventListener('click', previewGif);
        saveGifBtn.addEventListener('click', saveGif);
        addFrameBtn.addEventListener('click', addNewFrame);
        const cloneFrameBtn = document.getElementById('clone-frame');
        cloneFrameBtn.addEventListener('click', cloneCurrentFrame);
        
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
                // Clear with transparent background first
                thumbCtx.clearRect(0, 0, thumbnails[index].width, thumbnails[index].height);
                thumbCtx.drawImage(
                    frame, 
                    0, 0, frame.width, frame.height,
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
        
        // Create a new frame by cloning the current frame
        const clonedFrame = createBlankFrame();
        const clonedFrameCtx = clonedFrame.getContext('2d');
        
        // Copy the content from the current frame to the new frame
        clonedFrameCtx.drawImage(frames[currentFrameIndex], 0, 0);
        
        // Insert the cloned frame after the current frame
        const insertIndex = currentFrameIndex + 1;
        frames.splice(insertIndex, 0, clonedFrame);
        
        // Update the undo stack - create a new empty undo stack for the new frame
        undoStack.splice(insertIndex, 0, []);
        
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
    }
    
    function selectFrame(index) {
        // Save current frame
        saveCurrentFrame();
        
        // Update active frame
        currentFrameIndex = index;
        
        // Re-query for updated frame elements
        frameElements = document.querySelectorAll('.frame');
        
        frameElements.forEach((el, i) => {
            if (i === index) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
        
        // Load selected frame
        loadCurrentFrame();
    }
    
    function saveCurrentFrame() {
        // Save the current canvas to the current frame
        const frameCtx = frames[currentFrameIndex].getContext('2d');
        frameCtx.clearRect(0, 0, frames[currentFrameIndex].width, frames[currentFrameIndex].height);
        frameCtx.drawImage(canvas, 0, 0);
        
        // Create a snapshot for undo
        saveToUndoStack();
    }
    
    function loadCurrentFrame() {
        // Load the current frame to the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frames[currentFrameIndex], 0, 0);
        updateThumbnails();
    }
    
    function handleMouseDown(e) {
        e.preventDefault();
        
        // Save the current state for undo
        saveToUndoStack();
        
        const pos = getPosition(e);
        
        // Left mouse button - start free drawing
        if (e.button === 0) {
            isDrawing = true;
            lastX = pos.x;
            lastY = pos.y;
            
            // Draw a single dot if they just click
            ctx.beginPath();
            ctx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = brushColor;
            ctx.fill();
        }
        // Right mouse button - start line drawing
        else if (e.button === 2) {
            isDrawingLine = true;
            startX = pos.x;
            startY = pos.y;
            
            // Draw a single dot at the start point
            ctx.beginPath();
            ctx.arc(startX, startY, brushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = brushColor;
            ctx.fill();
        }
    }
    
    function handleMouseMove(e) {
        const pos = getPosition(e);
        
        // Free-hand drawing with left mouse button
        if (isDrawing) {
            ctx.beginPath();
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            
            lastX = pos.x;
            lastY = pos.y;
        }
        // Preview straight line with right mouse button
        else if (isDrawingLine) {
            // Redraw the frame (to clear the preview line)
            loadCurrentFrame();
            
            // Draw the preview line
            ctx.beginPath();
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.moveTo(startX, startY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
        }
    }
    
    function handleMouseUp(e) {
        const pos = getPosition(e);
        
        // Finish free-hand drawing
        if (isDrawing && e.button === 0) {
            isDrawing = false;
            saveCurrentFrame();
            updateThumbnails();
        }
        // Finish straight line drawing
        else if (isDrawingLine && e.button === 2) {
            // Draw the final line
            ctx.beginPath();
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize;
            ctx.moveTo(startX, startY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            
            isDrawingLine = false;
            saveCurrentFrame();
            updateThumbnails();
        }
    }
    
    function handleMouseOut() {
        if (isDrawing) {
            isDrawing = false;
            saveCurrentFrame();
            updateThumbnails();
        }
        // Don't end line drawing when mouse leaves canvas - allow completing when mouse returns
    }
    
    function stopDrawing() {
        if (isDrawing) {
            isDrawing = false;
            saveCurrentFrame();
            updateThumbnails();
        }
        
        if (isDrawingLine) {
            isDrawingLine = false;
            loadCurrentFrame(); // Discard the preview line
        }
    }
    
    function getPosition(e) {
        let x, y;
        const rect = canvas.getBoundingClientRect();
        
        if (e.type.includes('touch')) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        
        return {
            x: Math.floor(x),
            y: Math.floor(y)
        };
    }
    
    function handleTouchStart(e) {
        e.preventDefault();
        
        // Save the current state for undo
        saveToUndoStack();
        
        const pos = getPosition(e);
        
        isDrawing = true;
        lastX = pos.x;
        lastY = pos.y;
        
        // Draw a single dot if they just click
        ctx.beginPath();
        ctx.arc(lastX, lastY, brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = brushColor;
        ctx.fill();
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        if (!isDrawing) return;
        
        const pos = getPosition(e);
        
        ctx.beginPath();
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        
        lastX = pos.x;
        lastY = pos.y;
    }
    
    function updateBrushSize() {
        brushSize = parseInt(brushSizeInput.value);
        sizeDisplay.textContent = `${brushSize}px`;
    }
    
    function updateColor() {
        brushColor = colorPicker.value;
    }
    
    function clearCurrentFrame() {
        // Save the current state for undo
        saveToUndoStack();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveCurrentFrame();
        updateThumbnails();
    }
    
    function clearAllFrames() {
        if (confirm('Are you sure you want to clear all frames?')) {
            // Save current states for undo on all frames
            for (let i = 0; i < frames.length; i++) {
                undoStack[i] = [];
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
                
                // First save any changes to the current frame
                if (frames[currentFrameIndex]) {
                    const frameCtx = frames[currentFrameIndex].getContext('2d');
                    frameCtx.clearRect(0, 0, frames[currentFrameIndex].width, frames[currentFrameIndex].height);
                    frameCtx.drawImage(canvas, 0, 0);
                }
                
                // Now remove the original frame (which is at index 0)
                frames.splice(0, 1);
                frameElements[0].remove();
                undoStack.splice(0, 1);
                undoStack.push([]); // Add empty stack at the end
                
                // After removal, select the new first frame (still at index 0)
                currentFrameIndex = newIndex;
            } else {
                // For any other frame, jump to previous frame
                newIndex = indexToRemove - 1;
                
                // Select the new frame first (this saves the current frame)
                selectFrame(newIndex);
                
                // Now remove the original frame (which is now at indexToRemove)
                frames.splice(indexToRemove, 1);
                frameElements[indexToRemove].remove();
                undoStack.splice(indexToRemove, 1);
                undoStack.push([]); // Add empty stack at the end
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
            
            // If we were removing the first frame, we need to explicitly load the new first frame
            if (indexToRemove === 0) {
                loadCurrentFrame();
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
        encoder.setDelay(200); // 200ms delay between frames
        encoder.setQuality(10); // Quality setting (1-30, lower is better)
        
        // Important: Don't set white as transparent, set null for transparency support
        encoder.setTransparent(null);
        
        // Start the encoder
        encoder.writeHeader();
        
        // Add each frame - we need to ensure all frames are the same size
        frames.forEach(frame => {
            // Create a temporary canvas with the current canvas dimensions
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Clear with transparent background
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw the frame onto the temp canvas (this ensures correct size)
            tempCtx.drawImage(frame, 0, 0, frame.width, frame.height, 
                             0, 0, tempCanvas.width, tempCanvas.height);
            
            // Get the resized frame data and add to encoder
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
    
    // Undo functionality
    function saveToUndoStack() {
        // Create a copy of the current canvas state
        const undoCanvas = document.createElement('canvas');
        undoCanvas.width = canvas.width;
        undoCanvas.height = canvas.height;
        const undoCtx = undoCanvas.getContext('2d');
        undoCtx.drawImage(canvas, 0, 0);
        
        // Push to the undo stack for the current frame (limit to 20 steps)
        if (undoStack[currentFrameIndex].length >= 20) {
            undoStack[currentFrameIndex].shift(); // Remove oldest
        }
        undoStack[currentFrameIndex].push(undoCanvas);
    }
    
    function undo() {
        // Check if we have any undo steps for the current frame
        if (undoStack[currentFrameIndex].length > 0) {
            // Get the last saved state
            const lastState = undoStack[currentFrameIndex].pop();
            
            // Restore that state to the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(lastState, 0, 0);
            
            // Update the frame with this change
            const frameCtx = frames[currentFrameIndex].getContext('2d');
            frameCtx.clearRect(0, 0, frames[currentFrameIndex].width, frames[currentFrameIndex].height);
            frameCtx.drawImage(canvas, 0, 0);
            
            // Update thumbnails
            updateThumbnails();
        } else {
            console.log("Nothing to undo for this frame");
        }
    }
    
    // Make needed functions available to resize.js
    window.updateThumbnails = updateThumbnails;
    window.saveCurrentFrame = saveCurrentFrame;
    window.frames = frames;
})();
