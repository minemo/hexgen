import { defineConfig } from 'vite'
import { viteSingleFile } from "vite-plugin-singlefile"
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
