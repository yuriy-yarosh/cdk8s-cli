import * as fs from 'fs';
import * as path from 'path';
import { mocked } from 'ts-jest/utils';
import { expectImportMatchSnapshot } from './util';
import { ImportCustomResourceDefinition } from '../../src/import/crd';
import { matchCrdsDevUrl } from '../../src/import/crds-dev';
import { download } from '../../src/util';

jest.mock('../../src/util', () => {
  const mod = jest.requireActual('../../src/util');
  return {
    ...mod,
    download: jest.fn(),
  };
});

jest.setTimeout(3 * 60_000);

const fullImportTests = [
  { provider: 'github', account: 'crossplane', repo: 'crossplane', version: '0.14.0' },
];

const crdsDevUrlTests = [
  { import: 'github:crossplane/crossplane', expected: 'https://doc.crds.dev/raw/github.com/crossplane/crossplane' },
  { import: 'github:crossplane/crossplane@0.14', expected: 'https://doc.crds.dev/raw/github.com/crossplane/crossplane@v0.14.0' },
  { import: 'github:crossplane/crossplane@0.14.0', expected: 'https://doc.crds.dev/raw/github.com/crossplane/crossplane@v0.14.0' },
  { import: 'unsupported:account/repo@0.1.0', expected: undefined, reason: 'unsupported provider' },
  { import: 'github:account/repo@1', expected: undefined, reason: 'major minor required if version present' },
];

const readFixture = (fixture: string) => {
  const fixtures = path.join(__dirname, 'fixtures', 'crds-dev');
  const filePath = path.join(fixtures, fixture);

  return fs.readFileSync(filePath, 'utf-8');
};

describe('crds.dev import', () => {
  for ( const t of fullImportTests ) {
    const source = `${t.provider}:${t.account}/${t.repo}@${t.version}`;

    mocked(download).mockImplementation((_url: string): Promise<string> => {
      return new Promise((ok, _ko) => {
        const mockFile = `${t.provider}-${t.account}-${t.repo}-v${t.version}.yaml`;
        const crds = readFixture(mockFile);
        ok(crds.toString());
      });
    });

    test(`${source} emit module per API group`, async () => {
      const crdsDev = await matchCrdsDevUrl(source);
      expect(crdsDev).toBeDefined();
      if (crdsDev) {
        await expectImportMatchSnapshot( () => ImportCustomResourceDefinition.fromSpec({ source: crdsDev }));
      }
    });
  }
});

describe('crds.dev import errors', () => {
  for ( const t of crdsDevUrlTests.filter( o => o.expected === undefined )) {
    test(t.import, async () => {
      const crdsDev = matchCrdsDevUrl(t.import);
      expect(crdsDev).toBeUndefined();
    });
  }
});

describe('crds.dev url map', () => {
  for ( const t of crdsDevUrlTests ) {
    test(t.import, () => {
      const url = matchCrdsDevUrl(t.import);
      expect(url).toBe(t.expected);
    });
  }
});
