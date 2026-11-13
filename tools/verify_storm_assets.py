import bpy,json,struct,math
from pathlib import Path
R=Path('E:/Game/ECHO HERO');report={}
for name,budget in [('stormwisp',4000),('boss3',8000)]:
 raw=(R/f'public/models/{name}.glb').read_bytes();length,kind=struct.unpack_from('<II',raw,12);gltf=json.loads(raw[20:20+length])
 triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
 assert triangles<=budget
 assert all('TEXCOORD_0' in p['attributes'] for m in gltf['meshes'] for p in m['primitives'])
 assert gltf['images'] and all('bufferView' in im for im in gltf['images'])
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(R/f'public/models/{name}.glb'))
 entry={'triangles':triangles,'embedded_images':len(gltf['images']),'bytes':len(raw)}
 if name=='boss3':
  rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=next(o for o in bpy.context.scene.objects if o.type=='MESH');ad=rig.animation_data
  assert not any('Thigh' in b.name or 'Foot' in b.name for b in rig.data.bones)
  assert all(1<=len(v.groups)<=4 and abs(sum(g.weight for g in v.groups)-1)<1e-4 for v in body.data.vertices)
  for track in ad.nla_tracks:track.mute=True
  names={a['name'] for a in gltf['animations']};assert names=={'Hover','Fly','Melee','VortexCast','StormCast','StormChannel'}
  entry['bones']=len(rig.data.bones);entry['clips']={};ends={}
  def points(frame):
   bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));ob=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ob.to_mesh();pts=[v.co.copy() for v in me.vertices];ob.to_mesh_clear();return pts
  for name2 in names:
   act=next(a for a in bpy.data.actions if a.name==name2 or a.name.endswith('|'+name2) or a.name.endswith('_'+name2));ad.action=act
   if act.slots:ad.action_slot=act.slots[0]
   start,end=act.frame_range;first=points(start);last=points(end);sample=points(start+(end-start)*.27)
   motion=max((a-b).length for a,b in zip(first,sample));closure=max((a-b).length for a,b in zip(first,last));assert motion>1e-4
   if name2!='StormCast':assert closure<1e-4,(name2,closure)
   for i in range(31):assert all(math.isfinite(c) for p in points(start+(end-start)*i/30) for c in p)
   entry['clips'][name2]={'duration':(end-start)/bpy.context.scene.render.fps,'motion':motion,'start_end_error':closure};ends[name2]=(first,last)
  error=max((a-b).length for a,b in zip(ends['StormCast'][1],ends['StormChannel'][0]));assert error<1e-4
  entry['cast_channel_error']=error
 report[name]=entry
(R/'art/enemies/storm/validation.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('VALIDATED',json.dumps(report),flush=True)
