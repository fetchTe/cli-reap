<h1>
cli-reap
<a href="https://mibecode.com">
  <img align="right" title="&#8805;95% Human Code" alt="&#8805;95% Human Code" src="https://mibecode.com/badge.svg" />
</a>
<img align="right" alt="empty space" src="https://mibecode.com/4px.svg" />
<img align="right" alt="NPM Version" src="https://img.shields.io/npm/v/cli-reap?color=white" />
</h1>


Your friendly neighborhood CLI reaper (parser), indifferent to argument order or runtime

<img align="right" width="130" height="auto" alt="logo" src="https://raw.githubusercontent.com/fetchTe/cli-reap/master/docs/cli-reap-logo.png" />

> ╸ **Supports**: [flags](#-flag), [options](#-opt), [positionals](#-pos), [duplicates](#duplicates), [double-dash](#-end), and [ENV](#-env)/[`globalThis`](#-env)<br />
> ╸ **Runtimes**: [Node.js](https://nodejs.org/), [Deno](https://deno.com/), [Bun](https://bun.sh/), [QuickJS](https://bellard.org/quickjs/), and others with [`argv`](https://nodejs.org/api/process.html#processargv) & [`env`](https://nodejs.org/api/process.html#processenv) handling <br />
> ╸ **Tests**: [25,757](https://github.com/fetchTe/cli-reap/blob/master/src/index.test.ts) of them<br />

<br />

### ▎THE GIST

Flags and/or options are removed as they are parsed, which allows operands to be defined anywhere:

```ts
import cliReap from 'cli-reap';
import assert  from 'node:assert/strict';

// all possible ARGV (out, verbose, input) combinations -> all parsed (reaped) the same
const ARGVS = [
  './order  --out=file.txt --verbose input.txt', // 'input.txt' is the operand
  './does   --out file.txt input.txt --verbose',
  './not    --verbose --out=file.txt input.txt',
  './matter --verbose input.txt --out file.txt',
  './to-the input.txt --out file.txt --verbose',
  './reaper input.txt --verbose --out=file.txt',
];

const EXPECT = `
verbose: true
output: file.txt
input: input.txt`.repeat(ARGVS.length); // repeats the string six time

const OUTPUT = ARGVS.map(arg => {
  const reap = cliReap(arg.split(' ')); // cliReap(<argv>?, <env>?, <strict>?)
  return `
verbose: ${reap.flag('verbose')}
output: ${reap.opt('out')}
input: ${reap.pos().pop()}`; // same string format as EXPECT
}).join('');

assert.strictEqual(EXPECT, OUTPUT); // a-ok - EXPECT equals OUTPUT
```

<!-- 
  // supports multiple runtimes
  'node ./cli-reapin.js --verbose --out=file.txt input.txt',
  'bun run ./reaping.ts input.txt --out file.txt --verbose',
  'deno run ./reapin.ts --verbose input.txt --out=file.txt',
-->

### ▎INSTALL

```sh
# pick your poison
npm install cli-reap
bun  add cli-reap
pnpm add cli-reap
yarn add cli-reap
```
<br />



## API

```ts
import cliReap, {
  cliReapStrict, // convenience wrap with strict enabled (case/hyphen/underscore sensitive)
  ARGV,          // command-line arguments (Node.js, Deno, Bun, QuickJS)
  ENV,           // process environment object (Node.js, Deno, Bun, QuickJS)
} from 'cli-reap';

type CliReap = (
  argv?: string[],           // command-line arguments array
  env?: NodeJS.ProcessEnv,   // process environment variables
  gthis?: typeof globalThis, // global object for runtime-set/fallback values
  strict?: boolean,          // enable strict matching (case/hyphen/underscore sensitive)
) => Readonly<{
  /** finds any value, in order: argv > environment > globalThis > default; removes from 'cur' argv if present */
  any: <R = string>(keys: string | string[], defaultValue?: R)=> R extends undefined ? string | true | null : string | true | R;
  /** command portion of argv (executable and script name) */
  cmd: ()=> string[];
  /** current un-consumed argv */
  cur: ()=> string[];
  /** if end-of-options/double-dash (--) delimiter is present in argv */
  end: ()=> boolean;
  /** value from environment variables or globalThis; does not mutate */
  env: (keys: string | string[])=> string | null;
  /** checks for flag presence and removes it from 'cur' argv */
  flag: (keys: string | string[])=> true | null;
  /** retrieves operand value and removes it from 'cur' argv  */
  opt: <R extends NonEmptyString>(key: string | string[])=> R | null;
  /** remaining positional arguments (typically called last)  */
  pos: ()=> string[];
}>;
```
> ╸ **Note**: All args after terminator (`--`) are positionals (even flags) see [here](#-end) <br />
> ╸ **Loose**: matching by default unless [`strict`](#-clireapstrict) <br />
> ━╸ **Case-Insensitive**: `Flag`, `flag`, `FlAg`, `FLAG`<br />
> ━╸ **Hyphen/Underscore Swapping**: `my-key`, `my_key`, `mY-keY`, `My_Key`<br />


<br />


### ▎ `any`
Finds any value in order: `argv > environment > globalThis > default`

```ts
type Any = <R = string>(
  keys: string | string[],   // key(s) to search for; first match returns
  defaultValue?: R           // default value if key not found; else null
) => R extends undefined
  ? string | true | null     // string value (option), true (flag), or null
  : string | true | R;       // string value (option), true (flag), or defaultValue

const reap = cliReap(['node', 'app.js', '--flag', '--out=out.txt', '-v', '-i', 'in.txt']);

reap.any(['f', 'flag'])    === true;      // found --flag
reap.any(['h', 'help'])    === null;      // no '-h', '--help', or default -> null
reap.any(['luck'], 7)      === 7;         // no '--luck', but default provided
reap.any(['v', 'verbose']) === true;      // found -v
reap.any(['o', 'out'])     === 'out.txt'; // found --out=out.txt
reap.any(['i', 'in'])      === 'in.txt';  // found -i in.txt
```
> ╸ **Removes**: matching arguments from [`cur`](#-cur) `argv` array<br />

<br />


### ▎ `cmd`
Returns command portion of `argv`: executable and script name

```ts
type Cmd = () => string[];   // command parts array [executable, script, ...]

// node.js execution
cliReap(['node', 'script.js', '--flag']).cmd() === ['node', 'script.js']
// bun execution
cliReap(['bun', 'run', 'script.ts', '--flag']).cmd() === ['bun', 'run', 'script.ts']
// direct executable
cliReap(['./my-cli', '--flag', 'value']).cmd() === ['./my-cli']
// flags at start (no executable detected)
cliReap(['--flag', 'value']).cmd() === []
```
<br />


### ▎ `cur`
Returns current un-consumed `argv` array for progressive parsing and/or debugging

```ts
type Cur = () => string[]; // current un-consumed argv array

const reap = cliReap(['./my-cli', '--yolo', 'value', 'pos1']);
reap.cur()         === ['--yolo', 'value', 'pos1'] // initially all args
reap.flag('yolo'); === true // consumes --yolo
reap.cur()         === ['value', 'pos1'] // after flag consumption
```

<br />


### ▎ `env`
Retrieves values from environment variables or `globalThis`

```ts
type Env = (
  keys: string | string[]    // environment variable key(s) to search for
) => string | null;          // environment value or null if not found

// With process.env.NODE_ENV = 'development'
// and globalThis.DEBUG = 'true'
const reap = cliReap();

reap.env('NODE_ENV')         === 'development'; // from process.env
reap.env('DEBUG')            === 'true';        // from globalThis (fallback)
reap.env(['TEST', 'DEBUG'])  === 'true';        // first match wins
reap.env('MISSING')          === null;          // not found anywhere
```
> ╸ **Read-only**: does not modify [`cur`](#-cur) `argv` array or modify global object<br />
> ╸ **Reference**: [`environment`](https://nodejs.org/api/process.html#processenv) and [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis) variables <br />
<br />


### ▎ `end`
Checks if `--` (double-dash/end-of-options delimiter) is present in `argv`

```ts
type Eod = () => boolean; // if -- is present in argv

const reap = cliReap(['./exe', '--flag', '--', '-v', '--in', 'in.txt']);
reap.end() === true;

reap.pos() === ['-v', '--in', 'in.txt'];
const reReap = cliReap(reap.pos());
reReap.opt('in') === 'in.txt';

```
> ╸ **Read-only**: does not modify [`cur`](#-cur) `argv` array<br />
> ╸ **Note**: Per [POSIX](https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html#tag_12_02) standard, arguments following `--` are treated as positionals (operands)<br />

<br />


### ▎ `flag`
Checks for flag presence

```ts
type Flag = (
  key: string | string[]     // flag key(s) to search for
) => true | null;            // true if flag exists, null otherwise

const reap = cliReap(['node', 'app.js', '--verbose', '-d', '--force', 'file.txt']);

reap.flag('verbose')      === true; // --verbose found
reap.flag(['d', 'debug']) === true; // -d found (matches 'd')
reap.flag('quiet')        === null; // --quiet not found
reap.flag('force')        === true; // --force found
```
> ╸ **Removes**: matching arguments from [`cur`](#-cur) `argv` array<br />

<br />


### ▎ `opt`
Retrieves command-line option value and removes it from [`cur`](#-cur) `argv` array

```ts
type Opt = <R extends NonEmptyString>(
  key: string | string[]     // option key(s) to search for
) => R | null;               // option value or null if not found

const reap = cliReap(['node', 'app.js', '--find=file.txt', '--data', 'dog.txt', '-v']);

reap.opt('find')        === 'file.txt'; // --find=file.txt (equals syntax)
reap.opt(['d', 'data']) === 'dog.txt';  // --data dog.txt (space syntax)
reap.opt('v')           === null;       // -v is a flag, not an option
```
> ╸ **Removes**: matching arguments from [`cur`](#-cur) `argv` array<br />

<br />


### ▎ `pos`
Returns remaining positional/operand arguments; this should happen after  after parsing [options](#-opt) and [flags](#-flag)

```ts
type Pos = () => string[];   // array of remaining positional arguments

const reap = cliReap(['node', 'app.js', '-v', 'input.txt', '-f', 'output.txt']);

reap.pos()      === ['input.txt', 'output.txt']; // before reaping '-f' opt
reap.opt('f');  === 'output.txt'   // removes/reaps 'output.txt'
reap.pos()      === ['input.txt']; // only 'input.txt' is left, as opt('-f') reaps 'output.txt'
```
> ╸ **Read-only**: does not modify [`cur`](#-cur) `argv` array<br />

<br />


<br />


### ▎ `cliReapStrict`
Exact matching, unlike `cliReap`, `cliReapStrict` is case, hyphen, and underscore sensitive
```ts
import { cliReap, cliReapStrict } from 'cli-reap';

// case sensitivity
cliReap(['-I', 'test']).opt('i')       === 'test';  // case-insensitive
cliReapStrict(['-I', 'test']).opt('i') === null;    // strict: no match

// hyphen/underscore swapping
cliReap(['--swap_in', 'loose']).opt('swap-in')       === 'loose'; // swaps _ <-> -
cliReapStrict(['--swap_in', 'loose']).opt('swap-in') === null;    // strict: no match

// both case + swapping
cliReap(['--My_Key', 'value']).opt('my-key')       === 'value'; // case + swap
cliReapStrict(['--My_Key', 'value']).opt('my-key') === null;    // strict: no match
```
<br />



## Duplicates

Each call consumes the first matching option

```ts
const reap = cliReap(['./my-cli', '--out', 'first', '--out', 'second', '--out=third']);
reap.opt('out') === 'first';  // --out first (consumed)
reap.opt('out') === 'second'; // --out second (consumed)
reap.opt('out') === 'third';  // --out=third (consumed)
reap.opt('out') === null;     // no more --out options
```

Naturally, you can leverage this behavior in your CLI api:

```ts
// multiple output files
const reap = cliReap(['./build', '--out', 'dist/', '--out', 'build/', '--out', 'public/']);
const outputs = [];
let output;
while ((output = reap.opt('out')) !== null) { outputs.push(output); }
outputs === ['dist/', 'build/', 'public/'];

// verbose level counting
const reap2 = cliReap(['./app', '-v', '-v', '-v']);
let verboseLevel = 0;
while (reap2.flag('v') !== null) { verboseLevel++; }
verboseLevel === 3;
```
<br />



## Development/Contributing
> Required build dependencies: [Bun](https://bun.sh) and [Make](https://www.gnu.org/software/make/manual/make.html) <br />


### ▎PULL REQUEST STEPS

1. Clone repository
2. Create and switch to a new branch for your work
3. Make and commit changes
4. Run `make release` to clean, setup, build, lint, and test
5. If everything checks out, push branch to repository and submit pull request
<br />

### ▎MAKEFILE REFERENCE

```
# USAGE
   make [flags...] <target>

# TARGET
  -------------------
   run                   executes entry-point (./src/index.ts) via 'bun run'
   release               clean, setup, build, lint, test, aok (everything but the kitchen sink)
  -------------------
   build                 builds the .{js,d.ts} (skips: lint, test, and .min.* build)
   build_cjs             builds the .cjs export
   build_esm             builds the .js (esm) export
   build_declarations    builds typescript .d.{ts,mts,cts} declarations
  -------------------
   install               installs dependencies via bun
   update                updates dependencies
   update_dry            lists dependencies that would be updated via 'make update'
  -------------------
   lint                  lints via tsc & eslint
   lint_eslint           lints via eslint
   lint_eslint_fix       lints and auto-fixes via eslint --fix
   lint_tsc              lints via tsc
   lint_watch            lints via eslint & tsc with fs.watch to continuously lint on change
  -------------------
   test                  runs bun test(s)
   test_watch            runs bun test(s) in watch mode
   test_update           runs bun test --update-snapshots
  -------------------
   help                  displays (this) help screen

# FLAGS
  -------------------
   BUN                   [? ] bun build flag(s) (e.g: make BUN="--banner='// bake until golden brown'")
  -------------------
   CJS                   [?1] builds the cjs (common js) target on 'make release'
   EXE                   [?js|mjs] default esm build extension
   TAR                   [?0] build target env (-1=bun, 0=node, 1=dom, 2=dom+iife, 3=dom+iife+userscript)
   MIN                   [?1] builds minified (*.min.{mjs,cjs,js}) targets on 'make release'
  -------------------
   BAIL                  [?1] fail fast (bail) on the first test or lint error
   ENV                   [?DEV|PROD|TEST] sets the 'ENV' & 'IS_*' static build variables (else auto-set)
   TEST                  [?0] sets the 'IS_TEST' static build variable (always 1 if test target)
   WATCH                 [?0] sets the '--watch' flag for bun/tsc (e.g: WATCH=1 make test)
  -------------------
   DEBUG                 [?0] enables verbose logging and sets the 'IS_DEBUG' static build variable
   QUIET                 [?0] disables pretty-printed/log target (INIT/DONE) info
   NO_COLOR              [?0] disables color logging/ANSI codes
```

<br />



## License

```
MIT License

Copyright (c) 2025 te <legal@fetchTe.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
