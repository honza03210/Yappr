import {PeerConnection} from "./peer-connection";
import {ClientPositions, Position} from "../position/client-positions";
import {UIManager} from "../ui/ui-manager";
import {DrawSoundVisualization, StringToColor} from "../ui/visualization";
import {Signaling} from "../signaling/signaling";
import {SetPanNodeParams} from "../configs/panner-config";

/**
 * Handles new audio stream - both visualization and spatial audio updates
 * @param stream
 * @param remoteAudio
 * @param remoteVideo
 * @param id
 * @param clientPositions
 * @param peerPositions
 * @param signaling
 * @constructor
 */
export function HandleNewReceivedStream(stream: MediaStream, remoteAudio: HTMLAudioElement, remoteVideo: HTMLCanvasElement, id: string, clientPositions: ClientPositions, peerPositions: {[p: string]: Position}, signaling: Signaling) {
    if (remoteAudio) {
        remoteAudio.muted = true;
        remoteAudio.srcObject = stream;
    }

    // creates the audio pipeline
    let audioCtx = UIManager.appUI.audioCtx;
    let microphone = audioCtx!.createMediaStreamSource(stream);
    let analyser = audioCtx!.createAnalyser();
    let panNode = audioCtx!.createPanner();

    SetPanNodeParams(panNode);

    microphone.connect(panNode);
    panNode.connect(analyser);
    analyser.connect(audioCtx!.destination);

    let remoteVideoColor: string = "rgba(141,141,141, 0.05)";
    let remoteVideoStroke: string = StringToColor(id);

    let muted = false;

    remoteVideo.onclick = () => {
        if (muted) {
            console.log("unmuted");
            remoteVideoColor = "rgba(141,141,141, 0.05)";
            muted = false;
            analyser.connect(audioCtx!.destination);
        } else {
            console.log("muted");
            remoteVideoColor = "rgba(255,0,0,0.28)";
            muted = true;
            analyser.disconnect(audioCtx!.destination);
        }
    }

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let canvasCtx = remoteVideo.getContext("2d")!;
    remoteVideo.style.margin = "auto";
    const WIDTH = remoteVideo.width;
    const HEIGHT = remoteVideo.height;

    function draw() {
        if (DrawSoundVisualization(canvasCtx, WIDTH, HEIGHT, analyser, dataArray, remoteVideoColor, remoteVideoStroke, bufferLength, id)){
            requestAnimationFrame(draw);
        }
    }

    const pannerInterval = setInterval(UpdatePannerNodeFromPositions, 250, panNode, clientPositions, peerPositions, id);
    signaling.peerRunningIntervals[id].push(pannerInterval);
    requestAnimationFrame(draw);
    return pannerInterval;
}

/**
 * Updates panner node from the client and peer positions.
 * Uses smoothing to make the transition as smooth as possible even with low update rate.
 * @param panner
 * @param clientPositions
 * @param peerPositions
 * @param id
 * @constructor
 */
export function UpdatePannerNodeFromPositions(panner: PannerNode, clientPositions: ClientPositions, peerPositions: {[p: string]: Position}, id: string) {
    if (!peerPositions[id]){
        return;
    }

    const audioCtx = UIManager.appUI.audioCtx!;
    const t = audioCtx.currentTime;
    const listener = audioCtx.listener;
    const zSign = clientPositions.PositionFormat === "mc" ? -1 : 1;

    function smooth(param: AudioParam, value: number) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.setTargetAtTime(value, t, 0.08);
    }

    if (listener.positionX) {
        smooth(listener.positionX, clientPositions.x);
        smooth(listener.positionY, clientPositions.y);
        smooth(listener.positionZ, clientPositions.z * zSign);
    } else {
        (listener as any).setPosition?.(clientPositions.x, clientPositions.y, clientPositions.z * zSign);
    }

    if (listener.forwardX) {
        smooth(listener.forwardX, clientPositions.heading.x);
        smooth(listener.forwardY, clientPositions.heading.y);
        smooth(listener.forwardZ, clientPositions.heading.z);
    } else {
        (listener as any).setOrientation?.(clientPositions.heading.x, clientPositions.heading.y, clientPositions.heading.z, 0, 1, 0);
    }

    smooth(panner.positionX, peerPositions[id].x);
    smooth(panner.positionY, peerPositions[id].y);
    smooth(panner.positionZ, peerPositions[id].z * zSign);
}

