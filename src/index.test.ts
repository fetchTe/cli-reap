/* eslint-disable no-useless-escape */
/* eslint-disable @stylistic/max-len */
import {
  expect,
  test,
  describe,
} from 'bun:test';
import {
  cliReap,
  cliReapLoose,
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
    // Standard: node script.js [args]
    variations.push([fmt, ['node', 'script.js', ...format] ]);
    // // Args before node/script
    // variations.push([fmt, [...format, 'node', 'script.js'] ]);
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

  // special string Cases
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

  // boolean Cases
  ['boolean-true', 'key', true],
  ['boolean-false', 'key', false],
  ['string-true', 'key', 'true'],
  ['string-false', 'key', 'false'],
  ['string-uppercase-true', 'key', 'TRUE'],
  ['string-uppercase-false', 'key', 'FALSE'],
  ['string-mixed-case-true', 'key', 'True'],
  ['string-mixed-case-false', 'key', 'False'],

  // Number Cases
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


  // json misc
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

  // JSON Edge Cases
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

  // Malformed Inputs
  ['malformed-json', 'json', '{invalid json'],
  ['malformed-value-brackets', 'key', '[test'],
  ['malformed-value-braces', 'key', '{test'],
  ['malformed-value-parentheses', 'key', '(test'],
  ['malformed-value-angle', 'key', '<test'],
  ['malformed-value-mixed', 'key', '[te{st}'],

  // Edge Cases
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
    expect(cliReapLoose(['-i-test', 'test']).opt('i-test')).toBe('test');
    expect(cliReapLoose(['-i-test', 'test']).opt('i_test')).toBe('test');
    expect(cliReapLoose(['-i_test', 'test']).opt('i-test')).toBe('test');
  });

  test('matches keys case-insensitively', () => {
    expect(cliReapLoose(['--I', 'test']).opt('i')).toBe('test');
    expect(cliReapLoose(['-I', 'test']).opt('i')).toBe('test');
    expect(cliReapLoose(['--i', 'test']).opt('I')).toBe('test');
    expect(cliReapLoose(['-i', 'test']).opt('I')).toBe('test');
    expect(cliReapLoose(['--I', 'test']).opt('I')).toBe('test');
    expect(cliReapLoose(['-I', 'test']).opt('I')).toBe('test');
    expect(cliReapLoose(['--i', 'test']).opt('i')).toBe('test');
    expect(cliReapLoose(['-i', 'test']).opt('i')).toBe('test');
  });
});

describe('cliReap().opt()', () => {
  describe('Key Matching and Edge Cases', () => {
    test('is case-sensitive in strict mode', () => {
      expect(cliReap(['--I', 'test']).opt('i')).toBe(null);
      expect(cliReap(['-I', 'test']).opt('i')).toBe(null);
      expect(cliReap(['--i', 'test']).opt('I')).toBe(null);
      expect(cliReap(['-i', 'test']).opt('I')).toBe(null);
      expect(cliReap(['--I', 'test']).opt('I')).toBe('test');
      expect(cliReap(['-I', 'test']).opt('I')).toBe('test');
      expect(cliReap(['--i', 'test']).opt('i')).toBe('test');
      expect(cliReap(['-i', 'test']).opt('i')).toBe('test');
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
    expect(cliReap(['--VERBOSE']).flag('verbose')).toBe(null);
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
    expect(cliReap(['--FLAG']).any('flag')).toBe(null);
    expect(cliReap(['--FLAG']).any('FLAG')).toBe(true);
  });

  test('is case-sensitive for single-dashed flags', () => {
    expect(cliReap(['-FLAG']).any('flag')).toBe(null);
    expect(cliReap(['-FLAG']).any('FLAG')).toBe(true);
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
    expect(cliReapLoose([], procEnv).env('MY_VAR')).toBe('val');
  });
});
