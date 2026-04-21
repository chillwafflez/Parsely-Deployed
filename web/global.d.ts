// Ambient module declarations for non-code side-effect imports.
// Next.js resolves `./globals.css` at build time via its CSS loader, but the
// TypeScript language server (VS Code) otherwise flags the import as missing
// type declarations. `.module.css` imports are typed separately by Next.js.

declare module "*.css";
