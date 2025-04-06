// Canvas resizing functionality
(function() {
    'use strict';
    
    // DOM Elements
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    
    // Resize handle
    const resizeHandle = document.getElementById('resize-handle');
    
    // Minimum dimensions
    const MIN_WIDTH = 200;
    const MIN_HEIGHT = 150;
    
    // Resize state
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    // Helper function to preserve canvas contents during resize
    function resizeCanvas(newWidth, newHeight) {
        // Create a temporary canvas to store the current image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);
        
        // Resize the main canvas
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Restore the image on the resized canvas
        ctx.drawImage(tempCanvas, 0, 0);
        
        // Update thumbnails to reflect new canvas size
        if (typeof window.updateThumbnails === 'function') {
            window.updateThumbnails();
        }
    }
    
    // Initialize resize events
    function initResize() {
        // Set up event listeners for the handle
        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize);
        
        // Mouse move and up events for dragging
        document.addEventListener('mousemove', resizeMove);
        document.addEventListener('touchmove', resizeMove);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchend', stopResize);
    }
    
    // Start resize
    function startResize(e) {
        e.preventDefault();
        isResizing = true;
        
        // Get initial positions
        startX = e.clientX || (e.touches && e.touches[0].clientX);
        startY = e.clientY || (e.touches && e.touches[0].clientY);
        startWidth = canvas.width;
        startHeight = canvas.height;
    }
    
    // Handle resize movement
    function resizeMove(e) {
        if (!isResizing) return;
        
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        // Calculate new dimensions (only from bottom right)
        const newWidth = Math.max(MIN_WIDTH, startWidth + dx);
        const newHeight = Math.max(MIN_HEIGHT, startHeight + dy);
        
        // Update the canvas size
        resizeCanvas(newWidth, newHeight);
        
        // Save the current frame to reflect changes
        if (typeof window.saveCurrentFrame === 'function') {
            window.saveCurrentFrame();
        }
        
        // Prevent default to avoid scrolling on touch devices
        e.preventDefault();
    }
    
    // Stop resizing
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            
            // Update frames if needed
            if (typeof window.frames !== 'undefined') {
                // Update all frames to the new canvas size
                for (let i = 0; i < window.frames.length; i++) {
                    const frameCanvas = window.frames[i];
                    const frameCtx = frameCanvas.getContext('2d');
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = frameCanvas.width;
                    tempCanvas.height = frameCanvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(frameCanvas, 0, 0);
                    
                    // Resize frame
                    frameCanvas.width = canvas.width;
                    frameCanvas.height = canvas.height;
                    frameCtx.drawImage(tempCanvas, 0, 0);
                }
            }
        }
    }
    
    // Initialize when the DOM is ready
    document.addEventListener('DOMContentLoaded', initResize);
    
    // If the document is already loaded, initialize immediately
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initResize();
    }
})();