import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("release metadata preserves the mixed-license boundary", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const manifest = JSON.parse(await readFile("release/artifact-manifest.json", "utf8"));
  const allocation = await readFile("LICENSES.md", "utf8");

  assert.equal(packageJson.license, "Apache-2.0");
  assert.equal(manifest.software_license, "Apache-2.0");
  assert.equal(manifest.research_material_license, "CC-BY-4.0");
  assert.match(allocation, /src\/\*\*/);
  assert.match(allocation, /fixtures\/\*\*/);
  assert.match(allocation, /results\/\*\*/);
});

test("release manifest pins the canonical result checksum", async () => {
  const manifest = JSON.parse(await readFile("release/artifact-manifest.json", "utf8"));
  const checksums = await readFile("release/checksums.sha256", "utf8");
  const expected = manifest.artifacts[0].sha256;

  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.match(checksums, new RegExp(expected));
  assert.equal(manifest.publication_state, "draft_not_tagged_not_deposited");
});

test("citation and Zenodo metadata identify the software release candidate", async () => {
  const citation = await readFile("CITATION.cff", "utf8");
  const zenodo = JSON.parse(await readFile(".zenodo.json", "utf8"));

  assert.match(citation, /^cff-version: 1\.2\.0$/m);
  assert.match(citation, /^version: 0\.2\.0$/m);
  assert.match(citation, /^license: Apache-2\.0$/m);
  assert.equal(zenodo.upload_type, "software");
  assert.equal(zenodo.version, "0.2.0");
  assert.equal(zenodo.license, "Apache-2.0");
  assert.equal(zenodo.related_identifiers[0].identifier, "10.5281/zenodo.18251363");
});
