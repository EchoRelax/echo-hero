"""Validate the exported assets by importing them into a fresh Blender scene."""
import bpy,json,struct,math
from pathlib import Path
ROOT=Path('E:/Game/ECHO HERO');report={}
for name in ['golem','chaosbes']:
 path=ROOT/f'public/models/{name}.glb'
 raw=path.read_bytes();length,kind=struct.unpack_from('<II',raw,12);gltf=json.loads(raw[20:20+length])
 count=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'])
 assert count<=6000,(name,count)
 assert all(p['attributes'].get('TEXCOORD_0') is not None for m in gltf['meshes'] for p in m['primitives'])
 assert gltf.get('images') and all('bufferView' in im for im in gltf['images'])
 clips=[a['name'] for a in gltf.get('animations',[])]
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 rig=next((o for o in bpy.context.scene.objects if o.type=='ARMATURE'),None)
 r={'triangles':count,'bytes':len(raw),'clips':clips,'embedded_images':len(gltf['images'])}
 if name=='golem':
  assert rig and set(clips)=={'Idle','Walk','Attack'},clips
  body=meshes[0]
  assert all(1<=len(v.groups)<=4 and abs(sum(g.weight for g in v.groups)-1)<1e-4 for v in body.data.vertices)
  ad=rig.animation_data
  for tr in ad.nla_tracks:tr.mute=True
  actions={a.name.split('|')[-1]:a for a in bpy.data.actions}
  # Imported glTF actions are linked through their NLA strips; names may include rig prefixes.
  for tr in ad.nla_tracks:
   for st in tr.strips:actions[tr.name]=st.action
  r['animation_checks']={}
  for clip in clips:
   action=next(a for a in bpy.data.actions if a.name==clip or a.name.endswith('_'+clip) or a.name.endswith('|'+clip)) if clip not in actions else actions[clip]
   ad.action=action
   if hasattr(action,'slots') and action.slots:ad.action_slot=action.slots[0]
   start,end=action.frame_range
   def points(frame):
    bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
    obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh();pts=[v.co.copy() for v in mesh.vertices];obj.to_mesh_clear();return pts
   first=points(start);sample=points(start+(end-start)*.25);last=points(end)
   delta=max((a-b).length for a,b in zip(first,sample));closure=max((a-b).length for a,b in zip(first,last))
   assert delta>1e-4,(clip,'No motion')
   assert closure<1e-4,(clip,'End pose does not match',closure)
   for f in range(int(start),int(end)+1):assert all(math.isfinite(c) for p in points(f) for c in p)
   r['animation_checks'][clip]={'frame_range':[start,end],'loop_error':closure,'motion':delta}
 report[name]=r
(ROOT/'art/enemies/golem-chaosbes-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('VALIDATED',json.dumps(report),flush=True)
