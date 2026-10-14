"""Apply only a fully reviewed, versioned release; keep every source URL unchanged."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'.curation/full-retouch-2026-10-14'
RECORDS=ROOT/'.codex-artifacts/photo-edits-2026-10-14/library-v1/records'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
baseline=json.loads((PRIVATE/'gallery-index-before.json').read_text())
current=json.loads((ROOT/'gallery-index.json').read_text());old={p['category']+'/'+p['name']:p for c in baseline['gallery'].values() for p in c['images']}
ordered=json.loads((PRIVATE/'ordered.json').read_text());positions={p['id']:i for i,p in enumerate(ordered)}
qa=json.loads((PRIVATE/'visual-qa.json').read_text());assert not qa['issues'],'Unresolved visual QA issues'
assert len(old)==429
current_ids=[p['category']+'/'+p['name'] for c in current['gallery'].values() for p in c['images']]
assert len(current_ids)==429 and set(current_ids)==set(old),'The release must retain the complete source library'
preservation=json.loads((PRIVATE/'origin-preservation.json').read_text())
assert preservation['total']==429 and preservation['allOriginalVersionsUnchanged']
records={r['id']:r for r in [json.loads(p.read_text()) for p in RECORDS.glob('*.json')]};assert set(records)==set(old),'Every photograph needs a complete source record'
release=[]
for c in current['gallery'].values():
 for p in c['images']:
  id=p['category']+'/'+p['name'];r=records[id];source=old[id];n=positions[id]
  assert id in qa['wholeIDs'] and id in qa['pixelIDs'],f'{id} still needs visual QA'
  assert p['original']==source['original']==r['sourceURL'] and p['sourceModified']==r['sourceModified']
  assert r['sourceSHA256Before']==r['sourceSHA256After']
  if source.get('originalContentSHA256'):assert source['originalContentSHA256']==r['sourceSHA256Before']
  assert r['publishedFull']['publicHashVerified'] and r['publishedFull']['sha256']==r['fullSHA256']
  assert r['publishedFull']['url'].startswith('https://media.wiki-power.com/gallery-edits/2026-10-14/v1/')
  assert not any(r[k] for k in ['generativeOperations','cropOrGeometryChanges','newHDRInformation'])
  p['originalContentSHA256']=r['sourceSHA256Before'];p['width'],p['height']=r['displayDimensions']
  p['editedOriginal']=r['publishedFull']['url'];p['editVersion']='2026-10-14/v1';p['editedContentSHA256']=r['fullSHA256']
  for edge,field in [(960,'preview'),(1600,'largePreview')]:
   v=r['previews'][str(edge)];assert sha(ROOT/v['url'].lstrip('/'))==v['sha256']
   p[field]=v['url'];p[field+'Width']=v['width'];p[field+'Height']=v['height']
  release.append({'id':id,'sourceURL':r['sourceURL'],'sourceModified':r['sourceModified'],'sourceSHA256':r['sourceSHA256Before'],'sourceBytes':r['sourceBytes'],'sourceEncodedDimensions':r['sourceEncodedDimensions'],'sourceOrientation':r['sourceOrientation'],'displayDimensions':r['displayDimensions'],'nativeProfile':r['nativeProfile'],'profileSHA256':r['profileSHA256'],'recipe':r['recipe'],'editedFull':r['publishedFull'],'previews':r['previews'],'previousPreviews':{k:source[k] for k in ['preview','largePreview'] if k in source},'qualityMetrics':r['qualityMetrics'],'visualQA':{'wholeFrame':True,'nativePixelCrop':True,'notes':'Original camera sharpening, motion blur and depth of field retained; no added halos, objects or geometry edits.'}})
output=ROOT/'photo-edits/2026-10-14-v1.json';output.parent.mkdir(exist_ok=True)
manifest={'schemaVersion':1,'version':'2026-10-14/v1','total':len(release),'method':'Conventional monotonic luminance curves, hand-positioned feathered dodge/burn, modest local contrast and native-gamut saturation. No generative operations.','sourceFormat':'Camera/exported full-size JPEG or primary JPEG in MPO; originals retained read-only.','newHDRInformation':False,'allSourcesSHA256Preserved':True,'photographs':sorted(release,key=lambda r:r['id'])}
manifest['preservationVerification']={k:preservation[k] for k in ['checkedAt','allOriginalVersionsUnchanged','cachedOriginalsSHA256Verified','previousPreviewAssetsByteExact']}
output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
temp=ROOT/'gallery-index.json.tmp';temp.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n');temp.replace(ROOT/'gallery-index.json')
print('Applied complete individually reviewed release:',len(release),'original URLs preserved')
