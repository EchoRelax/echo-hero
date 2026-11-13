import bpy,math
from pathlib import Path
from mathutils import Vector,Euler
R=Path(r'E:/Game/ECHO HERO');bpy.ops.wm.open_mainfile(filepath=str(R/'art/forest/boss1-game.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
a=bpy.data.armatures.new('TreantSkeleton');rig=bpy.data.objects.new('TreantRig',a);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,p=None):
 b=a.edit_bones.new(n);b.head=h;b.tail=t
 if p:b.parent=a.edit_bones[p]
bone('Root',(0,0,0),(0,0,.2));bone('Hips',(0,0,1),(0,0,1.3),'Root');bone('Chest',(0,0,1.3),(0,0,1.95),'Hips');bone('Head',(0,0,1.95),(0,0,2.9),'Chest')
for side,s in [('L',1),('R',-1)]:
 bone('Arm_'+side,(s*.65,0,1.92),(s*.92,0,1.4),'Chest');bone('Forearm_'+side,(s*.92,0,1.4),(s*1.02,-.05,.78),'Arm_'+side)
 bone('Thigh_'+side,(s*.32,0,1.05),(s*.35,0,.6),'Hips');bone('Shin_'+side,(s*.35,0,.6),(s*.38,-.04,.12),'Thigh_'+side)
bpy.ops.object.mode_set(mode='OBJECT');body.parent=rig;m=body.modifiers.new('Treant skin','ARMATURE');m.object=rig
for b in a.bones:body.vertex_groups.new(name=b.name)
def dist(p,b):
 v=b.tail_local-b.head_local;t=max(0,min(1,(p-b.head_local).dot(v)/v.length_squared));return (p-b.head_local-v*t).length
for v in body.data.vertices:
 x,y,z=v.co;s='L' if x>0 else 'R'
 if z>2.05:names=['Head','Chest']
 else:names=['Hips','Chest','Head','Arm_'+s,'Forearm_'+s,'Thigh_'+s,'Shin_'+s]
 weights=[1/(.025+dist(v.co,a.bones[n]))**6 for n in names];total=sum(weights)
 for n,w in zip(names,weights):body.vertex_groups[n].add([v.index],w/total,'REPLACE')
for p in rig.pose.bones:p.rotation_mode='QUATERNION'
def rot(n,xyz):
 q=a.bones[n].matrix_local.to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted() @ Euler(xyz,'XYZ').to_quaternion() @ q
rig.animation_data_create();scene=bpy.context.scene;scene.render.fps=30
for name,frames in [('Idle',61),('Walk',37),('Melee',31),('Cast',46)]:
 act=bpy.data.actions.new(name);rig.animation_data.action=act
 for frame in range(1,frames+1):
  t=(frame-1)/(frames-1);p=math.tau*t
  for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
  rig.pose.bones['Hips'].location.z=.012*math.sin(p)
  rot('Chest',(.015*math.sin(p),0,0));rot('Head',(-.01*math.sin(p),0,0))
  if name=='Walk':
   rig.pose.bones['Hips'].location.z=.025*(1-math.cos(p*2));rot('Hips',(0,.035*math.sin(p),.035*math.sin(p)));rot('Chest',(.07,0,-.055*math.sin(p)))
   for side,s in [('L',1),('R',-1)]:
    v=math.sin(p)*s;rot('Thigh_'+side,(v*.28,0,0));rot('Shin_'+side,(-max(0,-v)*.42,0,0));rot('Arm_'+side,(-v*.14,0,s*.05));rot('Forearm_'+side,(-.10,0,0))
  if name in ('Melee','Cast'):
   # Anticipation takes 60% of the clip, then a fast heavy strike and recovery.
   wind=min(1,t/.60);release=max(0,min(1,(t-.60)/.13));recover=max(0,min(1,(t-.73)/.27));lift=wind*(1-release)
   slam=math.sin(math.pi*release)*(1-recover)
   rot('Chest',(-.12*lift+.23*slam,0,(-.20*lift+.24*slam) if name=='Melee' else 0))
   rot('Head',(.08*lift-.12*slam,0,0));rig.pose.bones['Hips'].location.z=-.06*slam
   for side,s in [('L',1),('R',-1)]:
    strength=1 if name=='Cast' or side=='R' else .25
    rot('Arm_'+side,(-1.35*lift*strength+.65*slam*strength,0,s*.18*lift));rot('Forearm_'+side,(-.6*lift*strength,0,0))
  for pb in rig.pose.bones:
   pb.keyframe_insert(data_path='rotation_quaternion',frame=frame)
   if pb.name=='Hips':pb.keyframe_insert(data_path='location',frame=frame)
 track=rig.animation_data.nla_tracks.new();track.mute=True;track.strips.new(name,1,act)
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(R/'art/forest/treant-rig.blend'))
bpy.ops.export_scene.gltf(filepath=str(R/'public/models/boss1.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS')
