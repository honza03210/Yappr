export interface AppUI {
    localVideo: HTMLCanvasElement;
    localAudio: HTMLAudioElement;
    audioMenu: HTMLDivElement;
    nameInput: HTMLInputElement;
    passwordInput: HTMLInputElement;
    roomIDInput: HTMLInputElement;
    roomList: HTMLDivElement;
    errorMsgLabel: HTMLDivElement;
    videoContainer: HTMLDivElement;
    audioCtx: AudioContext | undefined;

}