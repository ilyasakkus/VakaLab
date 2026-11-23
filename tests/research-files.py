"""Validate actual PHP-generated ZIP, CSV and GraphML using independent stdlib parsers."""
import csv
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

folder = Path(__file__).parent / 'tmp'
bundle = json.loads((folder / 'research-bundle.json').read_text())
files = json.loads((folder / 'research-files.json').read_text())
checks = 0


def check(condition, label):
    global checks
    assert condition, label
    checks += 1
    print(f'PASS RESEARCH FILE {checks} {label}')


with zipfile.ZipFile(folder / 'research.zip') as archive:
    check(archive.testzip() is None, 'ZIP CRC is valid')
    check(set(archive.namelist()) == set(files), 'archive includes every declared artifact')
    check(all(archive.read(name).decode('utf-8') == text for name, text in files.items()), 'UTF-8 bytes survive actual PHP ZIP round trip')
    check(all(not Path(name).is_absolute() and '..' not in Path(name).parts for name in files), 'archive paths stay inside package')

ns = {'g': 'http://graphml.graphdrawing.org/xmlns'}
for network in bundle['networks']:
    prefix = f'networks/{network["id"]}/'
    xml = ET.fromstring(files[prefix + 'network.graphml'])
    graph = xml.find('g:graph', ns)
    nodes = {node.attrib['id'] for node in graph.findall('g:node', ns)}
    edges = graph.findall('g:edge', ns)
    check(graph.attrib['edgedefault'] == 'directed' and len(nodes) == len(network['nodes']), 'GraphML preserves directed network and all participant nodes')
    check(all(edge.attrib['source'] in nodes and edge.attrib['target'] in nodes for edge in edges), 'GraphML endpoints always reference actual nodes')
    csv_nodes = list(csv.DictReader(io.StringIO(files[prefix + 'nodes.csv'].lstrip('\ufeff'))))
    csv_edges = csv.DictReader(io.StringIO(files[prefix + 'edges.csv'].lstrip('\ufeff')))
    check({'Source', 'Target', 'Type', 'Weight'}.issubset(csv_edges.fieldnames), 'Gephi edge headers exist even when network has no edges')
    csv_edges = list(csv_edges)
    check({row['Id'] for row in csv_nodes} == nodes and len(csv_edges) == len(edges), 'CSV and GraphML express identical node/edge sets')
    connected = {node for edge in csv_edges for node in (edge['Source'], edge['Target'])}
    check(len(nodes - connected) == network['isolates'], 'isolates remain present in both program import formats')
    check(sum(int(row['Weight']) for row in csv_edges) == sum(edge['Weight'] for edge in network['edges']), 'directed reply weights remain exact')

loaded = json.loads(files['research-data.json'])
check(loaded['tables']['messages'] == bundle['tables']['messages'], 'raw JSON preserves exact original message evidence')
for name in ('process_individual', 'process_group'):
    rows = csv.DictReader(io.StringIO(files[name + '.csv'].lstrip('\ufeff')))
    check({'case:concept:name', 'concept:name', 'time:timestamp', 'org:resource'}.issubset(rows.fieldnames), f'{name} has PM4Py column mapping')

print(f'OK RESEARCH FILES {checks} checks; stdlib readers, not a live Gephi/PM4Py session.')
