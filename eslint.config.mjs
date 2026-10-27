import { defineConfig } from "eslint/config";
import next from "eslint-config-next";

// Global ignores must be a standalone config object in flat config.
export default defineConfig([
    {
        ignores: ["public/ffmpeg/**", "out/**", ".next/**", "node_modules/**"],
    },
    {
        extends: [...next],
    },
]);
