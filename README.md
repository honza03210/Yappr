# Yappr
## Web-Based Peer-to-Peer Proximity Voice Chat

Proximity chat with simple integration into any game.
All that is needed is creating a websocket server in the game (either locally or on the game server) that will feed the position data into the browser client.
At this moment there is a working example of usage in a Minecraft [mod](https://github.com/honza03210/Yappr-minecraft-mod) (client side) and a [plugin](https://github.com/honza03210/Yappr-minecraft-plugin) (server side).
The game generates an url that passes the important parameters to the browser.

```VOICE_CHAT_URL/?username=PLAYER_USERNAME&room_id=ROOM_NAME&websocket_address=POSITIONS_WEBSOCKET_ADDRESS:%d&user_token=USER_TOKEN&password-INSECURE=ROOM_PASSWORD&autojoin```

Demo version of the voice chat working between players on LAN is [here](https://jaguar-magnetic-deer.ngrok-free.app/).

For a version working fully and reliably on the internet a TURN server is needed as a fallback when direct connection between peers fails (strict firewalls, NATs).

### How To Setup Local Hosting
```
git clone https://github.com/honza03210/Yappr/
cd Yappr
npm install
mv ./server/src/turn-secret-key.template.ts ./server/src/turn-secret-key.ts
mv ./server/src/backup-ice-server-array.template.ts ./server/src/backup-ice-server-array.ts
```

(Unreliable alternative below) Then put real turn api key into the ```./server/src/turn-secret-key.ts``` and a real ice server list into ```./server/src/backup-ice-server-array.ts``` (this should work for paid plans on [Metered](https://www.metered.ca/), for other TURN servers you may need to edit the source code).

If you don't need the reliability of a TURN server, you can just copy a free STUN server array e.g. [here](https://gist.github.com/mondain/b0ec1cf5f60ae726202e) - choose less than 6 and put them into the ```./server/src/backup-ice-server-array.ts```, you can remove the username and credential attributes.

You may want to change the address used for the signaling server (default http://localhost:3001) -> ```./frontend/src/configs/server-config.ts```, then ```./server/src/index.ts```

### Websocket position stream formatting
Parsing of the messages is done in ```./frontend/src/client-positions.ts```.

The data sent from the game has to be in formatted like this:

```FORMAT;X_POSITION;Y_POSITION;Z_POSITION;PITCH;YAW```

The FORMAT can be used in the future for some advanced game specific processing, right now it can be whatever except SERVER_EVENT and GAME_EVENT - these formats are reserved for special messages that can be used to transfer arbitrary data between the peers - theoretically entire games could be built on top of this layer. GAME_EVENT is a message that will be forwarded without any changes to all peers. SERVER_EVENT is a message sent by the signalling server and forwarded to the game (more experimental, will be further implemented in the future) - player joined/left a room, etc.

### ```VOICE_CHAT/overlay/```
This approach uses window.postMessage to communicate between the voice chat overlay and the game instead of a websocket connection. This allows for integration into browser games, that cannot create a websocket server. The ```minimal-template[.ts, .html]``` are all needs to be implemented by the browser game.

The entire project is very much a work in progress and may rapidly change. 
This README is up-to-date as of 27.1.2026.
