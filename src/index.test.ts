/* eslint-disable no-useless-escape */
/* eslint-disable @stylistic/max-len */
import {
  expect,
  test,
  describe,
} from 'bun:test';
import {
  cliReap,
  cliReapStrict,
} from './index.ts';

// helper to generate different argv variations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createArgvVariations = (flag: string, value: any): [string, (string | number)[]][] => {
  const variations: [string, (string | number)[]][] = [];
  const formats = (
    String(value).includes(' ')
      ? []
      : [
        [`-${flag}`, value], // single dash space
        [`--${flag}`, value], // double dash space
        [`-${flag}=${value}`], // single dash equals
        [`--${flag}=${value}`], // double dash equals
      ]).concat(!String(value).length
    ? []
    : [
      [`-${flag}`, `'${value}'`], // single dash space - '' quotes
      [`--${flag}`, `"${value}"`], // double dash space - "" quotes
      [`-${flag}="${value}"`], // single dash equals - "" quotes
      [`--${flag}='${value}'`], // double dash equals - '' quotes
    ]);
  const afmts = new Set<string>();
  for (const format of formats) {
    const fmt = format.join(' ');
    if (afmts.has(fmt)) { continue; }
    afmts.add(fmt);
    // standard: node script.js [args]
    variations.push([fmt, ['node', 'script.js', ...format] ]);
    // args before node/script
    variations.push([fmt, [...format, 'node', 'script.js'] ]);
    // aixed with other args
    variations.push([fmt, ['this', `--not-${flag}`, value, ...format, '--that', 'example'] ]);
    // args at end with other params
    variations.push([fmt, ['node', 'script.js', `-${flag[0]}`, '--for', `-nor-${flag}=1`, ...format] ]);
    variations.push([fmt, ['./exe', ...format, '-script', '-it'] ]);
    variations.push([fmt, ['/bin/exe', 'script', ...format, '--shelly'] ]);
  }
  return variations;
};


type BaseTestCasesDef = [description: string, key: string, expected: string | boolean | number, override?: string][];
const BASE_TEST_CASES_DEF: BaseTestCasesDef = [
  // basic
  ['basic-string', 'key', 'test'],
  ['basic-string-id', 'key-id', 'test'],
  ['string-space', 'key', 'test space'],
  ['string-space-id', 'key-id', 'test space'],
  ['string-hyphen', 'key', 'test-hyphen'],
  ['string-hyphen-id', 'key-id', 'test-hyphen'],

  ['string-case-sensitive-flag', 'Key', 'test'],
  ['string-case-sensitive-flag-mixed', 'kEy', 'test'],
  ['string-case-sensitive-value', 'key', 'Test'],
  ['string-case-sensitive-value-mixed', 'key', 'tEsT'],

  // special string cases
  ['string-equals-symbol', 'key', '='],

  ['string-whitespace-only', 'key', '   '],
  ['string-backslash', 'key', '\\'],
  ['string-forward-slash', 'key', '/'],
  ['string-unicode-emoji', 'key', '😀'],
  ['string-unicode-special', 'key', '∑'],
  ['string-html-entities', 'key', '<div>'],

  ['string-sql-injection', 'key', "' OR '1'='1"],
  ['string-xss-attempt', 'key', '<script>alert(1)</script>'],
  ['string-null', 'key', 'null'],
  ['string-equals', 'key', '='],
  // eslint-disable-next-line @stylistic/quotes
  ['string-quoted-hyphen', 'key', "'-'", "-"],
  ['string-whitespace', 'key', '   '],
  ['string-special-chars', 'key', '!@#$%^&*()'],
  ['string-unicode', 'key', 'αβγδεζηθικλμνξο'],
  ['string-emoji', 'key', '😀👍'],
  ['string-backslash', 'key', '\\'],
  ['string-double-backslash', 'key', '\\\\'],
  // eslint-disable-next-line @stylistic/quotes
  ['string-single-quoted', 'key', "'single'", "single"],
  // eslint-disable-next-line @stylistic/quotes
  ['string-mulit-quoted', 'key', "'single quoted'", "single quoted"],
  ['string-escaped-quotes', 'key', '\"quoted text\"', 'quoted text'],

  ['string-mixed-quotes', 'key', `'some "quoted text"\\ here'`, 'some "quoted text"\\ here'], // need to escape spaces
  ['string-mixed-quotes', 'key', `'some \'quoted text\'\\ here'`, `some \'quoted text\'\\ here`], // need to escape spaces

  // special key formats
  ['string-camelCase-key', 'camelCaseKey', 'value'],
  ['string-snake_case-key', 'snake_case_key', 'value'],
  ['string-PascalCase-key', 'PascalCaseKey', 'value'],
  ['string-dot.notation-key', 'dot.notation', 'value'],
  ['string-very-long-key', 'this-is-a-very-long-key-name-that-might-cause-issues', 'value'],
  ['string-numeric-key', '123key', 'value'],

  // URL and path related
  ['url-simple', 'url', 'https://example.com'],
  ['url-with-params', 'url', 'https://example.com?param=value'],
  ['url-with-hash', 'url', 'https://example.com#section'],
  ['url-complex', 'url', 'https://user:pass@example.com:8080/path?query=value#fragment'],
  ['file-path-unix', 'path', '/usr/local/bin'],
  ['file-path-windows', 'path', 'C:\\Program Files\\App'],
  ['relative-path', 'path', '../parent/file.txt'],

  // boolean cases
  ['boolean-true', 'key', true],
  ['boolean-false', 'key', false],
  ['string-true', 'key', 'true'],
  ['string-false', 'key', 'false'],
  ['string-uppercase-true', 'key', 'TRUE'],
  ['string-uppercase-false', 'key', 'FALSE'],
  ['string-mixed-case-true', 'key', 'True'],
  ['string-mixed-case-false', 'key', 'False'],

  // number cases
  ['number-zero', 'key', 0],
  ['number-one', 'key', 1],
  ['number-large', 'key', 420],
  ['number-neg-zero', 'key', -0],
  ['number-neg-one', 'key', '-1'],
  ['number-neg-large', 'key', -420],
  ['number-float', 'key', 1.23],
  ['number-neg-float', 'key', -1.23],
  ['number-very-large', 'key', 9007199254740991], // MAX_SAFE_INTEGER
  ['number-very-small', 'key', -9007199254740991], // -MAX_SAFE_INTEGER
  ['string-scientific-notation', 'key', '1.23e+5'],
  ['string-negative-scientific', 'key', '-4.56e-3'],
  ['string-infinity', 'key', 'Infinity'],
  ['string-negative-infinity', 'key', '-Infinity'],
  ['string-not-a-number', 'key', 'NaN'],


  // JSON misc
  // eslint-disable-next-line @stylistic/comma-spacing
  ['json-array', 'json', JSON.stringify([1,2,3])],
  ['json-number', 'json', JSON.stringify(1)],
  ['json-zero', 'json', JSON.stringify(0)],
  ['json-negative', 'json', JSON.stringify(-1)],
  ['json-negative-zero', 'json', JSON.stringify(-0)],
  ['json-decimal', 'json', JSON.stringify(1.420)],
  ['json-negative-decimal', 'json', JSON.stringify(-4.20)],
  ['json-object', 'json', JSON.stringify({a: 1, b: true, c: null})],
  ['json-string-array', 'json', JSON.stringify(['a', 'b', 'c'])],
  // eslint-disable-next-line @stylistic/array-bracket-spacing
  ['json-css-array', 'json', JSON.stringify([ 'color:#0000;margin:0 -1px 0 -1ch;', 'color:^;', 'border-right:2px solid ^;', 'margin:-1px;font-family:Menlo,monospace;' ])],
  // eslint-disable-next-line @stylistic/comma-spacing
  ['js-dash-array', 'js-dash', JSON.stringify([1,2,3])],
  ['js-dash-number', 'js-dash', JSON.stringify(1)],
  ['js-dash-zero', 'js-dash', JSON.stringify(0)],
  ['js-dash-decimal', 'js-dash', JSON.stringify(1.420)],
  ['js-dash-negative-decimal', 'js-dash', JSON.stringify(-4.20)],
  ['js-dash-object', 'js-dash', JSON.stringify({a: 1, b: true, c: null})],
  ['js-dash-string-array', 'js-dash', JSON.stringify(['a', 'b', 'c'])],
  // eslint-disable-next-line @stylistic/array-bracket-spacing
  ['js-dash-css-array', 'js-dash', JSON.stringify([ 'color:#0000;margin:0 -1px 0 -1ch;', 'color:^;', 'border-right:2px solid ^;', 'margin:-1px;font-family:Menlo,monospace;' ])],

  // JSON edge cases
  ['json-empty-object', 'json', JSON.stringify({})],
  ['json-empty-array', 'json', JSON.stringify([])],
  ['json-nested-object', 'json', JSON.stringify({a: {b: {c: 1}}})],
  ['json-nested-array', 'json', JSON.stringify([1, [2, [3, 4] ], 5])],
  ['json-null-value', 'json', JSON.stringify(null)],

  // security misc
  ['security-injection', 'key', ';rm -rf /'],
  ['security-sql', 'key', 'DROP TABLE users;'],
  ['security-script', 'key', '<script>alert(1)</script>'],
  ['security-encoded', 'key', encodeURIComponent('<script>alert(1)</script>')],

  // malformed inputs
  ['malformed-json', 'json', '{invalid json'],
  ['malformed-value-brackets', 'key', '[test'],
  ['malformed-value-braces', 'key', '{test'],
  ['malformed-value-parentheses', 'key', '(test'],
  ['malformed-value-angle', 'key', '<test'],
  ['malformed-value-mixed', 'key', '[te{st}'],

  // edge cases
  ['edge-value-leading-space', 'key', ' test'],
  ['edge-value-trailing-space', 'key', 'test '],
  ['edge-value-both-spaces', 'key', ' test '],
  ['edge-value-equals-start', 'key', '=test'],
  ['edge-value-equals-end', 'key', 'test='],
  ['edge-value-equals-middle', 'key', 'te=st'],
  ['edge-value-multi-equals', 'key', '==test=='],
  ['edge-value-null-json', 'key', JSON.stringify(null)],
  ['edge-escaped-newline', 'key', '\\n', '\\n'],
  ['edge-escaped-tab', 'key', '\\t', '\\t'],
  ['edge-escaped-return', 'key', '\\r', '\\r'],
  ['edge-value-undefined-as-string', 'key', 'undefined'],
  ['edge-value-null-as-string', 'key', 'null'],

];

const BASE_TEST_CASES = BASE_TEST_CASES_DEF.flatMap(([label, key, val, override], idx) => createArgvVariations(key, val)
  .map(([variation, argv], i) => [
    `variation:${String(idx).padStart(3, '0')} ${label} -> i:${String(i).padStart(2, '0')} -> ${variation}`,
    key,
    override ?? (typeof val === 'string' ? val : String(val)),
    argv,
  ] as [string, string, string, (string | number)[]]));


describe('argvParse().opt()/variation', () => {
  for (const [description, key, expected, argv] of BASE_TEST_CASES) {
    test(description, () => {
      const result = cliReap(argv as string[]).opt(key);
      result !== expected
        && console.error(`${key} !== ${expected}: `, argv.join(' '));
      expect(result).toBe(expected);
    });
  }
});

describe('argvParse().any()/variation (for flags)', () => {
  for (const [description, flag, _expected, argv] of BASE_TEST_CASES) {
    test(description, () => {
      const isPresent = cliReap(argv as string[]).any(flag) !== null;
      isPresent !== true
        && console.error(`"${flag}" !== ${true}: `, argv.join(' '));
      expect(isPresent).toBe(true);

      const isOtherPresent = cliReap(argv as string[]).any(`other-${flag}`) !== null;
      isOtherPresent
        && console.error(`other-${flag} !== ${false}: `, argv.join(' '));
      expect(isOtherPresent).toBe(false);

      if (flag) {
        const isOtherPresent2 = cliReap(argv as string[]).any(`${flag}-other`) !== null;
        isOtherPresent2
          && console.error(`${flag}-other !== ${false}: `, argv.join(' '));
        expect(isOtherPresent2).toBe(false);
      }

      const isAnotherPresent = cliReap(argv as string[]).any(`another-${flag}-other`) !== null;
      isAnotherPresent
        && console.error(`another-${flag}-other !== ${false}: `, argv.join(' '));
      expect(isAnotherPresent).toBe(false);
    });
  }
});


describe('argvParseLoose()', () => {
  test('swaps hyphens and underscores for key matching', () => {
    expect(cliReap(['-i-test', 'test']).opt('i-test')).toBe('test');
    expect(cliReap(['-i-test', 'test']).opt('i_test')).toBe('test');
    expect(cliReap(['-i_test', 'test']).opt('i-test')).toBe('test');

    expect(cliReapStrict(['-i-test', 'test']).opt('i-test')).toBe('test');
    expect(cliReapStrict(['-i-test', 'test']).opt('i_test')).toBe(null);
    expect(cliReapStrict(['-i_test', 'test']).opt('i-test')).toBe(null);
  });

  test('matches keys case-insensitively', () => {
    expect(cliReap(['--I', 'test']).opt('i')).toBe('test');
    expect(cliReap(['-I', 'test']).opt('i')).toBe('test');
    expect(cliReap(['--i', 'test']).opt('I')).toBe('test');
    expect(cliReap(['-i', 'test']).opt('I')).toBe('test');
    expect(cliReap(['--I', 'test']).opt('I')).toBe('test');
    expect(cliReap(['-I', 'test']).opt('I')).toBe('test');
    expect(cliReap(['--i', 'test']).opt('i')).toBe('test');
    expect(cliReap(['-i', 'test']).opt('i')).toBe('test');

    expect(cliReapStrict(['--I', 'test']).opt('i')).toBe(null);
    expect(cliReapStrict(['-I', 'test']).opt('i')).toBe(null);
    expect(cliReapStrict(['--i', 'test']).opt('I')).toBe(null);
    expect(cliReapStrict(['-i', 'test']).opt('I')).toBe(null);
    expect(cliReapStrict(['--I', 'test']).opt('I')).toBe('test');
    expect(cliReapStrict(['-I', 'test']).opt('I')).toBe('test');
    expect(cliReapStrict(['--i', 'test']).opt('i')).toBe('test');
    expect(cliReapStrict(['-i', 'test']).opt('i')).toBe('test');
  });
});

describe('cliReap().opt()', () => {
  describe('Key Matching and Edge Cases', () => {
    test('is case-sensitive in strict mode', () => {
      expect(cliReapStrict(['--I', 'test']).opt('i')).toBe(null);
      expect(cliReapStrict(['-I', 'test']).opt('i')).toBe(null);
      expect(cliReapStrict(['--i', 'test']).opt('I')).toBe(null);
      expect(cliReapStrict(['-i', 'test']).opt('I')).toBe(null);
      expect(cliReapStrict(['--I', 'test']).opt('I')).toBe('test');
      expect(cliReapStrict(['-I', 'test']).opt('I')).toBe('test');
      expect(cliReapStrict(['--i', 'test']).opt('i')).toBe('test');
      expect(cliReapStrict(['-i', 'test']).opt('i')).toBe('test');
    });

    test('returns null for an empty key', () => {
      expect(cliReap(['--ptag-id', 'test']).opt('')).toBe(null);
    });

    test('returns null for a whitespace key', () => {
      expect(cliReap(['--ptag-id', 'test']).opt(' ')).toBe(null);
      expect(cliReap(['-- ', 'test']).opt(' ')).toBe(null);
    });

    test('returns null for a single hyphen key', () => {
      expect(cliReap(['--ptag-id', 'test']).opt('-')).toBe(null);
      expect(cliReap(['-id', 'test']).opt('-')).toBe(null);
    });

    test('handles extra leading hyphens in keys', () => {
      expect(cliReap(['---key', 'test']).opt('key')).toBe('test');
    });

    test('matches literal keys including their hyphens', () => {
      // if literal key, only
      expect(cliReap(['--key', 'test']).opt('key')).toBe('test');
      expect(cliReap(['--key', 'test']).opt('-key')).toBe(null);
      expect(cliReap(['--key', 'test']).opt('---key')).toBe(null);
      expect(cliReap(['--key', 'test']).opt('--key')).toBe('test');
      expect(cliReap(['-key', 'test']).opt('-key')).toBe('test');
      expect(cliReap(['---key', 'test']).opt('---key')).toBe('test');
    });
  });

  describe('Value Parsing and Quote Handling', () => {
    test('preserves values with only whitespace', () => {
      expect(cliReap(['--ptag-id=" "']).opt('ptag-id')).toBe(' ');
      expect(cliReap(['--ptag-id', ' ']).opt('ptag-id')).toBe(' ');
    });

    test('preserves values with tab characters', () => {
      expect(cliReap(['--ptag-id="\t"']).opt('ptag-id')).toBe('\t');
      expect(cliReap(['--ptag-id', '"\t"']).opt('ptag-id')).toBe('\t');
    });

    test('preserves apostrophes inside non-matching quotes', () => {
      expect(cliReap(['./ok', '--key', `"but, srsly'"`]).opt('key')).toBe(`but, srsly'`);
    });

    test('strips matching quotes around values with apostrophes', () => {
      expect(cliReap(['./ok', `--key="shoudn't be an issue"`]).opt('key')).toBe(`shoudn't be an issue`);
    });

    test('handles complex nested and recursive quotes', () => {
      expect(cliReap(['./ok', '--key', `"''''"`]).opt('key')).toBe('');
      expect(cliReap(['./ok', '--key', `'""""'`]).opt('key')).toBe('');
      expect(cliReap(['./ok', '--key', `'""silly""'`]).opt('key')).toBe('silly');
      expect(cliReap(['./ok', '--key', `'\'"\'"\'"\'"'`]).opt('key')).toBe(`'"'"'"'"`);
      expect(cliReap(['./ok', '--key', `'::::'`]).opt('key')).toBe('::::');
    });

    test('preserves special characters in values', () => {
      expect(cliReap(['./ok', '--key=[o{k']).opt('key')).toBe('[o{k');
      expect(cliReap(['./ok', '--key', '[o{k']).opt('key')).toBe('[o{k');
      expect(cliReap(['./ok', '-key===<this/works>']).opt('key')).toBe('==<this/works>');
      expect(cliReap(['./ok', '-key', '<this/works>']).opt('key')).toBe('<this/works>');
    });

    test('preserves escaped characters in values', () => {
      expect(cliReap(['node', 'file.js', '--ptag-id="\a\b\c"']).opt('ptag-id')).toBe('\a\b\c');
      expect(cliReap(['node', 'file.js', '--ptag-id="\\a\\b\\c"']).opt('ptag-id'))
        .toBe('\\a\\b\\c');
      expect(cliReap(['node', 'file.js', '--ptag-id=' + JSON.stringify('\'')]).opt('ptag-id')).toBe(`'`);
      // shell/JSON behavior, not parser, but good to confirm
      expect(cliReap(['node', 'file.js', '--ptag-id=' + JSON.stringify('\f\n\r\t')]).opt('ptag-id'))
        .toBe('\\f\\n\\r\\t');
    });

    test('passes through JSON string array values as-is', () => {
      const argv = ['node', 'script.js'];
      expect(cliReap(argv.concat(`--ptag-id="${JSON.stringify(['a', 'b', 'c'])}"`)).opt('ptag-id'))
        .toBe(JSON.stringify(['a', 'b', 'c']));
      expect(cliReap(argv.concat(`--ptag-id='${JSON.stringify(['a', 'b', 'c'])}'`)).opt('ptag-id'))
        .toBe(JSON.stringify(['a', 'b', 'c']));
      expect(cliReap(argv.concat('--ptag-id', '["a","b","c"]')).opt('ptag-id'))
        .toBe(JSON.stringify(['a', 'b', 'c']));
    });

    test('passes through JSON string array with spaces as-is', () => {
      const argv = ['node', 'script.js'];
      expect(cliReap(argv.concat(`--ptag-id='${JSON.stringify([' a ', ' b', 'c '])}'`)).opt('ptag-id'))
        .toBe(JSON.stringify([' a ', ' b', 'c ']));
      // eslint-disable-next-line @stylistic/quotes
      expect(cliReap(argv.concat(`--ptag-id`, "[\" a \",\" b\",\"c \"]")).opt('ptag-id'))
        .toBe(JSON.stringify([' a ', ' b', 'c ']));
    });

    test('passes through JSON object values as-is', () => {
      const argv = ['node', 'script.js'];
      const jsonObjStr = JSON.stringify({ a: 1, b: true, c: null });
      const jsonObjSpaceStr = JSON.stringify({ a: 1, b: true, c: null, d: ' test ' });

      expect(cliReap(argv.concat(`--ptag-id="${jsonObjStr}"`)).opt('ptag-id'))
        .toBe(jsonObjStr);
      expect(cliReap(argv.concat('--ptag-id', `"${jsonObjStr}"`)).opt('ptag-id'))
        .toBe(jsonObjStr);
      expect(cliReap(argv.concat('--ptag-id', jsonObjStr)).opt('ptag-id'))
        .toBe(jsonObjStr);
      expect(cliReap(argv.concat(`--ptag-id='${jsonObjSpaceStr}'`)).opt('ptag-id'))
        .toBe(jsonObjSpaceStr);
      expect(cliReap(argv.concat('--ptag-id', jsonObjSpaceStr)).opt('ptag-id'))
        .toBe(jsonObjSpaceStr);
    });
  });
});


describe('cliReap().flag()', () => {
  test('returns true for a present long-form flag', () => {
    expect(cliReap(['--verbose']).flag('verbose')).toBe(true);
  });

  test('returns true for a present short-form flag', () => {
    expect(cliReap(['-v']).flag('v')).toBe(true);
  });

  test('returns null for a non-existent flag', () => {
    expect(cliReap(['--other']).flag('verbose')).toBe(null);
  });

  test('does not consume the following argument', () => {
    const src = ['--verbose', 'file.txt'];
    const parser = cliReap(src);
    expect(parser.cmd()).toEqual([]);
    expect(parser.cur()).toEqual(src);
    expect(parser.flag('verbose')).toBe(true);
    expect(parser.cur().join()).toEqual(['file.txt'].join());
    const pos = parser.pos();
    expect(pos).toEqual(['file.txt']);
  });

  test('is case-sensitive in strict mode', () => {
    expect(cliReapStrict(['--VERBOSE']).flag('verbose')).toBe(null);
    expect(cliReapStrict(['--VERBOSE']).flag('VERBOSE')).toBe(true);
    expect(cliReap(['--VERBOSE']).flag('verbose')).toBe(true);
    expect(cliReap(['--VERBOSE']).flag('VERBOSE')).toBe(true);
  });
});


describe('cliReap().any() - Flag Presence', () => {
  test('returns true if any flag in an array is present (first match)', () => {
    expect(cliReap(['--flag']).any(['f', 'flag'])).toBe(true);
  });

  test('returns true if any flag in an array is present (second match)', () => {
    expect(cliReap(['--flag']).any(['flag', 'f'])).toBe(true);
  });

  test('returns null if no flag in an array is present', () => {
    expect(cliReap(['--flag']).any(['a', 'f'])).toBe(null);
  });

  test('returns true for a double-dashed flag', () => {
    expect(cliReap(['--flag']).any('flag')).toBe(true);
  });

  test('returns true for a single-dashed flag', () => {
    expect(cliReap(['-flag']).any('flag')).toBe(true);
  });

  test('returns value for a flag with an assigned value', () => {
    expect(cliReap(['--flag=value']).any('flag')).toBe('value');
  });

  test('returns value for a flag with a subsequent value', () => {
    expect(cliReap(['--flag', 'value']).any('flag')).toBe('value');
  });

  test('returns value for a single-dashed flag with an assigned value', () => {
    expect(cliReap(['-flag=value']).any('flag')).toBe('value');
  });

  test('returns value for a single-dashed flag with a subsequent value', () => {
    expect(cliReap(['-flag', 'value']).any('flag')).toBe('value');
  });

  test('returns null if the flag does not exist', () => {
    expect(cliReap(['--other-flag']).any('flag')).toBe(null);
  });

  test('returns null if argv is empty', () => {
    expect(cliReap([]).any('flag')).toBe(null);
  });

  test('is case-sensitive for flags', () => {
    expect(cliReap(['--FLAG']).any('flag')).toBe(true);
    expect(cliReap(['--FLAG']).any('FLAG')).toBe(true);
    expect(cliReapStrict(['--FLAG']).any('flag')).toBe(null);
    expect(cliReapStrict(['--FLAG']).any('FLAG')).toBe(true);
  });

  test('is case-sensitive for single-dashed flags', () => {
    expect(cliReap(['-FLAG']).any('flag')).toBe(true);
    expect(cliReap(['-FLAG']).any('FLAG')).toBe(true);
    expect(cliReapStrict(['-FLAG']).any('flag')).toBe(null);
    expect(cliReapStrict(['-FLAG']).any('FLAG')).toBe(true);
  });

  test('is case-sensitive for flags with values', () => {
    expect(cliReap(['--FLAG=value']).any('flag')).toBe(null);
    expect(cliReap(['--FLAG=value']).any('FLAG')).toBe('value');
  });

  test('finds a option at the beginning of argv', () => {
    expect(cliReap(['--flag', 'node', 'script.js']).any('flag')).toBe('node');
  });

  test('finds a single-dashed option at the beginning of argv', () => {
    expect(cliReap(['-flag', 'node', 'script.js']).any('flag')).toBe('node');
  });

  test('returns value for a flag with an assigned value using an array', () => {
    const src = ['--this', '--flag=value', '--other'];
    const arg = cliReap(src);
    expect(arg.cmd().join()).toBe('');
    expect(arg.cur().join()).toBe(src.join());
    expect(arg.any(['flag', 'other'])).toBe('value');
    expect(arg.any(['flag', 'other'])).toBe(true);
    expect(arg.any(['flag', 'other'])).toBe(null);
    expect(arg.cur().join()).toBe('--this');
  });
});


describe('cliReap().any() - Value Retrieval and Fallbacks', () => {
  test('returns true for a flag without a value', () => {
    expect(cliReap(['--flag']).any('flag')).toBe(true);
  });

  test('returns the value for a flag with an assigned value', () => {
    expect(cliReap(['--flag=value']).any('flag')).toBe('value');
  });

  test('returns the value for a flag with a subsequent value', () => {
    expect(cliReap(['--flag', 'value']).any('flag')).toBe('value');
  });

  test('handles quoted values correctly', () => {
    expect(cliReap(['--flag="quoted value"']).any('flag')).toBe('quoted value');

    expect(cliReap(['--flag', "'quoted value'"]).any('flag')).toBe('quoted value');
  });

  test('handles empty quoted values', () => {
    const argv = ['node', 'script.js'];

    expect(cliReap(argv.concat("--flag=''")).any('flag')).toBe('');
    expect(cliReap(argv.concat('--flag=""')).any('flag')).toBe('');

    expect(cliReap(["--flag=''", ...argv]).any('flag')).toBe('');
    expect(cliReap(['--flag=""', ...argv]).any('flag')).toBe('');
  });

  test('correctly parses a flag that is a substring of another flag', () => {
    let argv = ['node', 'script.js', '--flag-o', '--flag'];
    expect(cliReap(argv).any('flag')).toBe(true);
    argv = ['node', 'script.js', '--flag', '--flag-o'];
    expect(cliReap(argv).any('flag')).toBe(true);
    argv = ['node', 'script.js', '--flag=yes', '--flag-o'];
    expect(cliReap(argv).any('flag')).toBe('yes');
    argv = ['node', 'script.js', '--flag-o', '--flag=yes'];
    expect(cliReap(argv).any('flag')).toBe('yes');
  });

  test('falls back to environment variables', () => {
    const procEnv = { MY_KEY: 'env_value' };
    expect(cliReap([], procEnv).any('MY_KEY')).toBe('env_value');
  });

  test('falls back to globalThis', () => {
    const gthis = { MY_KEY: 'gthis_value' } as never as typeof globalThis;
    expect(cliReap([], {}, gthis).any('MY_KEY')).toBe('gthis_value');
  });

  test('falls back to default value', () => {
    expect(cliReap([]).any('key', 'default_value')).toBe('default_value');
  });

  test('prioritizes argv > env > global > default', () => {
    const argv = ['--key=argv_val'];
    const procEnv = { key: 'env_val' };
    const gthis = { key: 'gthis_val' } as never as typeof globalThis;
    expect(cliReap(argv, procEnv, gthis).any('key', 'default_val')).toBe('argv_val');
    expect(cliReap([], procEnv, gthis).any('key', 'default_val')).toBe('env_val');
    expect(cliReap([], {}, gthis).any('key', 'default_val')).toBe('gthis_val');
  });
});


describe('cliReap().pos()', () => {
  describe('Initial State (No Arguments Parsed)', () => {
    test('returns an empty array when no positionals are present', () => {
      expect(cliReap([]).pos()).toEqual([]);
      expect(cliReap(['node']).pos()).toEqual([]);
      expect(cliReap(['node', 'script.js']).pos()).toEqual([]);
    });

    test('returns an empty array when only flags/options are present', () => {
      expect(cliReap(['node', 'script.js', '--verbose', '-d', '--force']).pos()).toEqual([]);
      expect(cliReap(['node', 'script.js', '--output=file.txt', '-l', '10']).pos()).toEqual(['10']);
      expect(cliReap(['node', 'script.js', '--output', '/path/to/file']).pos()).toEqual(['/path/to/file']);
    });

    test('finds a single positional argument', () => {
      expect(cliReap(['node', 'script.js', 'source.txt']).pos()).toEqual(['source.txt']);
    });

    test('finds multiple positional arguments', () => {
      expect(cliReap(['node', 'script.js', 'source.txt', 'dest.txt']).pos())
        .toEqual(['source.txt', 'dest.txt']);
    });

    test('finds positionals mixed with unparsed options', () => {
      const argv = ['node', 'script.js', 'copy', '--verbose', 'src.zip', '--output', 'dest.zip', 'backup'];
      // before parsing, anything not an option's value is positional
      expect(cliReap(argv).pos()).toEqual(['copy', 'src.zip', 'dest.zip', 'backup']);
      const ctx = cliReap(argv);
      expect(ctx.opt('output')).toEqual('dest.zip');
      expect(ctx.pos()).toEqual(['copy', 'src.zip', 'backup']);
    });

    test('finds positionals at the beginning, middle, and end', () => {
      expect(cliReap(['node', 'script.js', 'pos1', '--flag', '--opt=1']).pos()).toEqual(['pos1']);
      expect(cliReap(['node', 'script.js', '--opt=val', 'pos2', '-f']).pos()).toEqual(['pos2']);
    });
  });

  describe('State after Parsing Arguments', () => {
    test('excludes known flags but not their subsequent arguments', () => {
      const parser = cliReap(['node', 'script.js', '--verbose', 'file.txt', '--force', 'another.txt']);
      parser.flag('verbose');
      parser.flag('force');
      expect(parser.pos()).toEqual(['file.txt', 'another.txt']);
    });

    test('handles both long and short versions of known flags', () => {
      const parser = cliReap(['node', 'script.js', '-v', 'pos1', '-f', 'pos2']);
      parser.flag('v');
      parser.flag('f');
      expect(parser.pos()).toEqual(['pos1', 'pos2']);
    });

    test('excludes known options and their values', () => {
      const parser = cliReap(['node', 'script.js', '--output', 'file.txt', '--verbose', 'positional']);
      parser.flag('verbose');
      parser.opt('output');
      expect(parser.pos()).toEqual(['positional']);
    });

    test('identifies positionals among a mix of parsed flags and options', () => {
      const argv = ['./exe', '-m', '--mode', 'fuzz', '--fast', 'input.jpg', 'output.jpg'];
      const parser = cliReap(argv);
      parser.flag('m');
      parser.flag('fast');
      parser.opt('mode');
      expect(parser.pos()).toEqual(['input.jpg', 'output.jpg']);
    });

    test('returns empty array if only known flags and options are present', () => {
      const parser = cliReap(['node', 'script.js', '--output', 'file.txt', '-v', '--force']);
      parser.flag('v');
      parser.flag('force');
      parser.opt('output');
      expect(parser.pos()).toEqual([]);
    });

    test('differentiates between parsing a flag vs an option of the same name', () => {
      const argv = ['node', 'script.js', '--flag', 'value', 'pos1'];
      const flagParser = cliReap(argv);
      expect(flagParser.end()).toEqual(false);

      flagParser.flag('flag');
      expect(flagParser.pos()).toEqual(['value', 'pos1']);

      const optParser = cliReap(argv);
      optParser.opt('flag');
      expect(optParser.pos()).toEqual(['pos1']);
    });
  });

  describe('with -- terminator', () => {
    test('treats all arguments after -- as positional', () => {
      const parser = cliReap(['node', 'script.js', '--flag', '--', 'pos1', '--not-a-flag', '-n']);
      expect(parser.flag('node')).toEqual(null);
      expect(parser.flag('flag')).toEqual(true);
      expect(parser.flag('not-a-flag')).toEqual(null);
      expect(parser.flag('-n')).toEqual(null);
      expect(parser.pos()).toEqual(['pos1', '--not-a-flag', '-n']);
    });

    test('finds positionals both before and after --', () => {
      const parser = cliReap(['node', 'script.js', 'pos1', '--opt=val', '--', 'pos2', '-f']);
      expect(parser.end()).toEqual(true);
      expect(parser.opt('opt')).toEqual('val');
      expect(parser.opt('opt')).toEqual(null);
      expect(parser.end()).toEqual(true);
      // should not clear out/remove positional
      expect(parser.pos()).toEqual(['pos1', 'pos2', '-f']);
      expect(parser.pos()).toEqual(['pos1', 'pos2', '-f']);
      expect(parser.pos()).toEqual(['pos1', 'pos2', '-f']);
      expect(parser.pos()).toEqual(['pos1', 'pos2', '-f']);
    });

    test('returns empty array if -- is the only argument after the script', () => {
      expect(cliReap(['node', 'script.js', '--']).end()).toEqual(true);
      expect(cliReap(['node', 'script.js', '--']).pos()).toEqual([]);
    });

    test('handles a second -- as a positional argument', () => {
      expect(cliReap(['node', 'script.js', '--', '--']).end()).toEqual(true);
      expect(cliReap(['node', 'script.js', '--', '--']).pos()).toEqual(['--']);
    });
  });

  describe('with Edge-Case Positional Values', () => {
    test('treats a single dash (-) as a positional argument', () => {
      expect(cliReap(['test', '-', 'out.txt']).pos()).toEqual(['-', 'out.txt']);
    });

    test('handles numeric-looking strings as positionals', () => {
      expect(cliReap(['test', '123', '456.7', '-99']).pos()).toEqual(['123', '456.7', '-99']);
    });

    test('handles file paths as positionals', () => {
      expect(cliReap(['/path/to/source', './dest.txt']).pos()).toEqual(['./dest.txt']);
    });

    test('handles a URL as a positional argument', () => {
      expect(cliReap(['curl', 'https://example.com']).pos()).toEqual(['https://example.com']);
    });

    test('handles positionals that contain hyphens', () => {
      expect(cliReap(['some-value', 'another-value']).pos()).toEqual(['another-value']);
    });

    test('handles a single positional that contains spaces (pre-parsed by shell)', () => {
      expect(cliReap(['run', 'a value with spaces']).pos()).toEqual(['a value with spaces']);
    });
  });
});

describe('cliReap().cmd()', () => {
  test('identifies command for "node"', () => {
    expect(cliReap(['node', 'script.js', 'positional']).cmd()).toEqual(['node', 'script.js']);
    expect(cliReap(['node', 'script.js', 'positional']).cur()).toEqual(['positional']);
  });

  test('identifies command for "bun run"', () => {
    const argv = ['bun', 'run', 'script.ts', '--flag', 'value', 'pos1'];
    expect(cliReap(argv).cmd()).toEqual(['bun', 'run', 'script.ts']);
  });

  test('identifies command for an unknown/direct executable', () => {
    expect(cliReap(['./my-cli', 'arg1', 'arg2']).cmd()).toEqual(['./my-cli']);
  });

  test('returns an empty array if the first argument is a flag', () => {
    expect(cliReap(['--flag', 'arg1']).cmd()).toEqual([]);
  });
});

describe('cliReap().env()', () => {
  const procEnv = { 'FROM_PROC': 'proc_val', 'MY-VAR': 'val' };
  const gthis = { FROM_GTHIS: 'gthis_val' } as never as typeof globalThis;

  test('retrieves a value from procEnv', () => {
    expect(cliReap([], procEnv, gthis).env('FROM_PROC')).toBe('proc_val');
  });

  test('retrieves a value from globalThis as a fallback', () => {
    expect(cliReap([], procEnv, gthis).env('FROM_GTHIS')).toBe('gthis_val');
  });

  test('returns null if the key is not found anywhere', () => {
    expect(cliReap([], procEnv, gthis).env('NOT_FOUND')).toBe(null);
  });

  test('handles loose matching of hyphens and underscores when enabled', () => {
    expect(cliReap([], procEnv).env('MY_VAR')).toBe('val');
    expect(cliReapStrict([], procEnv).env('MY_VAR')).toBe(null);
  });
});

describe('cliReap() - Duplicate Flags/Options', () => {
  describe('Duplicate Options with Values', () => {
    test('handles duplicate options with different values - first call gets first occurrence', () => {
      const argv = ['./my-cli', '--out', 'one', '--out', 'two'];
      const parser = cliReap(argv);
      expect(parser.opt('out')).toBe('one');
      expect(parser.opt('out')).toBe('two');
      expect(parser.opt('out')).toBe(null);
    });

    test('handles duplicate options using equals syntax', () => {
      const argv = ['./my-cli', '--out=first', '--out=second', '--out=third'];
      const parser = cliReap(argv);
      expect(parser.opt('out')).toBe('first');
      expect(parser.opt('out')).toBe('second');
      expect(parser.opt('out')).toBe('third');
      expect(parser.opt('out')).toBe(null);
    });

    test('handles mixed equals and space syntax for duplicate options', () => {
      const argv = ['./my-cli', '--out=first', '--out', 'second', '--out=third'];
      const parser = cliReap(argv);
      expect(parser.opt('out')).toBe('first');
      expect(parser.opt('out')).toBe('second');
      expect(parser.opt('out')).toBe('third');
      expect(parser.opt('out')).toBe(null);
    });

    test('handles duplicate short options', () => {
      const argv = ['./my-cli', '-o', 'first', '-o', 'second'];
      const parser = cliReap(argv);
      expect(parser.opt('o')).toBe('first');
      expect(parser.opt('o')).toBe('second');
      expect(parser.opt('o')).toBe(null);
    });

    test('handles mixed long and short options for same key', () => {
      const argv = ['./my-cli', '--output', 'first', '-o', 'second'];
      const parser = cliReap(argv);
      expect(parser.opt('output')).toBe('first');
      expect(parser.opt('o')).toBe('second');
    });

    test('handles many duplicate options', () => {
      const argv = ['./my-cli', '--flag', 'a', '--flag', 'b', '--flag', 'c', '--flag', 'd', '--flag', 'e'];
      const parser = cliReap(argv);
      expect(parser.opt('flag')).toBe('a');
      expect(parser.opt('flag')).toBe('b');
      expect(parser.opt('flag')).toBe('c');
      expect(parser.opt('flag')).toBe('d');
      expect(parser.opt('flag')).toBe('e');
      expect(parser.opt('flag')).toBe(null);
    });

    test('duplicate options preserve positional arguments', () => {
      const argv = ['./my-cli', 'pos1', '--out', 'one', 'pos2', '--out', 'two', 'pos3'];
      const parser = cliReap(argv);
      expect(parser.opt('out')).toBe('one');
      expect(parser.opt('out')).toBe('two');
      expect(parser.pos()).toEqual(['pos1', 'pos2', 'pos3']);
    });
  });

  describe('Duplicate Flags', () => {
    test('handles duplicate boolean flags', () => {
      const argv = ['./my-cli', '--verbose', '--verbose', '--verbose'];
      const parser = cliReap(argv);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.flag('verbose')).toBe(null);
    });

    test('handles duplicate short flags', () => {
      const argv = ['./my-cli', '-v', '-v', '-v'];
      const parser = cliReap(argv);
      expect(parser.flag('v')).toBe(true);
      expect(parser.flag('v')).toBe(true);
      expect(parser.flag('v')).toBe(true);
      expect(parser.flag('v')).toBe(null);
    });

    test('duplicate flags preserve positional arguments', () => {
      const argv = ['./my-cli', 'pos1', '--verbose', 'pos2', '--verbose', 'pos3'];
      const parser = cliReap(argv);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.pos()).toEqual(['pos1', 'pos2', 'pos3']);
    });
  });

  describe('Duplicate Mixed Types', () => {
    test('handles same key as both flag and option in different calls', () => {
      const argv = ['./my-cli', '--debug', '--debug', 'verbose', '--debug'];
      const parser = cliReap(argv);
      expect(parser.flag('debug')).toBe(true);
      expect(parser.opt('debug')).toBe('verbose');
      expect(parser.flag('debug')).toBe(true);
      expect(parser.flag('debug')).toBe(null);
    });

    test('handles mixed duplicate options and flags with different keys', () => {
      const argv = ['./my-cli', '--verbose', '--out', 'file1', '--verbose', '--out', 'file2'];
      const parser = cliReap(argv);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.opt('out')).toBe('file1');
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.opt('out')).toBe('file2');
      expect(parser.flag('verbose')).toBe(null);
      expect(parser.opt('out')).toBe(null);
    });
  });

  describe('any() with Duplicate Options/Flags', () => {
    test('any() handles duplicate options - returns first value, then subsequent calls check remaining args', () => {
      const argv = ['./my-cli', '--out', 'one', '--out', 'two'];
      const parser = cliReap(argv);
      expect(parser.any('out')).toBe('one');
      expect(parser.any('out')).toBe('two');
      expect(parser.any('out')).toBe(null);
    });

    test('any() handles duplicate flags', () => {
      const argv = ['./my-cli', '--verbose', '--verbose'];
      const parser = cliReap(argv);
      expect(parser.any('verbose')).toBe(true);
      expect(parser.any('verbose')).toBe(true);
      expect(parser.any('verbose')).toBe(null);
    });
  });

  describe('cur() State with Duplicates', () => {
    test('cur() reflects consumed arguments after each duplicate option call', () => {
      const argv = ['./my-cli', '--out', 'one', '--out', 'two', 'pos'];
      const parser = cliReap(argv);
      expect(parser.cur()).toEqual(['--out', 'one', '--out', 'two', 'pos']);
      expect(parser.opt('out')).toBe('one');
      expect(parser.cur()).toEqual(['--out', 'two', 'pos']);
      expect(parser.opt('out')).toBe('two');
      expect(parser.cur()).toEqual(['pos']);
    });

    test('cur() reflects consumed arguments after each duplicate flag call', () => {
      const argv = ['./my-cli', '--verbose', 'pos1', '--verbose', 'pos2'];
      const parser = cliReap(argv);
      expect(parser.cur()).toEqual(['--verbose', 'pos1', '--verbose', 'pos2']);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.cur()).toEqual(['pos1', '--verbose', 'pos2']);
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.cur()).toEqual(['pos1', 'pos2']);
    });
  });

  describe('Complex Duplicate Scenarios', () => {
    test('handles complex scenario with multiple duplicate keys and mixed types', () => {
      const argv = [
        './my-cli',
        '--input',
        'file1.txt',
        '--verbose',
        '--input',
        'file2.txt',
        '--output',
        'out1.txt',
        'positional1',
        '--verbose',
        '--output',
        'out2.txt',
        'positional2',
      ];
      const parser = cliReap(argv);

      expect(parser.opt('input')).toBe('file1.txt');
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.opt('input')).toBe('file2.txt');
      expect(parser.opt('output')).toBe('out1.txt');
      expect(parser.flag('verbose')).toBe(true);
      expect(parser.opt('output')).toBe('out2.txt');
      expect(parser.pos()).toEqual(['positional1', 'positional2']);

      // All consumed
      expect(parser.opt('input')).toBe(null);
      expect(parser.flag('verbose')).toBe(null);
      expect(parser.opt('output')).toBe(null);
    });

    test('handles duplicate options with quoted values', () => {
      const argv = ['./my-cli', '--msg', '"hello world"', '--msg', "'goodbye world'"];
      const parser = cliReap(argv);
      expect(parser.opt('msg')).toBe('hello world');
      expect(parser.opt('msg')).toBe('goodbye world');
      expect(parser.opt('msg')).toBe(null);
    });

    test('handles duplicate options with special characters', () => {
      const argv = ['./my-cli', '--path', '/usr/local/bin', '--path', 'C:\\Program Files'];
      const parser = cliReap(argv);
      expect(parser.opt('path')).toBe('/usr/local/bin');
      expect(parser.opt('path')).toBe('C:\\Program Files');
      expect(parser.opt('path')).toBe(null);
    });
  });
});

describe('README Examples - Documentation Tests - v1', () => {

  describe('Introduction Example', () => {
    test('parses order-independent CLI arguments as shown in intro', () => {
      // The three different argument orders from README intro
      const examples = [
        ['node', './cli-reaps.js', 'input.txt', '--output=file.txt', '--verbose'],
        ['bun', 'run', './reapin.ts', '--verbose', '--output=file.txt', 'input.txt'],
        ['deno', 'run', './argvs.ts', '--verbose', 'input.txt', '--output=file.txt'],
      ];

      examples.forEach(argv => {
        const parser = cliReap(argv);
        expect(parser.flag('verbose')).toBe(true); // removes --verbose
        expect(parser.opt('output')).toBe('file.txt'); // removes --output=file.txt
        expect(parser.pos()).toEqual(['input.txt']); // positional remains
      });
    });

    test('the reaper reaps regardless', () => {
      const ARGVS = `
      ./order  --output=file.txt --verbose input.txt
      ./does   --output file.txt input.txt --verbose
      ./not    --verbose --output=file.txt input.txt
      ./matter --verbose input.txt --output file.txt
      ./to-the input.txt --output file.txt --verbose
      ./reaper input.txt --verbose --output=file.txt
      `.trim().split('\n');

      const EXPECT = `
      verbose: true
      out: file.txt
      pos: input.txt`.repeat(ARGVS.length); // regardless of order, we expect the same output

      expect(ARGVS.map(arg => {
        const reap = cliReap(arg.split(' '));
        return `
      verbose: ${reap.flag('verbose')}
      out: ${reap.opt('output')}
      pos: ${reap.pos().pop()}`;
      }).join('')).toBe(EXPECT); // a-ok - all four input(s) produce the same output
    });


  });

  describe('any() method examples', () => {
    test('follows priority order: argv > environment > globalThis > default', () => {
      const ARGV = ['node', 'app.js', '--flag', '--apple=out.txt', '-v', '-i', 'in.txt'];
      const reap = cliReap(ARGV);

      expect(reap.any(['f', 'flag'])).toBe(true); // found --flag
      expect(reap.any(['h', 'help'])).toBe(null); // no '-h', '--help', or default -> null
      expect(reap.any(['luck'], 7)).toBe(7); // no '--luck', but default provided
      expect(reap.any(['v', 'verbose'])).toBe(true); // found -v
      expect(reap.flag(['a'])).toBe(null);
      expect(reap.any(['a', 'apple'])).toBe('out.txt'); // found --output=out.txt
      expect(reap.any(['i', 'in'])).toBe('in.txt'); // found --in in.txt
    });

    test('duplicate handling - consumes first matching argument', () => {
      const reap = cliReap(['./my-cli', '--out', 'one', '--out', 'two']);
      expect(reap.any('out')).toBe('one'); // first occurrence, consumed
      expect(reap.any('out')).toBe('two'); // second occurrence, consumed
      expect(reap.any('out')).toBe(null); // no more occurrences
    });
  });

  describe('opt() method examples', () => {
    test('retrieves option values with different syntaxes', () => {
      const ARGV = ['node', 'app.js', '--output=file.txt', '--input', 'data.txt', '-v'];
      const reap = cliReap(ARGV);

      expect(reap.opt('output')).toBe('file.txt'); // --output=file.txt (equals syntax)
      expect(reap.opt(['i', 'input'])).toBe('data.txt'); // --input data.txt (space syntax)
      expect(reap.opt('verbose')).toBe(null); // -v is a flag, not an option
    });

    test('retrieves option values with different syntaxes alt', () => {
      const reap = cliReap(['node', 'app.js', '--find=file.txt', '--data', 'dog.txt', '-v']);

      expect(reap.opt('find')).toBe('file.txt');
      expect(reap.opt(['d', 'data'])).toBe('dog.txt');
      expect(reap.opt('v')).toBe(null); // -v is a flag, not an option
    });

    test('duplicate handling - consumes options in order', () => {
      const reap = cliReap(['./my-cli', '--out', 'first', '--out', 'second', '--out=third']);
      expect(reap.opt('out')).toBe('first'); // --out first (consumed)
      expect(reap.opt('out')).toBe('second'); // --out second (consumed)
      expect(reap.opt('out')).toBe('third'); // --out=third (consumed)
      expect(reap.opt('out')).toBe(null); // no more --out options
    });
  });

  describe('flag() method examples', () => {
    test('checks for flag presence and removes from argv', () => {
      const ARGV = ['node', 'app.js', '--verbose', '-d', '--force', 'file.txt'];
      const reap = cliReap(ARGV);

      expect(reap.flag('verbose')).toBe(true); // --verbose found
      expect(reap.flag(['d', 'debug'])).toBe(true); // -d found (matches 'd')
      expect(reap.flag('quiet')).toBe(null); // --quiet not found
      expect(reap.flag('force')).toBe(true); // --force found
    });

    test('duplicate handling - consumes flags in order', () => {
      const reap = cliReap(['./my-cli', '--verbose', '--verbose', '-v']);
      expect(reap.flag('verbose')).toBe(true); // first --verbose consumed
      expect(reap.flag('verbose')).toBe(true); // second --verbose consumed
      expect(reap.flag('v')).toBe(true); // -v consumed
      expect(reap.flag('verbose')).toBe(null); // no more verbose flags
    });
  });

  describe('pos() method examples', () => {
    test('returns remaining positional arguments after parsing', () => {
      const ARGV = ['node', 'app.js', 'input.txt', '--verbose', 'output.txt', '-f'];
      const reap = cliReap(ARGV);

      expect(reap.pos()).toEqual(['input.txt', 'output.txt']); // before parsing
      reap.flag('verbose'); // consumes --verbose
      reap.flag('f'); // consumes -f
      expect(reap.pos()).toEqual(['input.txt', 'output.txt']); // after parsing flags
    });

    test('duplicate handling preserves positionals', () => {
      const reap = cliReap(['./my-cli', 'file1.txt', '--out', 'a', 'file2.txt', '--out', 'b']);
      reap.opt('out'); // 'a' (consumes --out a)
      reap.opt('out'); // 'b' (consumes --out b)
      expect(reap.pos()).toEqual(['file1.txt', 'file2.txt']); // positionals remain
    });
  });

  describe('cmd() method examples', () => {
    test('returns command portion for different execution contexts', () => {
      // Node.js execution
      const reap1 = cliReap(['node', 'script.js', '--flag', 'value']);
      expect(reap1.cmd()).toEqual(['node', 'script.js']);

      // Bun execution
      const reap2 = cliReap(['bun', 'run', 'script.ts', '--flag', 'value']);
      expect(reap2.cmd()).toEqual(['bun', 'run', 'script.ts']);

      // Direct executable
      const reap3 = cliReap(['./my-cli', '--flag', 'value']);
      expect(reap3.cmd()).toEqual(['./my-cli']);

      // Flags at start (no executable detected)
      const reap4 = cliReap(['--flag', 'value']);
      expect(reap4.cmd()).toEqual([]);
    });
  });

  describe('cur() method examples', () => {
    test('returns current un-consumed argvs', () => {
      const reap = cliReap(['./my-cli', '--flag', 'value', 'pos1']);
      expect(reap.cur()).toEqual(['--flag', 'value', 'pos1']); // initially all args
      reap.flag('flag'); // consumes --flag
      expect(reap.cur()).toEqual(['value', 'pos1']); // after flag consumption
    });

    test('tracks consumption in real-time with duplicates', () => {
      const reap = cliReap(['./my-cli', '--out', 'first', '--out', 'second', 'pos']);
      expect(reap.cur()).toEqual(['--out', 'first', '--out', 'second', 'pos']);
      expect(reap.opt('out')).toBe('first'); // consumes --out first
      expect(reap.cur()).toEqual(['--out', 'second', 'pos']);
      expect(reap.opt('out')).toBe('second'); // consumes --out second
      expect(reap.cur()).toEqual(['pos']);
    });
  });

  describe('end() method examples', () => {
    test('detects end-of-options delimiter', () => {
      const reap = cliReap(['./exe', '--flag', '--', '-v', '--in', 'in.txt']);
      expect(reap.end()).toBe(true);

      expect(reap.pos()).toEqual(['-v', '--in', 'in.txt']);
      const reReap = cliReap(reap.pos());
      expect(reReap.opt('in')).toBe('in.txt');
    });
  });

  describe('env() method examples', () => {
    test('retrieves from environment variables and globalThis', () => {
      const procEnv = { NODE_ENV: 'development' };
      const gthis = { DEBUG: 'true' } as never as typeof globalThis;
      const reap = cliReap([], procEnv, gthis);

      expect(reap.env('NODE_ENV')).toBe('development'); // from process.env
      expect(reap.env('DEBUG')).toBe('true'); // from globalThis (fallback)
      expect(reap.env(['TEST', 'DEBUG'])).toBe('true'); // first match wins
      expect(reap.env('MISSING')).toBe(null); // not found anywhere
    });
  });

  describe('cliReapStrict examples', () => {
    test('case sensitivity differences', () => {
      expect(cliReapStrict(['-I', 'test']).opt('i')).toBe(null); // strict: no match
      expect(cliReap(['-I', 'test']).opt('i')).toBe('test'); // loose: case-insensitive
    });

    test('hyphen/underscore swapping', () => {
      expect(cliReapStrict(['--swap_in', 'loose']).opt('swap-in')).toBe(null); // strict: no match
      expect(cliReap(['--swap_in', 'loose']).opt('swap-in')).toBe('loose'); // loose: swaps _ ↔ -
    });

    test('both features combined', () => {
      expect(cliReapStrict(['--My_Key', 'value']).opt('my-key')).toBe(null); // strict
      expect(cliReap(['--My_Key', 'value']).opt('my-key')).toBe('value'); // case + swap
    });
  });

  describe('Duplicates section examples', () => {
    test('basic duplicate consumption', () => {
      const reap = cliReap(['./my-cli', '--out', 'first', '--out', 'second', '--out=third']);
      expect(reap.opt('out')).toBe('first'); // --out first (consumed)
      expect(reap.opt('out')).toBe('second'); // --out second (consumed)
      expect(reap.opt('out')).toBe('third'); // --out=third (consumed)
      expect(reap.opt('out')).toBe(null); // no more --out options
    });

    test('multiple output files collection', () => {
      const reap = cliReap(['./build', '--out', 'dist/', '--out', 'build/', '--out', 'public/']);
      const outputs = [];
      let output;
      while ((output = reap.opt('out')) !== null) {
        outputs.push(output);
      }
      expect(outputs).toEqual(['dist/', 'build/', 'public/']);
    });

    test('verbose level counting', () => {
      const reap2 = cliReap(['./app', '-v', '-v', '-v']);
      let verboseLevel = 0;
      while (reap2.flag('v') !== null) {
        verboseLevel++;
      }
      expect(verboseLevel).toBe(3);
    });
  });

  describe('Advanced mixed parsing scenarios', () => {
    test('collects configs and counts debug flags together', () => {
      const reap3 = cliReap(['./tool', '--debug', '--config', 'dev.json', '--debug', '--config', 'prod.json']);
      const configs = [];
      let debugCount = 0;

      // Collect all configs and count debug flags
      let config, debug;
      while ((config = reap3.opt('config')) !== null || (debug = reap3.flag('debug')) !== null) {
        if (config) {configs.push(config);}
        if (debug) {debugCount++;}
      }

      expect(configs).toEqual(['dev.json', 'prod.json']);
      expect(debugCount).toBe(2);
    });
  });
});


describe('README Examples - Documentation Tests - v2', () => {

})
