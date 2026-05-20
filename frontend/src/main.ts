import {UIManager} from "./ui/ui-manager";
import {ClientPositions, Position} from "./position/client-positions";
import * as jdenticon from "jdenticon"

/**
 * Entry file for the main voice chat client page
 */


UIManager.Initialize();

const urlParams = new URLSearchParams(window.location.search);

// connects to the websocket server on the address provided in the url
// if not present, defaults to localhost:4242
let clientPositions = new ClientPositions(urlParams.get("websocket_address") ?? "ws://localhost:4242");
if (urlParams.get("user_token") != null && clientPositions.communicator instanceof WebSocket) {
    console.log("token sending", clientPositions.communicator);
    // sends the user_token if provided
    if (clientPositions.communicator.readyState === WebSocket.OPEN) {
        clientPositions.Send(JSON.stringify({token: urlParams.get("user_token")}));
    } else {
        clientPositions.communicator.addEventListener("open", () => clientPositions.Send(JSON.stringify({token: urlParams.get("user_token")})), {once: true});
    }
}

let peerConnections = {};
let peerPositions = {};

// binds the logic that needs to happen on the "Initialize" button click
await UIManager.EnableInitButton(peerConnections, peerPositions, clientPositions);

UIManager.PrefillFieldsFromUrl();
