
/**
 * @summary Computes the resulting size, position and scale applied to 
 * a rectangle in order to get into a rectangular area keeping the aspect ratio.
 * 
 * @param {{width: number, height: number}} size Height and width of the rectangle to be resized
 * @param {number} areaWidth Width of the target area
 * @param {number} areaHeight Height of the target area
 * @return {{x: number, y: number, width: number, height: number, scale: number}}
 */ 
function fitSizeIntoArea(size, areaWidth, areaHeight) {
    let heightRatio = areaHeight / size.height;
    let widthRatio = areaWidth / size.width;
    let scale = Math.min(Math.min(heightRatio, widthRatio), 1);
    return {
        x: (areaWidth - scale * size.width) / 2,
        y: (areaHeight - scale * size.height) / 2,
        height: size.height * scale,
        width: size.width * scale,
        scale: scale
    };
}

(function ($, loadImage, fabric) {

    //Main canvas
    const canvas = new fabric.Canvas('target-canvas'); //Fabric canvas
    canvas.select = true;
    
    let target = null; // Image to segment

    // Rectangle selection
    const rectangle = new fabric.Rect({
        hasRotatingPoint: false,
        opacity: 0.3,
        fill: "#E51F00",
        transparentCorners: false,
        cornerColor: "red",
        borderColor: "red",
        selectable: true
    }); 
    
    //Segmentation mask
    let mask = null;
    
    canvas.calcOffset();
    const renderCanvas = canvas.renderAll.bind(canvas);

    //Coordinate invariant selection
    const selection = {left: 0.25, top: 0.25, width: 0.5, height: 0.5};

    const SERVER = 'ws://localhost:9000';
    let connection = null;


    /**
     * @summary Shows the open file dialog.
     */
    function showOpenFileDialog() { $('#image-load').click(); }

    /**
     * @summary Handles the event in which an image was loaded into the 
     * application and starts the segmentation workflow for this image.
     * 
     * @param {*} evt Event data.
     */
    function onFileUploaded(evt) {
        //TODO: Deal with exif
        loadImage(evt.target.files[0], startSegmentation);
    }

    /**
     * @summary Starts the segmentation process with a given image.
     * 
     * @param {*} image Image to be segmented.
     */
    function startSegmentation(image) {
        setTargetImage(image);
        adjustCanvas();
        swithToRectangleSelectionMode();
        renderCanvas();
    }

    /**
     * @summary Sets a given image as target and background of the main UI.
     * 
     * @param {*} image Image to segment. 
     */
    function setTargetImage(image) {
        target = new fabric.Image(image);
        canvas.setBackgroundImage(target, canvas.renderAll.bind(canvas));
    }

    /**
     * @summary Adjusts the canvas size and position according to the 
     * window's size.
     */
    function adjustCanvas() {
        let rightSection = $('#canvas-section');
        let dimensions = fitSizeIntoArea(target.getOriginalSize(), rightSection.width(), rightSection.height());
        canvas.setDimensions(dimensions);
        target.scale(dimensions.scale);
        //debugger;
        if(mask != null)
            mask.scale(dimensions.scale)
        updateRectangle();
    }

    /**
     * @summary Updates the size of the UI rectangle according to the selection.
     */
    function updateRectangle() {
        let size = target.getBoundingRect(false, false);
        rectangle.set({
            left: selection.left * size.width,
            top: selection.top * size.height,
            width: selection.width * size.width,
            height: selection.height * size.height
        });
        rectangle.setCoords();
    }

    /**
     * @summary Updates the size invariant selection according to the size
     * of the visual rectangle and the background image in the UI.
     */
    function updateSelection() {
        let size = target.getBoundingRect(false, false);
        selection.left = rectangle.left / size.width;
        selection.top = rectangle.top / size.width;
        selection.width = rectangle.width / size.width;
        selection.height = rectangle.height / size.height;
    }

    /**
     * @summary Switches to rectangle segmentation state.
     */
    function swithToRectangleSelectionMode() {
        $('#rectangle-mode-commands').show();
        $('#mask-mode-commands').hide();

        canvas.add(rectangle);
        canvas.setActiveObject(rectangle);
        if(mask) canvas.remove(mask);
        updateRectangle();
    }

    /**
     * @summary Forces the selected object to always be the rectangle.
     */
    function ensureSelection() {
        var objects = canvas.getObjects('rect');
        if(objects.length > 0)
            canvas.setActiveObject(objects[0]);
    }


    /**
     * @summary Sets the UI to wait mode, 
     * connects and sends the rectangle selection/
     */
    function sendRectanleSelection() {
        toggleWaitMode();
        connectAndSendSelection();
    }

    /**
     * @summary Initializes the connection, sends the current rectanle selection 
     * to the server and sets up callbacks to get the result.
     */
    function connectAndSendSelection() {
        if(connection)
            connection.close();
        connection = new WebSocket(SERVER);
        connection.onopen = submitRectangleSelection;
        connection.onerror = onConnectionError;
        connection.onmessage = receiveSegmentationResult; 
    }

    /**
     * @summary Computes the rectangle selection with respect to the orignal
     * target image size.
     */
    function getRealSelection() {
        let size = target.getOriginalSize();
        let x = selection.left * size.width;
        let y = selection.top * size.width;

        return {
            left: x,
            top: y,
            width: Math.min(selection.width * size.width, size.width - x),
            height: Math.min(selection.height * size.height, size.height - y)
        };
    }

    /**
     * @summary Creates the message payload and sends it to the server.
     */
    function submitRectangleSelection() {
        let payload = {
            //Restoring the scale to the original size.
            //The multiplier is the scale with respect to the current scaled size
            image: target.toDataURL({multiplier: 1/target.scaleX}),
            selection: getRealSelection()
        };
        console.log(target._originalElement.src);
        connection.send(JSON.stringify(payload));
    }

    /**
     * @summary Handles any connection error.
     */
    function onConnectionError() {
        alert("Error " + arguments);
    }

    /**
     * @summary Handles the reception of segmentation result sent from the server.
     * @param {*} evt Event data.  
     */
    function receiveSegmentationResult(evt) {
        let img = new Image;
        img.src = evt.data;
        img.onerror = () => { alert('Somethign went wrong'); };
        img.onload = () => {
            setMaskImage(img);
            switchToMaskMode();
        };
    }

    /**
     * @summary Switches the application to mask mode given a segmentation mask.
     * @param {string} data Data URL of the segmentation mask. 
     */
    function switchToMaskMode(data) {
        $('#mask-mode-commands').show();
        $('#rectangle-mode-commands').hide();

        rectangle.remove();
        renderCanvas();

        toggleWaitMode();
    }

    /**
     * @summary Sets the mask image.
     * @param {*} img 
     */
    function setMaskImage(img) {
        mask = new fabric.Image(img, {
            scaleX: target.scaleX, 
            scaleY: target.scaleY,
            opacity: 0.4,
            selectable: false
        });
        canvas.add(mask);
        mask.bringToFront();
        renderCanvas();
    }

    function toggleWaitMode() {
        $('#wait-overlay').toggle();
    }
    
    //Events

    ////Canvas
    canvas.on('selection:cleared', ensureSelection)
        .on('object:modified', updateSelection)
        .on('object:scaling', updateSelection)
        .on('object:moving', updateSelection);


    ////Button actions
    $('#open-image').click(showOpenFileDialog);
    $('#image-load').on('change', onFileUploaded);
    $('#send-rectangle').click(sendRectanleSelection);
    $('#back-to-rectangle').click(swithToRectangleSelectionMode);

    ////Responsive UI
    $(window).on('resize', adjustCanvas);

})(jQuery,loadImage, fabric);