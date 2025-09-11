/* eslint-disable no-useless-escape */
/* eslint-disable @stylistic/max-len */
import {
  expect,
  test,
  describe,
} from 'bun:test';
import {
  argvEnvParse,
  argvEnvParseLoose,
} from './index.ts';


describe('argvParse - loose', () => {
  test('loose hyphan underscore', () => {
    expect(argvEnvParseLoose(['node', 'script.js', '-i-test', 'test']).opt('i-test')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-i-test', 'test']).opt('i_test')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-i_test', 'test']).opt('i-test')).toBe('test');
  });

  test('should handle casing - loose', () => {
    expect(argvEnvParseLoose(['node', 'script.js', '--I', 'test']).opt('i')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-I', 'test']).opt('i')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '--i', 'test']).opt('I')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-i', 'test']).opt('I')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '--I', 'test']).opt('I')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-I', 'test']).opt('I')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '--i', 'test']).opt('i')).toBe('test');
    expect(argvEnvParseLoose(['node', 'script.js', '-i', 'test']).opt('i')).toBe('test');
  });

});


// @id::getArgvOption
describe('argvParse().opt() - other/edge-ish cases', () => {
  test('should handle empty key', () => {
    expect(argvEnvParse(['node', 'script.js', '--ptag-id', 'test']).opt('')).toBe(null);
  });

  test('should handle space key', () => {
    expect(argvEnvParse(['node', 'script.js', '--ptag-id', 'test']).opt(' ')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '-- ', 'test']).opt(' ')).toBe(null);
  });

  test('should handle hyphan key', () => {
    expect(argvEnvParse(['node', 'script.js', '--ptag-id', 'test']).opt('-')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '-id', 'test']).opt('-')).toBe(null);
  });

  test('should handle casing', () => {
    expect(argvEnvParse(['node', 'script.js', '--I', 'test']).opt('i')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '-I', 'test']).opt('i')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--i', 'test']).opt('I')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '-i', 'test']).opt('I')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--I', 'test']).opt('I')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '-I', 'test']).opt('I')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '--i', 'test']).opt('i')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '-i', 'test']).opt('i')).toBe('test');
  });

  test('should handle empty space', () => {
    expect(argvEnvParse(['node', 'script.js', '--ptag-id=" "']).opt('ptag-id')).toBe(' ');
    expect(argvEnvParse(['node', 'script.js', '--ptag-id', ' ']).opt('ptag-id')).toBe(' ');
  });

  test(`there's no apostrophe in mismatching quotes`, () => {
    expect(argvEnvParse(['./ok', '--key', `"but, srsly'"`]).opt('key')).toBe(`but, srsly'`);
    expect(argvEnvParse(['./ok', `--key="shoudn't be an issue"`]).opt('key')).toBe(`shoudn't be an issue`);
  });

  test('somewhat un-reasonable single/double quote usage', () => {
    expect(argvEnvParse(['./ok', '--key', `"''''"`]).opt('key')).toBe('');
    expect(argvEnvParse(['./ok', '--key', `'""""'`]).opt('key')).toBe('');
    expect(argvEnvParse(['./ok', '--key', `'""silly""'`]).opt('key')).toBe('silly');
    expect(argvEnvParse(['./ok', '--key', `'\'"\'"\'"\'"'`]).opt('key')).toBe(`'"'"'"'"`);
    expect(argvEnvParse(['./ok', '--key', `'::::'`]).opt('key')).toBe('::::');
  });

  test('but yo, why', () => {
    expect(argvEnvParse(['./ok', '--key=[o{k']).opt('key')).toBe('[o{k');
    expect(argvEnvParse(['./ok', '--key', '[o{k']).opt('key')).toBe('[o{k');
    expect(argvEnvParse(['./ok', '-key===<this/works>']).opt('key')).toBe('==<this/works>');
    expect(argvEnvParse(['./ok', '-key', '<this/works>']).opt('key')).toBe('<this/works>');
  });

  test('should handle tab', () => {
    expect(argvEnvParse(['node', 'script.js', '--ptag-id="\t"']).opt('ptag-id')).toBe('\t');
    expect(argvEnvParse(['node', 'script.js', '--ptag-id', '"\t"']).opt('ptag-id')).toBe('\t');
  });

  test('escaped chars', () => {
    expect(argvEnvParse(['node', '--ptag-id="\a\b\c"']).opt('ptag-id')).toBe('\a\b\c');
    expect(argvEnvParse(['node', '--ptag-id="\\a\\b\\c"']).opt('ptag-id'))
      .toBe('\\a\\b\\c');
    expect(argvEnvParse(['node', '--ptag-id=' + JSON.stringify('\'')]).opt('ptag-id')).toBe(`'`);
    // well, meh, more of a json issue
    expect(argvEnvParse(['node', '--ptag-id=' + JSON.stringify('\f\n\r\t')]).opt('ptag-id'))
      .toBe('\\f\\n\\r\\t');
  });

  test('json - string[]', () => {
    const argv = ['node', 'script.js'];
    expect(argvEnvParse(argv.concat( `--ptag-id="${JSON.stringify(['a', 'b', 'c'])}"`)).opt('ptag-id'))
      .toBe(JSON.stringify(['a', 'b', 'c']));
    expect(argvEnvParse(argv.concat( `--ptag-id='${JSON.stringify(['a', 'b', 'c'])}'`)).opt('ptag-id'))
      .toBe(JSON.stringify(['a', 'b', 'c']));
    expect(argvEnvParse(argv.concat( '--ptag-id', '["a","b","c"]')).opt('ptag-id'))
      .toBe(JSON.stringify(['a', 'b', 'c']));
  });

  test('json - string[] - with space', () => {
    const argv = ['node', 'script.js'];
    expect(argvEnvParse(argv.concat( `--ptag-id='${JSON.stringify([' a ', ' b', 'c '])}'`)).opt('ptag-id'))
      .toBe(JSON.stringify([' a ', ' b', 'c ']));
    // eslint-disable-next-line @stylistic/quotes
    expect(argvEnvParse(argv.concat( `--ptag-id`, "[\" a \",\" b\",\"c \"]")).opt('ptag-id'))
      .toBe(JSON.stringify([' a ', ' b', 'c ']));
  });

  test('json - object', () => {
    const argv = ['node', 'script.js'];
    const jsonObjStr = JSON.stringify({ a: 1, b: true, c: null });
    const jsonObjSpaceStr = JSON.stringify({ a: 1, b: true, c: null, d: ' test ' });

    expect(argvEnvParse(argv.concat(`--ptag-id="${jsonObjStr}"`)).opt('ptag-id'))
      .toBe(jsonObjStr);
    expect(argvEnvParse(argv.concat('--ptag-id', `"${jsonObjStr}"`)).opt('ptag-id'))
      .toBe(jsonObjStr);
    expect(argvEnvParse(argv.concat('--ptag-id', jsonObjStr)).opt('ptag-id'))
      .toBe(jsonObjStr);
    expect(argvEnvParse(argv.concat(`--ptag-id='${jsonObjSpaceStr}'`)).opt('ptag-id'))
      .toBe(jsonObjSpaceStr);
    expect(argvEnvParse(argv.concat('--ptag-id', jsonObjSpaceStr)).opt('ptag-id'))
      .toBe(jsonObjSpaceStr);
  });

  test('phat finger extra hyphan key', () => {
    expect(argvEnvParse(['node', 'script.js', '---key', 'test']).opt('key')).toBe('test');
  });

  test('literal key with hyphens (-key)', () => {
    // if literal key, only
    expect(argvEnvParse(['node', 'script.js', '--key', 'test']).opt('key')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '--key', 'test']).opt('-key')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--key', 'test']).opt('---key')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--key', 'test']).opt('--key')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '-key', 'test']).opt('-key')).toBe('test');
    expect(argvEnvParse(['node', 'script.js', '---key', 'test']).opt('---key')).toBe('test');
  });


});


// @id::hasArgvFlags
describe('argvParse().any() - other/edge-ish cases for flag presence', () => {
  test('should return true if any flag in array is present', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag']).any(['f', 'flag']) !== null).toBe(true);
  });

  test('should return true if any flag in array is present', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag']).any(['flag', 'f']) !== null).toBe(true);
  });

  test('should return false if no flag in array is present', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag']).any(['a', 'f']) !== null).toBe(false);
  });

  test('should return true if the flag exists with double dash', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag']).any('flag') !== null).toBe(true);
  });

  test('should return true if the flag exists with single dash', () => {
    expect(argvEnvParse(['node', 'script.js', '-flag']).any('flag') !== null).toBe(true);
  });

  test('should return true if the flag exists with a value', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag=value']).any('flag') !== null).toBe(true);
  });

  test('should return true if the flag exists with a value with space', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag', 'value']).any('flag') !== null).toBe(true);
  });

  test('should return true if the flag exists with a value with single dash', () => {
    expect(argvEnvParse(['node', 'script.js', '-flag=value']).any('flag') !== null).toBe(true);
  });

  test('should return true if the flag exists with a value with space with single dash', () => {
    expect(argvEnvParse(['node', 'script.js', '-flag', 'value']).any('flag') !== null).toBe(true);
  });

  test('should return false if the flag does not exist', () => {
    expect(argvEnvParse(['node', 'script.js', '--other-flag']).any('flag') !== null).toBe(false);
  });

  test('should return false if argv is empty', () => {
    expect(argvEnvParse([]).any('flag') !== null).toBe(false);
  });

  test('should handle case sensitivity (new behavior)', () => {
    expect(argvEnvParse(['node', 'script.js', '--FLAG']).any('flag') !== null).toBe(false);
    expect(argvEnvParse(['node', 'script.js', '--FLAG']).any('FLAG') !== null).toBe(true);
  });

  test('should handle case sensitivity single dash (new behavior)', () => {
    expect(argvEnvParse(['node', 'script.js', '-FLAG']).any('flag') !== null).toBe(false);
    expect(argvEnvParse(['node', 'script.js', '-FLAG']).any('FLAG') !== null).toBe(true);
  });

  test('should handle case sensitivity with value (new behavior)', () => {
    expect(argvEnvParse(['node', 'script.js', '--FLAG=value']).any('flag') !== null).toBe(false);
    expect(argvEnvParse(['node', 'script.js', '--FLAG=value']).any('FLAG') !== null).toBe(true);
  });

  test('should return true when the flag is at the beginning', () => {
    expect(argvEnvParse(['--flag', 'node', 'script.js']).any('flag') !== null).toBe(true);
  });

  test('should return true when the single dash flag is at the beginning', () => {
    expect(argvEnvParse(['-flag', 'node', 'script.js']).any('flag') !== null).toBe(true);
  });


});


// @id::getArgv
describe('argvParse().any()', () => {
  test('should return an true for empty string for a flag without a value', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag']).any('flag')).toBe(true);
  });

  test('should return the value for a flag with a value', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag=value']).any('flag')).toBe('value');
  });

  test('should return the value for a flag with a value space', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag', 'value']).any('flag')).toBe('value');
  });

  test('should return null if the flag does not exist', () => {
    expect(argvEnvParse(['node', 'script.js', '--other-flag']).any('flag')).toBe(null);
  });

  test('should return null if argv is empty', () => {
    expect(argvEnvParse([]).any('flag')).toBe(null);
  });

  test('should handle case sensitivity (new behavior)', () => {
    expect(argvEnvParse(['node', 'script.js', '--FLAG=value']).any('flag')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--FLAG=value']).any('FLAG')).toBe('value');
  });

  test('should handle case sensitivity and no value (new behavior)', () => {
    expect(argvEnvParse(['node', 'script.js', '--FLAG']).any('flag')).toBe(null);
    expect(argvEnvParse(['node', 'script.js', '--FLAG']).any('FLAG')).toBe(true);
  });

  test('should return the value even if the flag is at the beginning', () => {
    expect(argvEnvParse(['--flag', 'value', 'node', 'script.js']).any('flag')).toBe('value');
  });

  test('should handle quoted values', () => {
    expect(argvEnvParse(['node', 'script.js', '--flag="quoted value"']).any('flag')).toBe('quoted value');
  });

  test('should handle quoted values with space', () => {

    expect(argvEnvParse(['node', 'script.js', '--flag', "'quoted value'"]).any('flag')).toBe('quoted value');
  });

  test('should handle empty quoted values', () => {
    const argv = ['node', 'script.js'];

    expect(argvEnvParse(argv.concat("--flag=''")).any('flag')).toBe('');
    expect(argvEnvParse(argv.concat('--flag=""')).any('flag')).toBe('');

    expect(argvEnvParse(["--flag=''", ...argv]).any('flag')).toBe('');
    expect(argvEnvParse(['--flag=""', ...argv]).any('flag')).toBe('');
  });

  test('should handle flags that share names', () => {
    let argv = ['node', 'script.js', '--flag-o', '--flag'];
    expect(argvEnvParse(argv).any('flag')).toBe(true);
    argv = ['node', 'script.js', '--flag', '--flag-o'];
    expect(argvEnvParse(argv).any('flag')).toBe(true);
    argv = ['node', 'script.js', '--flag=yes', '--flag-o'];
    expect(argvEnvParse(argv).any('flag')).toBe('yes');
    argv = ['node', 'script.js', '--flag-o', '--flag=yes'];
    expect(argvEnvParse(argv).any('flag')).toBe('yes');


  });
});


// @id::getArgvPositional - primary function signature
describe('argvParse().pos() - primary function signature', () => {
  describe('and no positional arguments are present', () => {
    test('should return an empty array for an empty array', () => {
      expect(argvEnvParse([]).pos()).toEqual([]);
    });

    test('should return an empty array for an array with only the executable', () => {
      expect(argvEnvParse(['node']).pos()).toEqual([]);
    });

    test('should return an empty array for an array with only the executable and script', () => {
      expect(argvEnvParse(['node', 'script.js']).pos()).toEqual([]);
    });

    test('should return an empty array when only flags are present', () => {
      const argv = ['node', 'script.js', '--verbose', '-d', '--force'];
      expect(argvEnvParse(argv).pos()).toEqual([]);
      const parser = argvEnvParse(argv);
      parser.flag('verbose');
      parser.flag('d');
      parser.flag('force');
      expect(parser.pos()).toEqual([]);
    });

    test('should return an empty array when only options with values are present', () => {
      const argv = ['node', 'script.js', '--output=file.txt', '-l', '10'];
      expect(argvEnvParse(argv).pos()).toEqual([]);
      const parser = argvEnvParse(argv);
      parser.opt('output');
      parser.opt('l');
      expect(parser.pos()).toEqual([]);
    });

    test('should return an empty array if the last argument is a value for an option', () => {
      const argv = ['node', 'script.js', '--output', '/path/to/file'];
      expect(argvEnvParse(argv).pos()).toEqual([]);
      const parser = argvEnvParse(argv);
      parser.opt('output');
      expect(parser.pos()).toEqual([]);
    });
  });


  describe('and basic positional arguments are present', () => {
    test('should find a single positional argument', () => {
      const argv = ['node', 'script.js', 'source.txt'];
      expect(argvEnvParse(argv).pos()).toEqual(['source.txt']);
    });

    test('should find multiple positional arguments', () => {
      const argv = ['node', 'script.js', 'source.txt', 'dest.txt'];
      expect(argvEnvParse(argv).pos()).toEqual(['source.txt', 'dest.txt']);
    });

    test('should find positionals mixed with options', () => {
      const argv = ['node', 'script.js', 'copy', '--verbose', 'src.zip', '--output', 'dest.zip', 'backup'];
      expect(argvEnvParse(argv).pos()).toEqual(['copy', 'backup']);
      const parser = argvEnvParse(argv);
      parser.opt('verbose'); // consumes src.zip
      parser.opt('output'); // consumes dest.zip
      expect(parser.pos()).toEqual(['copy', 'backup']);
    });

    test('should find a positional argument placed at the beginning', () => {
      const argv = ['node', 'script.js', 'positional1', '--flag', '--opt=1'];
      expect(argvEnvParse(argv).pos()).toEqual(['positional1']);
      const parser = argvEnvParse(argv);
      parser.flag('flag');
      parser.opt('opt');
      expect(parser.pos()).toEqual(['positional1']);
    });

    test('should find a positional argument placed in the middle', () => {
      const argv = ['node', 'script.js', '--opt=val', 'positional1', '-f'];
      expect(argvEnvParse(argv).pos()).toEqual(['positional1']);
      const parser = argvEnvParse(argv);
      parser.opt('opt');
      parser.flag('f');
      expect(parser.pos()).toEqual(['positional1']);
    });

  });


  describe('and the option (--) terminator is used', () => {
    test('should treat all arguments after -- as positional', () => {
      const argv = ['node', 'script.js', '--flag', '--', 'pos1', '--not-a-flag', '-n'];
      const parser = argvEnvParse(argv);
      parser.flag('flag');
      expect(parser.pos()).toEqual(['pos1', '--not-a-flag', '-n']);
    });

    test('should find positionals both before and after --', () => {
      const argv = ['node', 'script.js', 'pos1', '--opt=val', '--', 'pos2', '-f'];
      const parser = argvEnvParse(argv);
      parser.opt('opt');
      expect(parser.pos()).toEqual(['pos1', 'pos2', '-f']);
    });

    test('should return empty array if -- is the only argument after the script', () => {
      expect(argvEnvParse(['node', 'script.js', '--']).pos()).toEqual([]);
    });

    test('should handle a second -- as a positional argument', () => {
      const argv = ['node', 'script.js', '--', '--'];
      expect(argvEnvParse(argv).pos()).toEqual(['--']);
    });

    test('should correctly consume flags', () => {
      const argv = ['node', 'script.js', '--flag', 'value', 'pos1'];
      const p = argvEnvParse(argv);
      expect(p.pos()).toEqual(['pos1']);
      const c = argvEnvParse(argv);
      c.flag('flag'); // consuime
      expect(c.pos()).toEqual(['value', 'pos1']);
    });
  });


  describe('with different executables', () => {
    test('should correctly slice argv for "node"', () => {
      const argv = ['node', 'script.js', 'positional'];
      expect(argvEnvParse(argv).pos()).toEqual(['positional']);
    });

    test('should correctly slice argv for "bun"', () => {
      const argv = ['bun', 'run', 'script.ts', '--flag', 'value', 'pos1'];
      const parser = argvEnvParse(argv);
      parser.opt('flag');
      expect(parser.pos()).toEqual(['pos1']);
    });

    test('should handle "bun run" as part of the command', () => {
      const argv = ['bun', 'run', 'script.ts', 'positional'];
      expect(argvEnvParse(argv).pos()).toEqual(['positional']);
    });

    test('should slice only one element for an unknown executable', () => {
      const argv = ['./my-cli', 'arg1', 'arg2'];
      expect(argvEnvParse(argv).pos()).toEqual(['arg1', 'arg2']);
    });
  });


  describe('with edge-case arguments', () => {
    test('should treat a single dash (-) as a positional argument', () => {
      const argv = ['node', 'script.js', 'in.txt', '-', 'out.txt'];
      expect(argvEnvParse(argv).pos()).toEqual(['in.txt', '-', 'out.txt']);
    });

    test('should handle numeric-looking strings as positionals', () => {
      const argv = ['node', 'script.js', '123', '456.7', '-99'];
      expect(argvEnvParse(argv).pos()).toEqual(['123', '456.7', '-99']);
    });

    test('should handle file paths as positionals', () => {
      const argv = ['node', 'script.js', '/path/to/source', './dest.txt'];
      expect(argvEnvParse(argv).pos()).toEqual(['/path/to/source', './dest.txt']);
    });

    test('should handle a URL as a positional argument', () => {
      const argv = ['node', 'script.js', 'https://example.com'];
      expect(argvEnvParse(argv).pos()).toEqual(['https://example.com']);
    });

    test('should handle positionals that contain hyphens', () => {
      const argv = ['node', 'script.js', 'some-value', 'another-value'];
      expect(argvEnvParse(argv).pos()).toEqual(['some-value', 'another-value']);
    });

    test('should handle a single positional that contains spaces (pre-parsed by shell)', () => {
      const argv = ['node', 'script.js', 'a value with spaces'];
      expect(argvEnvParse(argv).pos()).toEqual(['a value with spaces']);
    });
  });
});


// @id::getArgvPositional - overloaded signature
describe('argvParse().pos() - after parsing known flags', () => {
  describe('when called after parsing known flags', () => {
    test('should treat known flags as booleans that do not consume the next argument', () => {
      const knownFlags = ['verbose', 'force'];
      const argv = ['node', 'script.js', '--verbose', 'file.txt', '--force', 'another.txt'];
      const parser = argvEnvParse(argv);
      for (const flag of knownFlags) {
        parser.flag(flag);
      }
      expect(parser.pos()).toEqual(['file.txt', 'another.txt']);
    });

    test('should handle both long and short versions of known flags', () => {
      const knownFlags = ['v', 'f'];
      const argv = ['node', 'script.js', '-v', 'pos1', '-f', 'pos2'];
      const parser = argvEnvParse(argv);
      for (const flag of knownFlags) {
        parser.flag(flag);
      }
      expect(parser.pos()).toEqual(['pos1', 'pos2']);
    });

    test('should treat unknown flags as options that consume the next argument', () => {
      const knownFlags = ['verbose'];
      // --output is unknown, so it will be treated as an option consuming 'file.txt' when we get positionals
      const argv = ['node', 'script.js', '--output', 'file.txt', '--verbose', 'positional'];
      const parser = argvEnvParse(argv);
      parser.flag('verbose'); // consumes --verbose
      parser.opt('output'); // consumes --output and file.txt
      expect(parser.pos()).toEqual(['positional']);
    });

    test('should correctly identify positionals among a mix of known flags/unknown options', () => {
      const knownFlags = ['m', 'fast'];
      // -m and --fast are known flags. --mode is an unknown option consuming 'fuzz'
      const argv = ['./exe', '-m', '--mode', 'fuzz', '--fast', 'input.jpg', 'output.jpg'];
      const parser = argvEnvParse(argv);
      parser.flag('m');
      parser.flag('fast');
      parser.opt('mode');
      expect(parser.pos()).toEqual(['input.jpg', 'output.jpg']);
    });

    test('should return empty array if only known flags and options are present', () => {
      const knownFlags = ['v', 'force'];
      const argv = ['node', 'script.js', '--output', 'file.txt', '-v', '--force'];
      const parser = argvEnvParse(argv);
      parser.flag('v');
      parser.flag('force');
      parser.opt('output');
      expect(parser.pos()).toEqual([]);
    });
  });
});
