"""Read-only full-source, conventional retouch; immutable derivatives and recipes.

Uses no machine-learning or generative operations. Review decisions are mandatory
per photograph. Originals are either read from an existing cache or held in RAM.
"""
import argparse, concurrent.futures, gc, hashlib, io, json, time, tomllib, urllib.request, urllib.error, subprocess, threading, shutil
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from PIL import Image, ImageCms, ImageFilter, ImageOps

ROOT=Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'.curation/full-retouch-2026-10-14'
OUTPUT=ROOT/'.codex-artifacts/photo-edits-2026-10-14/library-v1'
VERSION='2026-10-14/v1'
PREFIX='gallery-edits/'+VERSION+'/'
ACCOUNT='264358695bf65a3cb883dfd59b42fe7f'
BUCKET='wiki-media'
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15'
DIRECT=urllib.request.build_opener(urllib.request.ProxyHandler({}))
AUTH_LOCK=threading.Lock()
PROXY=urllib.request.build_opener(urllib.request.ProxyHandler({'https':'http://127.0.0.1:7897'}))

def sha(b):return hashlib.sha256(b).hexdigest()
def write_json(path,obj):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
def source_headers():return {'User-Agent':UA,'Referer':'https://photo-gallery.wiki-power.com/','Range':'bytes=0-','Accept-Encoding':'identity'}
def read_url(url):
 for attempt in range(4):
  try:
   with DIRECT.open(urllib.request.Request(url,headers=source_headers()),timeout=120) as r:
    b=r.read();h={k.lower():v for k,v in r.headers.items()};status=r.status
   assert status==200 or (status==206 and h.get('content-range')==f'bytes 0-{len(b)-1}/{len(b)}'), 'Source is a partial response'
   return b,h
  except (urllib.error.URLError,TimeoutError,ConnectionError):
   if attempt==3:raise
   time.sleep(2+attempt*3)

def recipes_from_decisions():
 ordered=json.loads((PRIVATE/'ordered.json').read_text())
 trials={r['id']:r for r in json.loads((ROOT/'.codex-artifacts/photo-edits-2026-10-14/v1/recipes.json').read_text())}
 result={}
 for line in (PRIVATE/'decisions.tsv').read_text().splitlines():
  if not line or line.startswith('#'):continue
  n,sd,md,hd,sat,lc,mask,note=line.split('\t',7);p=ordered[int(n)-1]
  if sd=='trial':r=dict(trials[p['id']])
  else:
   s,m,h=map(float,[sd,md,hd]);xs=[0,.04,.12,.3,.5,.72,.9,1]
   ys=[0,.04+s*.25,.12+s,.3+m,.5+m*.6,.72+h*.55,.9+h,1]
   r={'id':p['id'],'title':p['id'],'note':note,'curve':list(map(list,zip(xs,ys))),'saturation':float(sat),'local_contrast':float(lc),'local_radius':22,'masks':[]}
   if mask!='-':
    a=list(map(float,mask.split(',')));r['masks']=[{'ellipse':a[:4],'amount':a[4]}]
  r['visualReview']={'contactPage':f'contacts/{(int(n)-1)//12+1:02}.jpg','frame':int(n),'sourceFrameReviewed':True,'decision':note}
  result[p['id']]=r
 return result

def fetch_source(p,cache):
 path=cache.get(p['id']);b=(ROOT/path).read_bytes() if path else None
 if b is None:
  b,h=read_url(p['original']);actual=datetime.strptime(h['last-modified'],'%a, %d %b %Y %H:%M:%S GMT').replace(tzinfo=timezone.utc)
  expected=datetime.fromisoformat(p['sourceModified'].replace('Z','+00:00'))
  assert actual==expected, 'Remote original changed since inventory'
 digest=sha(b)
 if p.get('originalContentSHA256'):assert digest==p['originalContentSHA256'],'Source SHA differs from inventory'
 assert b[:2]==b'\xff\xd8'
 return b,digest,path

def adjust(image,profile_name,r):
 width,height=image.size;weights=np.array([.2289746,.6917385,.0792869] if 'Display P3' in profile_name else [.2126,.7152,.0722],dtype=np.float32)
 before=np.asarray(image,dtype=np.uint8);small=image.copy();small.thumbnail((1200,1200),Image.Resampling.LANCZOS)
 light=np.asarray(small,dtype=np.float32)@weights/255
 blur=Image.fromarray(np.rint(light*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r.get('local_radius',22)))
 blur=np.asarray(blur.resize((width,height),Image.Resampling.BILINEAR),dtype=np.float32)/255
 output=np.empty_like(before);x=np.arange(width,dtype=np.float32)[None,:]/max(width-1,1);curve=np.asarray(r['curve'],dtype=np.float32)
 assert np.all(np.diff(curve[:,0])>0) and np.all(np.diff(curve[:,1])>=0)
 total=0.;maximum=0.;clipped_before=0;clipped_after=0
 for top in range(0,height,256):
  end=min(top+256,height);rgb=before[top:end].astype(np.float32)/255;lum=rgb@weights
  target=np.interp(lum,curve[:,0],curve[:,1]).astype(np.float32);y=np.arange(top,end,dtype=np.float32)[:,None]/max(height-1,1);mid=4*lum*(1-lum)
  for mask in r.get('masks',[]):
   cx,cy,rx,ry=mask['ellipse'];target+=mask['amount']*np.exp(-.5*(((x-cx)/rx)**2+((y-cy)/ry)**2))*mid
  target+=r.get('local_contrast',0)*(lum-blur[top:end])*mid;np.clip(target,0,1,out=target)
  chroma=(rgb-lum[...,None])*r.get('saturation',1);pos=np.maximum(chroma.max(axis=2),1e-8);neg=np.maximum(-chroma.min(axis=2),1e-8)
  scale=np.minimum(1,np.minimum((1-target)/pos,target/neg));edited=np.clip(target[...,None]+chroma*scale[...,None],0,1)
  delta=np.abs(edited-rgb);total+=float(delta.sum());maximum=max(maximum,float(delta.max()))
  # Same 16-bit intermediate rounding as the accepted trials; web JPEG remains 8-bit SDR.
  output[top:end]=((np.rint(edited*65535).astype(np.uint32)+128)//257).astype(np.uint8)
  clipped_before+=int(((before[top:end]==0)|(before[top:end]==255)).sum());clipped_after+=int(((output[top:end]==0)|(output[top:end]==255)).sum())
 assert clipped_after<=clipped_before+before.size*.0005,'Unexpected clipping increase'
 return Image.fromarray(output),{'meanAbsoluteChannelChange':round(total/before.size,6),'maximumChannelChange':round(maximum,6),'endpointChannelsBefore':clipped_before,'endpointChannelsAfter':clipped_after}

def upload_and_verify(path,key):
 assert key.startswith(PREFIX) and '..' not in key.split('/'),'Only the new derivative prefix may be written'
 data=path.read_bytes();url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/r2/buckets/'+BUCKET+'/objects/'+urllib.parse.quote(key,safe='/')
 with AUTH_LOCK:
  config=Path.home()/'Library/Preferences/.wrangler/config/default.toml'
  auth=tomllib.loads(config.read_text())
  if datetime.fromisoformat(auth['expiration_time'].replace('Z','+00:00')).timestamp()<time.time()+300:
   import os
   env=dict(os.environ);env.pop('all_proxy',None);env.pop('ALL_PROXY',None);env.update(HTTPS_PROXY='http://127.0.0.1:7897',HTTP_PROXY='http://127.0.0.1:7897')
   node='/Users/power/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
   cli='/Users/power/.npm/_npx/d77349f55c2be1c0/node_modules/wrangler/bin/wrangler.js'
   with (PRIVATE/'cloudflare-refresh.log').open('ab') as log:subprocess.run([node,cli,'whoami'],env=env,stdout=log,stderr=log,check=True,timeout=120)
   auth=tomllib.loads(config.read_text())
 headers={'Authorization':'Bearer '+auth['oauth_token'],'Content-Type':'image/jpeg','Content-Disposition':'inline','Cache-Control':'public,max-age=31536000,immutable','Content-Length':str(len(data))}
 # Refuse to overwrite an existing version with different bytes. Equal versions are resumable.
 public='https://media.wiki-power.com/'+urllib.parse.quote(key,safe='/')
 try:
  with DIRECT.open(urllib.request.Request(public,headers={'User-Agent':UA},method='HEAD'),timeout=30) as response:
   exists=response.status==200
 except urllib.error.HTTPError as e:
  if e.code!=404:raise
  exists=False
 if not exists:
  for attempt in range(4):
   try:
    with PROXY.open(urllib.request.Request(url,data=data,headers=headers,method='PUT'),timeout=180) as response:response.read()
    break
   except (urllib.error.URLError,TimeoutError,ConnectionError):
    if attempt==3:raise
    time.sleep(3+attempt*4)
 verified,h=read_url(public);assert sha(verified)==sha(data),'Published derivative hash mismatch'
 assert h['content-type'].startswith('image/jpeg'),'Derivative needs inline image metadata'
 assert h.get('content-disposition','inline')=='inline'
 return {'url':public,'key':key,'sha256':sha(data),'bytes':len(data),'publicHashVerified':True,'contentType':h['content-type']}

def process(p,r,cache,srgb):
 b,digest,cached=fetch_source(p,cache);opened=Image.open(io.BytesIO(b));opened.load();assert opened.format in ('JPEG','MPO')
 profile=opened.info.get('icc_profile');source_exif=opened.getexif();color=source_exif.get_ifd(34665).get(40961)
 if not profile:
  assert color==1,'Untagged source requires colour-space verification'
  profile=srgb
 profile_name=ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(profile))).strip()
 image=ImageOps.exif_transpose(opened).convert('RGB')
 assert image.size==(p['width'],p['height']) or opened.size==(p['width'],p['height']),'Source pixel dimensions differ from inventory'
 source_encoded=opened.size;source_orientation=source_exif.get(274,1)
 trial=ROOT/'.codex-artifacts/photo-edits-2026-10-14/v1/edited'/f"{p['id'].replace('/','__')}__v1.jpg"
 if trial.exists():
  edited=Image.open(trial).convert('RGB');full_bytes=trial.read_bytes();stats={'acceptedTrialReused':True}
 else:
  edited,stats=adjust(image,profile_name,r)
  exif=Image.Exif()
  for tag in [271,272,305,306,315,33432]:
   if tag in source_exif:exif[tag]=source_exif[tag]
  original_ifd=source_exif.get_ifd(34665)
  keep={k:v for k,v in original_ifd.items() if k in [33434,33437,34855,36867,36868,37386,42036]}
  keep[40961]=65535 if 'Display P3' in profile_name else 1
  exif[34665]=keep;exif[274]=1;exif[305]='Conventional photo adjustments; Power Gallery '+VERSION
  buf=io.BytesIO();edited.save(buf,'JPEG',quality=96,subsampling=0,icc_profile=profile,exif=exif);full_bytes=buf.getvalue()
 stem=p['id'].replace('/','__');filename=stem+'--'+sha(full_bytes)[:16]+'.jpg';full=OUTPUT/'edited'/filename
 if full.exists():assert full.read_bytes()==full_bytes
 else:
  with full.open('xb') as handle:handle.write(full_bytes)
 # Decode every output and preserve full native profile and normalized orientation.
 with Image.open(full) as check:
  check.load();assert check.size==image.size and check.info['icc_profile']==profile;assert check.getexif().get(274,1)==1
 preview=ImageCms.profileToProfile(edited,ImageCms.ImageCmsProfile(io.BytesIO(profile)),ImageCms.ImageCmsProfile(io.BytesIO(srgb)),outputMode='RGB',renderingIntent=1)
 previews={}
 for edge in [960,1600]:
  web=preview.copy();web.thumbnail((edge,edge),Image.Resampling.LANCZOS);buf=io.BytesIO();web.save(buf,'WEBP',quality=84 if edge==960 else 90,method=4,icc_profile=srgb)
  webbytes=buf.getvalue();relative=f"public/photos/{p['category']}/{p['name']}-edit-v1-{edge}-{sha(webbytes)[:12]}.webp";dest=ROOT/relative;dest.parent.mkdir(parents=True,exist_ok=True)
  if dest.exists():assert dest.read_bytes()==webbytes
  else:
   with dest.open('xb') as handle:handle.write(webbytes)
  previews[str(edge)]={'url':'/'+relative,'width':web.width,'height':web.height,'sha256':sha(webbytes),'bytes':len(webbytes)}
 preview.thumbnail((1800,1800),Image.Resampling.LANCZOS);review=OUTPUT/'review'/(stem+'.jpg');preview.save(review,'JPEG',quality=94,subsampling=0,icc_profile=srgb)
 # Two original-pixel 100% crops for internal QA. They never replace or crop a published photograph.
 detail=Image.new('RGB',(1024,512));points=[(.5,.5)]
 if r.get('masks'):points.append(tuple(r['masks'][0]['ellipse'][:2]))
 else:points.append((.75,.75))
 for j,(cx,cy) in enumerate(points):
  left=max(0,min(edited.width-512,round(cx*edited.width)-256));top=max(0,min(edited.height-512,round(cy*edited.height)-256));crop=edited.crop((left,top,left+512,top+512));crop=ImageCms.profileToProfile(crop,ImageCms.ImageCmsProfile(io.BytesIO(profile)),ImageCms.ImageCmsProfile(io.BytesIO(srgb)),outputMode='RGB',renderingIntent=1);detail.paste(crop,(j*512,0))
 detail.save(OUTPUT/'details'/(stem+'.jpg'),'JPEG',quality=94)
 assert sha(b)==digest
 if cached:assert sha((ROOT/cached).read_bytes())==digest,'Cached original changed'
 record={'id':p['id'],'sourceURL':p['original'],'sourceModified':p['sourceModified'],'sourceSHA256Before':digest,'sourceSHA256After':sha(b),'sourceBytes':len(b),'sourceCache':cached,'sourceEncodedDimensions':list(source_encoded),'sourceOrientation':source_orientation,'displayDimensions':list(image.size),'nativeProfile':profile_name,'profileSHA256':sha(profile),'recipe':r,'fullFile':str(full.relative_to(ROOT)),'fullSHA256':sha(full_bytes),'previews':previews,'qualityMetrics':stats,'generativeOperations':False,'cropOrGeometryChanges':False,'newHDRInformation':False}
 write_json(OUTPUT/'records'/(stem+'.json'),record)
 key=PREFIX+p['id']+'-'+sha(full_bytes)[:16]+'.jpg'
 record['publishedFull']=upload_and_verify(full,key);write_json(OUTPUT/'records'/(stem+'.json'),record)
 image.close();edited.close();opened.close();gc.collect();return record

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=429);parser.add_argument('--only',nargs='*');args=parser.parse_args()
 for folder in ['edited','review','details','records']:(OUTPUT/folder).mkdir(parents=True,exist_ok=True)
 baseline=PRIVATE/'gallery-index-before.json'
 if not baseline.exists():baseline.write_bytes((ROOT/'gallery-index.json').read_bytes())
 data=json.loads(baseline.read_text());photos=[dict(p,id=p['category']+'/'+p['name']) for c in data['gallery'].values() for p in c['images']]
 cached=json.loads((ROOT/'.curation/hdr-compat-2026-10-13/cached-originals.json').read_text())
 for p in json.loads((ROOT/'.curation/editing-trial-2026-10-14/sources.json').read_text()):cached[p['id']]=p['path']
 recipes=recipes_from_decisions();srgb=(ROOT/'.codex-artifacts/photo-edits-2026-10-14/v1/sRGB.icc').read_bytes();write_json(OUTPUT/'recipes.json',list(recipes.values()))
 exhibition_ids={p['id'] for p in json.loads((PRIVATE/'ordered.json').read_text()) if p['exhibition']}
 photos.sort(key=lambda p:(p['id'] not in exhibition_ids,p['id']))
 pending=[]
 for p in photos:
  if p['id'] not in recipes or (args.only and p['id'] not in args.only):continue
  record_path=OUTPUT/'records'/(p['id'].replace('/','__')+'.json')
  if record_path.exists():
   record=json.loads(record_path.read_text())
   assert record['recipe']==recipes[p['id']],'Existing recipe requires a new version to change'
   if record.get('publishedFull'):continue
  pending.append(p)
 failures=[]
 def work(p):
  record_path=OUTPUT/'records'/(p['id'].replace('/','__')+'.json')
  if record_path.exists():
   record=json.loads(record_path.read_text());full=ROOT/record['fullFile'];record['publishedFull']=upload_and_verify(full,PREFIX+p['id']+'-'+record['fullSHA256'][:16]+'.jpg');write_json(record_path,record)
  else:record=process(p,recipes[p['id']],cached,srgb)
  print('Full-source individually edited and R2 hash verified:',p['id'],flush=True)
  if shutil.disk_usage(ROOT).free < 2*1024**3:
   full=ROOT/record['fullFile']
   if full.exists():
    assert full.is_relative_to(OUTPUT/'edited') and sha(full.read_bytes())==record['fullSHA256']
    full.unlink();record['fullArchivedOnR2']=True;record['localStagingCopyReleased']=True;write_json(record_path,record)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(work,p):p for p in pending[:args.limit]}
  for future in concurrent.futures.as_completed(futures):
   try:future.result()
   except Exception as error:
    failures.append({'id':futures[future]['id'],'type':type(error).__name__,'message':str(error)})
    print('Needs repair:',futures[future]['id'],type(error).__name__,str(error),flush=True)
 write_json(PRIVATE/'processing-failures.json',failures)
 if failures:print('Failures:',len(failures),flush=True)
 print('Completed records:',len(list((OUTPUT/'records').glob('*.json'))),'Reviewed recipes:',len(recipes),flush=True)

if __name__=='__main__':main()
