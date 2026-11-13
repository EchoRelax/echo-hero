"""Rebuild game meshes from archived GLBs, with a deform rig and clips for Golem."""
import bpy, math, json, shutil
from pathlib import Path
from mathutils import Vector, Euler

ROOT=Path('E:/Game/ECHO HERO')
OUT=ROOT/'art/enemies'
OUT.mkdir(exist_ok=True)
REPORT={}

def activate(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def tris(o):
 o.data.calc_loop_triangles();return len(o.data.loop_triangles)

def rig_golem(body):
 # Coordinates are fractions of the source's standing height, in Blender Z-up.
 h=max(v.co.z for v in body.data.vertices)
 arm=bpy.data.armatures.new('GolemSkeleton');rig=bpy.data.objects.new('GolemRig',arm)
 bpy.context.collection.objects.link(rig);activate(rig);bpy.ops.object.mode_set(mode='EDIT')
 def bone(n,a,b,parent=None):
  eb=arm.edit_bones.new(n);eb.head=Vector(a)*h;eb.tail=Vector(b)*h
  if parent:eb.parent=arm.edit_bones[parent]
 bone('Root',(0,0,0),(0,0,.10))
 bone('Hips',(0,0,.27),(0,0,.38),'Root')
 bone('Spine',(0,0,.38),(0,0,.53),'Hips')
 bone('Chest',(0,0,.53),(0,0,.76),'Spine')
 bone('Head',(0,0,.77),(0,0,.98),'Chest')
 for side,sign in [('L',1),('R',-1)]:
  bone('UpperArm_'+side,(sign*.285,0,.74),(sign*.385,0,.52),'Chest')
  bone('Forearm_'+side,(sign*.385,0,.52),(sign*.435,-.025,.34),'UpperArm_'+side)
  bone('Hand_'+side,(sign*.435,-.025,.34),(sign*.44,-.05,.22),'Forearm_'+side)
  bone('Thigh_'+side,(sign*.10,0,.28),(sign*.155,0,.16),'Hips')
  bone('Shin_'+side,(sign*.155,0,.16),(sign*.17,0,.065),'Thigh_'+side)
  bone('Foot_'+side,(sign*.17,0,.065),(sign*.17,-.13,.055),'Shin_'+side)
 bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True
 body.parent=rig;m=body.modifiers.new('Golem skin','ARMATURE');m.object=rig
 arm.bones['Root'].use_deform=False
 # Heat diffusion follows surface connectivity and avoids nearest-bone spikes.
 activate(body);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.object.parent_set(type='ARMATURE_AUTO')
 # Keep the head, chest plate and foot stones rigid while elbows and knees bend.
 for v in body.data.vertices:
  x,y,z=v.co/h;ax=abs(x);side='L' if x>=0 else 'R';target=None
  if z>.80 and ax<.23:target='Head'
  elif .46<z<.77 and ax<.23:target='Chest'
  elif z<.12:target='Foot_'+side
  if target:
   for g in body.vertex_groups:g.remove([v.index])
   body.vertex_groups[target].add([v.index],1,'REPLACE')
 # Match the four-influence game skin exactly in the authoring file as well.
 for v in body.data.vertices:
  ranked=sorted([(g.group,g.weight) for g in v.groups],key=lambda g:g[1],reverse=True)[:4]
  total=sum(w for g,w in ranked)
  assert total>0,('Unweighted vertex',v.index)
  for g in body.vertex_groups:g.remove([v.index])
  for idx,w in ranked:body.vertex_groups[idx].add([v.index],w/total,'REPLACE')
 body.data.validate();body.data.update()
 for p in rig.pose.bones:p.rotation_mode='QUATERNION'
 def rot(n,xyz):
  q=arm.bones[n].matrix_local.to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Euler(xyz,'XYZ').to_quaternion()@q
 rig.animation_data_create();s=bpy.context.scene;s.render.fps=30
 def smooth(t):return t*t*(3-2*t)
 for name,length in [('Idle',61),('Walk',49),('Attack',46)]:
  act=bpy.data.actions.new(name);act.use_fake_user=True;rig.animation_data.action=act
  for f in range(1,length+1):
   t=(f-1)/(length-1);p=math.tau*t
   for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
   if name=='Idle':
    rot('Chest',(.012*math.sin(p),0,0));rot('Head',(-.008*math.sin(p),0,0))
   elif name=='Walk':
    # Heavy, in-place 1.6-second walk with compensating ankle rotation.
    pelvis=rig.pose.bones['Root'];pelvis.location.z=.007*h*(1-math.cos(2*p))
    rot('Hips',(0,.025*math.sin(p),.035*math.sin(p)))
    rot('Chest',(.035,0,-.05*math.sin(p)))
    for side,sign in [('L',1),('R',-1)]:
     v=math.sin(p)*sign
     rot('Thigh_'+side,(.28*v,0,0));rot('Shin_'+side,(-.38*max(0,-v),0,0))
     rot('Foot_'+side,(-.28*v+.38*max(0,-v),0,0))
     rot('UpperArm_'+side,(-.20*v,0,sign*.025));rot('Forearm_'+side,(-.08-.08*max(0,v),0,0))
   else:
    # Both fists: deliberate overhead tell, quick downward hit, then recovery.
    if t<.48:lift=smooth(t/.48);slam=0
    elif t<.64:lift=1-smooth((t-.48)/.16);slam=smooth((t-.48)/.16)
    else:lift=0;slam=1-smooth((t-.64)/.36)
    rot('Chest',(-.17*lift+.32*slam,0,0));rot('Head',(.12*lift-.16*slam,0,0))
    rig.pose.bones['Root'].location.z=-.025*h*slam
    rot('Hips',(-.10*slam,0,0))
    for side,sign in [('L',1),('R',-1)]:
     rot('UpperArm_'+side,(-2.25*lift-.55*slam,0,sign*.13*lift))
     rot('Forearm_'+side,(-.62*lift-.20*slam,0,0))
     rot('Hand_'+side,(.10*lift,0,0))
     rot('Thigh_'+side,(.12*slam,0,0));rot('Shin_'+side,(-.16*slam,0,0));rot('Foot_'+side,(.04*slam,0,0))
   for pb in rig.pose.bones:
    pb.keyframe_insert(data_path='rotation_quaternion',frame=f,group=pb.name)
    if pb.name=='Root':pb.keyframe_insert(data_path='location',frame=f,group=pb.name)
  track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,act)
 rig.animation_data.action=bpy.data.actions['Idle'];s.frame_start=1;s.frame_end=61;s.frame_set(1)
 return rig

def preview(name,body,rig=None):
 s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO'
 s.display.shading.background_type='WORLD';s.world=bpy.data.worlds.new('PreviewWorld');s.world.color=(.08,.09,.12)
 for m in bpy.data.materials:
  if m.use_nodes:
   ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'metallic' not in n.image.name.lower()]
   if ns:m.node_tree.nodes.active=ns[0]
 h=max(v.co.z for v in body.data.vertices)
 bpy.ops.object.camera_add(location=(h*.65,-h*2.6,h*1.0));c=bpy.context.object
 c.rotation_euler=(Vector((0,0,h*.5))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=h*1.45;s.camera=c
 s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
 for clip,frames in ([('Idle',[1]),('Walk',[1,13,25,37]),('Attack',[1,16,23,30,38,46])] if rig else [('Static',[1])]):
  if rig:rig.animation_data.action=bpy.data.actions[clip]
  for f in frames:
   s.frame_set(f);s.render.filepath=str(OUT/f'{name}-{clip.lower()}-{f:02d}.png');bpy.ops.render.render(write_still=True)
 if rig:
  s.render.resolution_x=384;s.render.resolution_y=384;c.data.ortho_scale=h*1.8
  for clip,end in [('Walk',49),('Attack',46)]:
   rig.animation_data.action=bpy.data.actions[clip]
   folder=OUT/(name+'-'+clip.lower()+'-frames');folder.mkdir(exist_ok=True)
   for f in range(1,end):
    s.frame_set(f);s.render.filepath=str(folder/f'{f:03d}.png');bpy.ops.render.render(write_still=True)

for name in ['golem','chaosbes']:
 original=OUT/f'{name}-original.glb'
 if not original.exists():shutil.copy2(ROOT/f'public/models/{name}.glb',original)
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(original))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 assert len(meshes)==1,'Inspect multi-object sources before processing'
 body=meshes[0];activate(body);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 source=tris(body)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000015);bpy.ops.object.mode_set(mode='OBJECT')
 if tris(body)>6000:
  m=body.modifiers.new('UV preserving triangle reduction','DECIMATE');m.ratio=5990/tris(body);m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 assert tris(body)<=6000
 body.name=name.capitalize()+'Body';body.data.name=name.capitalize()+'Mesh_6k'
 rig=rig_golem(body) if name=='golem' else None
 for im in bpy.data.images:
  if im.size[0]:im.pack()
 activate(body)
 if rig:rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{name}-game.blend'))
 bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{name}.glb'),export_format='GLB',use_selection=True,export_animations=bool(rig),export_animation_mode='ACTIONS')
 REPORT[name]={'source_triangles':source,'triangles':tris(body),'vertices':len(body.data.vertices),'bones':len(rig.data.bones) if rig else 0,'animations':{'Idle':2,'Walk':1.6,'Attack':1.5} if rig else {},'method':'UV-preserving collapse decimation, source textures retained'}
 print('RESULT',name,json.dumps(REPORT[name]),flush=True)
 preview(name,body,rig)
(OUT/'golem-chaosbes-report.json').write_text(json.dumps(REPORT,indent=2),encoding='utf8')
