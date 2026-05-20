import {UIManager} from "./ui-manager";


/**
 * Binds the sound visualization for the local user
 * @param stream
 * @param audioCtx
 * @constructor
 */
export function BindStreamAnimation(stream: MediaStream, audioCtx: AudioContext) {
    let microphone = audioCtx!.createMediaStreamSource(stream);
    let analyser = audioCtx!.createAnalyser();
    microphone.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    if (UIManager.appUI.localAudio) {
        UIManager.appUI.localAudio.muted = true;
    }
    let canvasCtx = UIManager.appUI.localVisualization.getContext("2d")!;
    UIManager.appUI.localVisualization.width = 128;
    UIManager.appUI.localVisualization.height = 128;
    UIManager.appUI.localVisualization.classList.add("visualization-canvas")
    UIManager.appUI.localVisualization.style.borderRadius = "50%";
    UIManager.appUI.audioMenu.style.display = "block";
    const WIDTH = UIManager.appUI.localVisualization.width;
    const HEIGHT = UIManager.appUI.localVisualization.height;

    let backgroundColor = 'rgba(255, 255, 255, 0.1)'
    let strokeColor = 'rgba(255, 255, 255, 0.8)'

    function draw() {
        DrawSoundVisualization(canvasCtx, WIDTH, HEIGHT, analyser, dataArray, backgroundColor, strokeColor, bufferLength, null);
        requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
}


/**
 * Draws the sound visualization into the canvasCtx based on the params provided
 * This could be used in the future to draw different visualizations
 * @param canvasCtx
 * @param WIDTH
 * @param HEIGHT
 * @param analyser
 * @param dataArray
 * @param remoteVideoColor
 * @param remoteVideoStroke
 * @param bufferLength
 * @param name
 * @param complex
 * @constructor
 */

export function DrawSoundVisualization(canvasCtx: CanvasRenderingContext2D, WIDTH: number, HEIGHT: number, analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>, remoteVideoColor: string, remoteVideoStroke: string, bufferLength: number, name: string | null, complex: boolean = true) : boolean{
    if (!CanvasRenderingContext2D) {
        return false;
    }
    if (complex) {
        visualizationCircular(canvasCtx, WIDTH, HEIGHT, analyser, dataArray, remoteVideoStroke, name);
    }
    return true;
}

/**
 * Draws a circular sound visualization onto canvasCtx
 * Uses
 * @param canvasCtx
 * @param WIDTH
 * @param HEIGHT
 * @param analyser
 * @param dataArray
 * @param remoteVideoStroke
 * @param name
 */
function visualizationCircular(canvasCtx: CanvasRenderingContext2D, WIDTH: number, HEIGHT: number, analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>, remoteVideoStroke: string, name: string | null){
    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.clearRect(0, 0, WIDTH, WIDTH);
    let color = remoteVideoStroke;
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const baseRadius = HEIGHT / 3;
    const barCount = dataArray.length;

    for (let i = 0; i < barCount; i++) {
        const angle = -(i / barCount) * Math.PI * 2 - Math.PI * 0.5;
        const value = 0.1 + 10 * Math.abs(0.5 - convolutionAverageAroundIndex(dataArray, i, 0));

        const barHeight = value * 32;

        const innerX = cx + baseRadius * Math.cos(angle);
        const innerY = cy + baseRadius * Math.sin(angle);

        const outerX = cx + (baseRadius + barHeight) * Math.cos(angle);
        const outerY = cy + (baseRadius + barHeight) * Math.sin(angle);

        canvasCtx.beginPath();
        canvasCtx.moveTo(innerX, innerY);
        canvasCtx.lineTo(outerX, outerY);
        canvasCtx.strokeStyle = color;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
    }
}

/**
 * takes a string, creates a simple hash and deterministically returns "rgb(x, y, z)" for the select string
 * @param str
 * @constructor
 */
export function StringToColor(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const r = 128 + (hash & 0x7F);
    const g = 128 + ((hash >> 8) & 0x7F);
    const b = 128 + ((hash >> 16) & 0x7F);

    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Computes average around given index from values between halfSize distance in both directions
 * @param data
 * @param index
 * @param halfSize
 */
export function convolutionAverageAroundIndex(data: Uint8Array<ArrayBuffer>, index: number, halfSize: number) {
    let sum = data[index];
    for (let i = 1; i <= halfSize; i++) {
        sum += data[(index + i + data.length) % data.length] + data[(index - i + data.length) % data.length];
    }
    return sum / (255 * (2 * halfSize + 1));
}