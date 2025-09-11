type NonEmptyString = string & { length: number };
type GlobalThis = typeof globalThis;

// empty polyfil for prehistoric node envs to avoid needless runtime errors
const GLOBAL_THIS = typeof globalThis !== 'undefined' ? globalThis : {} as GlobalThis;

/**
 * command-line arguments (pure/iffe wrapped so we can shake the tree)
 * @see {@link https://nodejs.org/api/process.html#processargv|Node.js process.argv docs}
 */
export const ARGV: string[] = /* @__PURE__ */ (() =>
  typeof process === 'undefined'
    /** quickJs {@link https://bellard.org/quickjs/quickjs.html#Global-objects} */
    ? typeof scriptArgs !== 'undefined'
      ? scriptArgs
      : []
    : ((globalThis as never)?.['Deno']
      // if --allow-all is used, no args (like --allow-env), use default
      // @ts-expect-error deno uses 'args' rather than 'argv'
      ? (process['args']?.length ? process['args'] : process['argv'])
      : process['argv']
    ) ?? []
)();


/**
 * process environment (ENV) variables
 * @see {@link https://nodejs.org/api/process.html#processenv|Node.js env docs}
 */
export const ENV = /* @__PURE__ */ (() => typeof process === 'undefined'
  ? {}
  /** deno {@link https://docs.deno.com/runtime/reference/env_variables/#built-in-deno.env} */
  : (!(globalThis as never)?.['Deno']
    ? process['env']
  // deno requires permission to access env: --allow-env
    : (() => {
      try {
        // if --allow-all is used, no toObject (like --allow-env), use default
        // @ts-expect-error deno perms
        return process['env']?.toObject ? process['env']?.toObject() : process['env'];
      } catch (_err) { /* ignore */ }
      return {};
    })())
)() as NodeJS.ProcessEnv;


/**
 * checks for presence of key (flags) in argv
 * @example --example -flag
 * @param  {string | string[]} keys - argv key/id (--key, -key)
 * @param  {string[]} [argv=ARGV]   - command-line argv
 * @return {boolean}
 */
export const hasArgv = (keys: string | string[], argv = ARGV): boolean => !argv?.length
  ? false
  : !!([keys].flat().filter(Boolean).find(key =>
    (new RegExp(`(^|[^\\S])(?:--|-)${key}(=|\\s|$)`, 'i')).test(argv.join(' '))));


// normilizes/remove matching quotes
const quoteNorm = (val: string): string => ((/^['"]/).test(val)
  ? val?.replace(/^(['"])(.*)(['"])$/, (m, q1, body, q2) => q1 === q2 ? quoteNorm(body) : m)
  : val);

// if flag value
const isFlag = (val?: string) => (/^-+\w/).test(val ?? '') && Number.isNaN(Number(val));

// if option terminator (--)
const isTerm = (val?: string) => val?.trim() === '--';

const toArr = (key: string | string[], loose = false, _keys = (Array.isArray(key) ? key : [key])) =>
  (loose
    // if loose swap '-' and '_' in keys
    ? _keys.map(item =>
      [
        item,
        item.replaceAll(...((item.includes('_') ? ['_', '-'] : ['-', '_']) as [string, string])),
      ]).flat()
    : _keys);


export const argvEnvParse = (argv = ARGV, env = ENV, gthis = GLOBAL_THIS, loose = false) => {
  // makes assumption of a node-like env - if run second arg we assume bun/deno (bun run index.ts)
  const slice = argv[0] === 'node' ? 2 : (argv[1] === 'run' ? 3 : (isFlag(argv[0]) ? 0 : 1));
  const cur = argv.map(String).slice(slice);
  const cmd = argv.map(String).slice(0, slice);

  const getArgv = (keys: string | string[], optValue = false) => {
    const keyList = toArr(keys, loose);
    for (let i = 0; i < cur.length; i++) {
      const token = cur[i];
      // the option terminator (--) -> terminates all into positionals
      if (isTerm(token)) {break;}
      if (!token || !isFlag(token)) {continue;}
      const hasEq = (/=/).test(token);
      const part = keyList.map(key => {
        // in case literal key passed in such as '--key' or '-key'
        const [k, ...parts] = token.replace(isFlag(key) ? /(?!)/ : /^\s*?-+/, '')
          // ensures 'f' key doesn't match '--flag'
          .split(hasEq ? key : new RegExp(`${key}$`, loose ? 'i' : ''));
        return !k?.length ? parts.join(key) : (k === key ? key : null);
      })
        .find(v => v !== null) ?? 0;
      if (part === 0) { continue; }

      // if not option handle before others (otherwise might consume positional)
      if (!optValue) {
        cur.splice(i, 1);
        return true;
      }
      // handle --key=value
      if ((/^=/).test(part)) {
        cur.splice(i, 1);
        return quoteNorm(part.slice(1));
      }
      // handle --key value alongside negative numbers
      const next = cur[i + 1];
      if (next !== undefined && !isTerm(next) && (!isFlag(next))) {
        cur.splice(i, 2);
        return quoteNorm(next);
      }
    }
    return null;
  };

  // environment arguments (process > globalThis)
  const getEnv = (keys: string | string[]): string | null => (toArr(keys, loose).map(key =>
    ((key in env)
      ? env[key]
      : (key in gthis)
        ? gthis[key as never]
        : null)).filter(Boolean)[0] ?? null);

  const getFlag = (key: string | string[]) =>
    (getArgv(toArr(key, loose), false) !== null ? true : null);

  const getOpt = <R extends NonEmptyString>(key: string | string[]) =>
    getArgv(key, true) as R | null;

  const getAny = <R = string>(keys: string | string[], defaultValue?: R) =>
    (getOpt(keys)
     ?? getFlag(keys)
     ?? getEnv(keys)
     ?? (defaultValue !== undefined ? defaultValue : null)) as R extends undefined
      ? string | true | null
      : string | true | R;

  // positional arguments
  const getPos = () => {
    const result: string[] = [];
    for (let i = 0; i < cur.length; i++) {
      const token = cur[i];
      if (!token) {continue;}
      // the option terminator (--) -> terminates all into positionals
      if (isTerm(token)) {return [...result, ...cur.slice(i + 1)];}
      if (isFlag(token)) { continue; }
      result.push(token);
    }
    return result;
  };

  return {
    cmd: () => cmd,
    opt: getOpt,
    flag: getFlag,
    any: getAny,
    pos: getPos,
    env: getEnv,
  } as const;
};

export const argvEnvParseLoose = (argv = ARGV, procEnv = ENV, gthis = GLOBAL_THIS) =>
  argvEnvParse(argv, procEnv, gthis, true);

export default argvEnvParse;
