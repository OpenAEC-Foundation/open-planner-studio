#!/usr/bin/env python3
"""Genereer de 4D-openbeveiliging uit officiële buildingSMART EXPRESS-schema's.

Gebruik: python scripts/ifc-product-types.py /pad/IFC2X3_TC1.exp /pad/IFC4.exp /pad/IFC4X3_ADD2.exp
Bronnen: https://github.com/buildingSMART/Standards-builds/tree/main/IFC/RELEASE
De invoer wordt niet uitgevoerd. CI gebruikt de ingecheckte tabel, niet Python of netwerk.
"""
import hashlib
from pathlib import Path
import re
import sys

names = set()
sources = []
for filename in sys.argv[1:]:
    path = Path(filename)
    raw = path.read_bytes()
    text = re.sub(r'\(\*.*?\*\)', '', raw.decode('utf-8-sig'), flags=re.S)
    parents = {}
    for name, body in re.findall(r'\bENTITY\s+(\w+)\b(.*?)END_ENTITY\s*;', text, re.S | re.I):
        parent = re.search(r'\bSUBTYPE\s+OF\s*\(\s*(\w+)\s*\)', body, re.I)
        parents[name.upper()] = parent[1].upper() if parent else None
    if 'IFCPRODUCT' not in parents or 'IFCTYPEPRODUCT' not in parents:
        raise ValueError(f'{path}: geen volledig IFC-schema')
    for name in parents:
        at = name
        while at:
            if at in ('IFCPRODUCT', 'IFCTYPEPRODUCT'):
                names.add(name)
                break
            at = parents.get(at)
    sources.append(f'// {path.name}: SHA-256 {hashlib.sha256(raw).hexdigest()}')
if len(sources) != 3:
    raise ValueError('Geef IFC2X3_TC1, IFC4 en IFC4X3_ADD2 als invoer')
print('// Gegenereerd door scripts/ifc-product-types.py; niet met de hand aanvullen.')
print('// IfcProduct + IfcTypeProduct en alle subtypen: fysieke/ruimtelijke objecten, ook zonder geometrie.')
print('// Taken, resources en hun gedeelde geometrische context zijn geen IfcProduct.')
print('// Bron: https://github.com/buildingSMART/Standards-builds/tree/main/IFC/RELEASE')
print('\n'.join(sources))
print('export const IFC_BUILDING_MODEL_TYPES: ReadonlySet<string> = new Set([')
for name in sorted(names):
    print(f"  '{name}',")
print(']);')
