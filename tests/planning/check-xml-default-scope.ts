// 332: ongeprefixte XML-nesting mag niet per element de hele namespace-ouderketen doorlopen.
import assert from 'node:assert/strict';
import { XmlDomParser } from '../../headless/mcp-server/src/xmlDom';

const parser = new XmlDomParser();
for (const depth of [100, 1000, 8000]) {
  const xml = '<r>'.repeat(depth) + 'inhoud' + '</r>'.repeat(depth);
  const originalGet = Map.prototype.get;
  let defaultLookups = 0;
  let doc: ReturnType<XmlDomParser['parseFromString']>;
  try {
    // Tel werk, geen onbetrouwbare wandkloktijd; de echte parser en Map blijven hun werk doen.
    Map.prototype.get = function (this: Map<unknown, unknown>, key: unknown) {
      if (key === '') defaultLookups++;
      return originalGet.call(this, key);
    };
    doc = parser.parseFromString(xml);
  } finally {
    Map.prototype.get = originalGet;
  }
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, `geldige XML op diepte ${depth}`);
  assert.equal(doc.getElementsByTagName('r').length, depth, 'alle elementen behouden');
  assert.equal(doc.documentElement.textContent, 'inhoud', 'inhoud behouden');
  assert.ok(defaultLookups <= depth, `hoogstens lineair werk: ${defaultLookups} op diepte ${depth}`);
}

// De optimalisatie mag bindingen en verboden declaraties niet overslaan.
for (const xml of [
  '<r xmlns="urn:root"><child xmlns=""/></r>',
  '<r xmlns:p="urn:p"><p:child p:a="1"/></r>',
  '<r xmlns="urn:p" xmlns:p="urn:p" a="1" p:a="2"/>',
]) {
  assert.equal(parser.parseFromString(xml).getElementsByTagName('parsererror').length, 0, xml);
}
for (const xml of [
  '<r><p:child/></r>',
  '<r xmlns="http://www.w3.org/XML/1998/namespace"/>',
  '<r xmlns="http://www.w3.org/2000/xmlns/"/>',
  '<r xmlns:p="urn:x" xmlns:q="urn:x" p:a="1" q:a="2"/>',
]) {
  assert.equal(parser.parseFromString(xml).getElementsByTagName('parsererror').length, 1, xml);
}
console.log('OK  XML-defaultscope: lineaire lookupgrens en namespace-validatie groen');
