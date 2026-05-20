import {UIManager} from "./ui/ui-manager";
import {ClientPositions, Position} from "./position/client-positions";
import {PeerConnection} from "./audio/peer-connection";

/**
 * Entry file for the main voice chat client page
 */


UIManager.Initialize();

const urlParams = new URLSearchParams(window.location.search);

let clientPositions = new ClientPositions(urlParams.get("websocket_address") ?? "ws://localhost:4242");

if (urlParams.get("user_token") != null && clientPositions.communicator instanceof WebSocket) {
    if (clientPositions.communicator.readyState === WebSocket.OPEN) {
        clientPositions.Send(JSON.stringify({token: urlParams.get("user_token")}));
    } else {
        clientPositions.communicator.addEventListener("open", () => clientPositions.Send(JSON.stringify({token: urlParams.get("user_token")})), {once: true});
    }
}

const peerConnections: { [id: string]: PeerConnection } = {};
const peerPositions: { [id: string]: Position } = {};

await UIManager.EnableInitButton(peerConnections, peerPositions, clientPositions);
UIManager.PrefillFieldsFromUrl();
