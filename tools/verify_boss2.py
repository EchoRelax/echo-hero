"""Reimport the shipped boss2 GLB and verify skin, clips and mesh budget."""
import bpy,json,struct,math
from pathlib import Path
R=Path('E:/Game/ECHO HERO');path=R/'public/models/boss2.glb'
raw=path.read_bytes();length,kind=struct.unpack_from('<II',raw,12);asset=json.loads(raw[20:20+length])
triangles=sum(asset['accessors'][p['indices']]['count']//3 for m in asset['meshes'] for p in m['primitives'])
assert triangles<=8000
clips={a['name'] for a in asset['animations']}
assert clips=={'Idle','Walk','Melee','GroundSlam','Charge','WaveRelease'}
assert all('TEXCOORD_0' in p['attributes'] for m in asset['meshes'] for p in m['primitives'])
assert all('bufferView' in im for im in asset['images'])
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path))
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
assert all(1<=len(v.groups)<=4 and abs(sum(g.weight for g in v.groups)-1)<1e-4 for v in body.data.vertices)
ad=rig.animation_data
for tr in ad.nla_tracks:tr.mute=True
report={'triangles':triangles,'bones':len(rig.data.bones),'embedded_images':len(asset['images']),'clips':{}}
def points(frame):
 bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame));ob=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ob.to_mesh();pts=[v.co.copy() for v in me.vertices];ob.to_mesh_clear();return pts
def action(name):
 act=next(a for a in bpy.data.actions if a.name==name or a.name.endswith('|'+name) or a.name.endswith('_'+name))
 ad.action=act
 if act.slots:ad.action_slot=act.slots[0]
 return act
endpoints={}
for name in clips:
 act=action(name);start,end=act.frame_range
 first=points(start);last=points(end);sample=points(start+(end-start)*.3)
 motion=max((a-b).length for a,b in zip(first,sample));error=max((a-b).length for a,b in zip(first,last))
 assert motion>1e-4,(name,'no motion')
 if name in ['Idle','Walk','Melee','GroundSlam','WaveRelease']:assert error<1e-4,(name,'loop mismatch',error)
 for i in range(41):assert all(math.isfinite(c) for p in points(start+(end-start)*i/40) for c in p)
 endpoints[name]=(first,last)
 report['clips'][name]={'duration':(end-start)/bpy.context.scene.render.fps,'motion':motion,'start_end_error':error}
 if name=='GroundSlam':
  posed=points(start+(end-start)*.64)
  for side in ['L','R']:
   group=body.vertex_groups['Hand_'+side].index
   z=[posed[v.index].z for v in body.data.vertices if any(g.group==group and g.weight>.7 for g in v.groups)]
   report.setdefault('slam_hand_floor',{})[side]=min(z)
   assert -.025<min(z)<.025,('Slam fist misses floor',side,min(z))
charge_end=endpoints['Charge'][1];release_start=endpoints['WaveRelease'][0]
match=max((a-b).length for a,b in zip(charge_end,release_start));assert match<1e-4,('Charge release discontinuity',match)
report['charge_release_error']=match
(R/'art/enemies/boss2/validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('VALIDATED',json.dumps(report),flush=True)
