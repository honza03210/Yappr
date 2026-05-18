import express from "express";
import cors from "cors";
import path from "path";
import {fileURLToPath} from "url";
import {signaling} from "./signaling/index.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

const server = app.listen(3001, () => {
    console.log('server is running on http://localhost:3001')
})

signaling(server);
