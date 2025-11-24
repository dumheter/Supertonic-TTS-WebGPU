# Agent Guidelines for Supertonic-TTS-WebGPU

## Build & Test Commands
- `npm run dev` - Start Vite dev server
- `npm run build` - Type check with `tsc -b` then build with Vite
- `npm run lint` - Run ESLint on all files
- `npm run preview` - Preview production build locally
- No test suite is configured

## TypeScript Configuration
- Target: ES2022, strict mode enabled with all strict checks
- Use `verbatimModuleSyntax` - import types must use `import type`
- No unused locals/parameters allowed (`noUnusedLocals`, `noUnusedParameters`)
- JSX: `react-jsx` (new JSX transform)

## Code Style
- **Imports**: Use `import type` for type-only imports (e.g., `import type { ReactNode } from "react"`)
- **Formatting**: Use 2-space indentation, double quotes for strings
- **Types**: Prefer explicit types for function params/returns; use `Float32Array` for audio buffers
- **State**: Use React hooks (`useState`, `useRef`) for state management; refs for mutable values (audio contexts, DOM nodes)
- **Async**: Use async/await with generators for streaming (e.g., `async function*` in tts.ts:80)
- **Error Handling**: Use try-catch for async operations, log errors with `console.error`
- **Naming**: camelCase for variables/functions (e.g., `speakerEmbeddings`, `loadPipeline`), PascalCase for components
