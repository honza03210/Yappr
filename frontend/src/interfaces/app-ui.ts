/**
 * An interface to keep HTML elements inside UI manager with no need to look them up in DOM
 */
export interface AppUI {
    localVisualization: HTMLCanvasElement;
    localAudio: HTMLAudioElement;
    audioMenu: HTMLDivElement;
    nameInput: HTMLInputElement;
    passwordInput: HTMLInputElement;
    roomIDInput: HTMLInputElement;
    roomList: HTMLDivElement;
    errorMsgLabel: HTMLDivElement;
    peerContainer: HTMLDivElement;
    audioCtx: AudioContext | undefined;
    localAudioStream: MediaStream | undefined;

}
