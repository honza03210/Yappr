import express from "express";
import cors from "cors";
import path from "path";
import {fileURLToPath} from "url";
import type {Server as HttpServer} from "http";
import {signaling} from "./signaling/index.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: express.Express = express();

app.use(cors());

// Express server the static files of the in-browser client
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

const server: HttpServer = app.listen(3001, () => {
    console.log('server is running on http://localhost:3001')
})

// binds all the signaling logic via Socket.IO to the server
signaling(server);
