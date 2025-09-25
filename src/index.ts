import {
  ENV,
  ARGV,
  GLOBAL_THIS,
} from 'globables';

export type NonEmptyString = string & { length: number };

export type CliReap = Readonly<{
  /** finds any value, in order: argv > environment > globalThis > default; removes from 'cur' argv if present */
  any: <R = string>(keys: string | string[], defaultValue?: R)=>
  R extends undefined ? string | true | null : string | true | R;
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


/**
 * normalizes and removes matching quotes from string values
 * @param  {string} val - string value to normalize
 * @return {string}
 */
export const quoteNorm = (val: string): string => ((/^['"]/).test(val)
  ? val?.replace(/^(['"])(.*)(['"])$/, (m, q1, body, q2) => q1 === q2 ? quoteNorm(body) : m)
  : val);


/**
 * checks if value is a flag (starts with dashes and is not a number)
 * @param  {string} val - value to check
 * @return {boolean}
 */
export const isFlag = (val?: string) => (/^-+\w/).test(val ?? '') && Number.isNaN(Number(val));


/**
 * checks if value is option terminator (--)
 * @param  {string} val - value to check
 * @return {boolean}
 */
const isTerm = (val?: string) => val?.trim() === '--';


/**
 * converts key(s) to array with optional loose matching (hyphen/underscore swapping)
 * @param  {string|string[]} key         - key or array of keys
 * @param  {boolean}         loose=false - enable loose matching
 * @param  {string[]}        _keys       - internal key array
 * @return {string[]}
 */
const toArr = (key: string | string[], loose = false, _keys = (Array.isArray(key) ? key : [key])) =>
  (loose
    // if loose swap '-' and '_' in keys
    ? _keys.map(item =>
      [
        item,
        item.replaceAll(...((item.includes('_') ? ['_', '-'] : ['-', '_']) as [string, string])),
      ]).flat()
    : _keys);


/**
 * creates CLI argument parser that consumes flags, options, and positionals
 * @param  {string[]}            argv=ARGV         - command-line arguments array
 * @param  {NodeJS.ProcessEnv}   env=ENV           - process environment variables
 * @param  {typeof globalThis}   gthis=GLOBAL_THIS - global object for runtime-set/fallback values
 * @param  {boolean}             loose=false       - enable loose matching (case/hyphen/underscore insensitive)
 * @return {CliReap}
 */
export const cliReap = (argv = ARGV, env = ENV, gthis = GLOBAL_THIS, loose = false): CliReap => {
  // makes assumption of a node-like env - if run second arg we assume bun/deno (bun run index.ts)
  const slice = argv[0] === 'node' ? 2 : (argv[1] === 'run' ? 3 : (isFlag(argv[0]) ? 0 : 1));
  const cur = argv.map(String).slice(slice);
  const cmd = argv.map(String).slice(0, slice);
  const end = !!cur.find(isTerm);

  const getArgv = (keys: string | string[], optValue = false) => {
    const keyList = toArr(keys, loose);
    for (let i = 0; i < cur.length; i++) {
      const token = cur[i];
      // the option terminator (--) -> terminates all into positionals (per. POSIX)
      if (isTerm(token)) { break;}
      if (!token || !isFlag(token)) {continue;}
      const hasEq = (/=/).test(token);
      const part = keyList.map(key => {
        // in case literal key passed in such as '--key' or '-key'
        const [k, ...parts] = token.replace(isFlag(key) ? /(?!)/ : /^\s*?-+/, '')
          // ensures 'f' key doesn't match '--flag'
          .split(hasEq && optValue ? `${key}=` : new RegExp(`^${key}$`, loose ? 'i' : ''));
        return !k?.length ? parts.join(key) : (k === key ? key : null);
      })
        .find(v => v !== null) ?? 0;
      if (part === 0) { continue; }

      // if not option handle before others (otherwise might consume positional)
      if (!optValue) {
        cur.splice(i, 1);
        return true;
      }
      // handle --key=value (= already removed from split)
      if (hasEq) {
        cur.splice(i, 1);
        return quoteNorm(part);
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

  const getFlag = (keys: string | string[]) =>
    (getArgv(keys, false) !== null ? true : null);

  const getOpt = <R extends NonEmptyString>(keys: string | string[]) =>
    getArgv(keys, true) as R | null;

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
      // the option terminator (--) -> terminates all into positionals (per. POSIX)
      if (isTerm(token)) { return [...result, ...cur.slice(i + 1)];}
      if (isFlag(token)) { continue; }
      result.push(token);
    }
    return result;
  };

  return {
    any: getAny,
    cmd: () => cmd,
    cur: () => cur,
    end: () => end,
    env: getEnv,
    flag: getFlag,
    opt: getOpt,
    pos: getPos,
  } as const;
};

/**
 * creates CLI argument parser with loose matching enabled (case/hyphen/underscore insensitive)
 * @param  {string[]}            argv=ARGV         - command-line arguments array
 * @param  {NodeJS.ProcessEnv}   procEnv=ENV       - process environment variables
 * @param  {typeof globalThis}   gthis=GLOBAL_THIS - global object for runtime-set/fallback values
 * @return {CliReap}
 */
export const cliReapLoose = (argv = ARGV, procEnv = ENV, gthis = GLOBAL_THIS) =>
  cliReap(argv, procEnv, gthis, true);

export default cliReap;

export {
  ENV,
  ARGV,
};
