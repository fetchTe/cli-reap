/**                                                                       @about
@file: _macro_.ts
@docs: https://bun.sh/docs/bundler/macros
@desc: Macros let you create functions whose return value is directly
      inlined at build/bundle-time
***                                                                           */
import {
  name,
  version,
  repository,
  description,
} from '../package.json';


export const getMeta = () => ({
  name,
  version,
  repo: repository.url,
  description,
  compressed: true, // if data is compressed
  btime: new Date().toISOString().slice(0, 16).replace(':', ''),
} as const);
