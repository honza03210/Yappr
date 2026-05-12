import {PeerConnection} from "./peer-connection";
import {ClientPositions, Position} from "./client-positions";
import {UIManager} from "./ui-manager";
import {DrawSoundVisualization, StringToColor} from "./visualization";

/**
 * Handles new audio stream - visualization and spatial audio updates
 * @param stream
 * @param remoteAudio
 * @param remoteVideo
 * @param id
 * @param clientPositions
 * @param peerPositions
 * @constructor
 */
export function HandleNewReceivedStream(stream: MediaStream, remoteAudio: HTMLAudioElement, remoteVideo: HTMLCanvasElement, id: string, clientPositions: ClientPositions, peerPositions: {[p: string]: Position}) {
    if (remoteAudio) {
        remoteAudio.muted = true;
        remoteAudio.srcObject = stream;
    }
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

    const pannerInterval = setInterval(UpdatePannerNodeFromPositions, 50, panNode, clientPositions, peerPositions, id);
    requestAnimationFrame(draw);
    return pannerInterval;
}

/**
 * Updates panner node from the client and peer positions
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
    panner.positionX.setTargetAtTime(peerPositions[id].x - clientPositions.x, UIManager.appUI.audioCtx!.currentTime, 0.05);
    panner.positionY.setTargetAtTime(peerPositions[id].y - clientPositions.y, UIManager.appUI.audioCtx!.currentTime, 0.05);
    panner.positionZ.setTargetAtTime(-(peerPositions[id].z - clientPositions.z), UIManager.appUI.audioCtx!.currentTime, 0.05);

    // panner.positionX.value = (!Number.isNaN(peerPositions[id].x - clientPositions.x)) ? (peerPositions[id].x - clientPositions.x) : 0;
    // panner.positionY.value = (!Number.isNaN(peerPositions[id].y - clientPositions.y)) ? (peerPositions[id].y - clientPositions.y) : 0;
    // panner.positionZ.value = (!Number.isNaN(peerPositions[id].z - clientPositions.z)) ? (peerPositions[id].z - clientPositions.z) : 0;
    let headX = (!Number.isNaN(clientPositions.heading.x)) ? -clientPositions.heading.x : 0;
    let headY = (!Number.isNaN(clientPositions.heading.y)) ? -clientPositions.heading.y : 0;
    let headZ = (!Number.isNaN(clientPositions.heading.z)) ? -clientPositions.heading.z : 0;
    //UIManager.appUI.audioCtx.listener.setOrientation(headX, headZ, headY, 0, 1, 0);

}

/**
 * Initial PannerNode params
 * @param panNode
 * @constructor
 */
export function SetPanNodeParams(panNode: PannerNode) {
    // TODO: Pull from some config file
    panNode.panningModel = "HRTF";
    panNode.distanceModel = "linear";
    panNode.refDistance = 1;
    panNode.maxDistance = 20;
    panNode.rolloffFactor = 1;
    panNode.coneInnerAngle = 360;
    panNode.coneOuterAngle = 360;
    panNode.coneOuterGain = 1;
}
