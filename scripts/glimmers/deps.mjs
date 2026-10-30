// gltf-transform, meshoptimizer and sharp are not game dependencies: these scripts load them from the
// folder you run them in (install there once: npm i @gltf-transform/core @gltf-transform/extensions
// @gltf-transform/functions meshoptimizer sharp).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const req = createRequire(join(process.cwd(), 'noop.js'));
const load = async (name) => import(pathToFileURL(req.resolve(name)).href);
export const core = await load('@gltf-transform/core');
export const ext = await load('@gltf-transform/extensions');
export const fns = await load('@gltf-transform/functions');
export const meshopt = await load('meshoptimizer');
export const sharp = (await load('sharp')).default;
