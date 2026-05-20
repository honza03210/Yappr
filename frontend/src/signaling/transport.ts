import {Socket} from "socket.io-client";

export type SignalingMessage = {type: string, payload?: any};
export type SignalingEventHandler = (eventName: string, eventData: any) => void | Promise<void>;


export class SignalingTransport {
    constructor(public communicator: Socket | MessagePort) {}

    send(message: SignalingMessage) {
        if ("emit" in this.communicator) {
            this.communicator.emit(message.type, message.payload);
        } else if ("postMessage" in this.communicator) {
            this.communicator.postMessage({message: message.payload, type: message.type});
        } else {
            console.error("signaling object can't emit or postMessage");
        }
    }

    close() {
        this.communicator.close();
    }

    bindEvents(onEvent: SignalingEventHandler) {
        this.handlerRef = onEvent;
        if ("onAny" in this.communicator) {
            this.communicator.offAny();
            this.communicator.onAny(async (ev, ...args) => {
                await this.handlerRef?.(ev.toString(), args[0]);
            });
        } else if ("addEventListener" in this.communicator) {
            this.communicator.removeEventListener("message", this.messageHandler);
            this.communicator.addEventListener("message", this.messageHandler);
        } else {
            console.error("Invalid signaling communicator");
        }
    }

    private handlerRef: SignalingEventHandler | null = null;
    private messageHandler = async (event: any) => {
        if (!event.data || !event.data.type) {
            console.error("signaling received invalid message: ", event);
            return;
        }
        await this.handlerRef?.(event.data.type, event.data);
    };
}
