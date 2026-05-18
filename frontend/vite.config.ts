import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    root: ".", // the current folder (default)
    build: {
        outDir: "dist", // output folder for vite build
        emptyOutDir: true, // clear old files before building
        rollupOptions: {
            // Vite will automatically detect multiple HTML entries,
            // but this makes it explicit and avoids edge cases.
            input: {
                main: resolve(__dirname, "index.html"),
                // mobile: resolve(__dirname, "mobile/index.html"),
            },
        },
    },
    server: {
        host: true, // allows access from network devices
        port: 5173, // default dev port
    },
});
