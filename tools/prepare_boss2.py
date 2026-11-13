import bpy,math,json,shutil,sys
from pathlib import Path
from mathutils import Vector,Euler
R=Path('E:/Game/ECHO HERO');OUT=R/'art/enemies/boss2';OUT.mkdir(parents=True,exist_ok=True)
original=OUT/'boss2-original.glb'
if not original.exists():shutil.copy2(R/'public/models/boss2.glb',original)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(original))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 o.data.calc_loop_triangles();print('SOURCE',o.name,len(o.data.loop_triangles),tuple(o.dimensions),flush=True)
print('RIGS',[o.name for o in bpy.context.scene.objects if o.type=='ARMATURE'],flush=True)
print('ACTIONS',[a.name for a in bpy.data.actions],flush=True)
assert len(meshes)==1
body=meshes[0];h=max(v.co.z for v in body.data.vertices)
print('BOUNDS',[[min(v.co[i] for v in body.data.vertices),max(v.co[i] for v in body.data.vertices)] for i in range(3)],flush=True)

def render_setup():
 s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO'
 s.display.shading.background_type='WORLD';s.world=bpy.data.worlds.new('PreviewWorld');s.world.color=(.075,.09,.12)
 for m in bpy.data.materials:
  if m.use_nodes:
   ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'metallic' not in n.image.name.lower()]
   if ns:m.node_tree.nodes.active=ns[0]
 s.render.resolution_x=720;s.render.resolution_y=720;s.render.resolution_percentage=100
 bpy.ops.object.camera_add(location=(h*.55,-h*2.7,h*.95));c=bpy.context.object
 c.rotation_euler=(Vector((0,0,h*.53))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=h*1.65;s.camera=c
 return s,c

if '--inspect' in sys.argv:
 s,c=render_setup()
 for side,loc in [('front',(0,-h*3,h*.65)),('side',(h*3,0,h*.65))]:
  c.location=loc;c.rotation_euler=(Vector((0,0,h*.5))-c.location).to_track_quat('-Z','Y').to_euler()
  s.render.filepath=str(OUT/f'source-{side}.png');bpy.ops.render.render(write_still=True)
 sys.exit()

def active(obj):
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
active(body);source=len(body.data.loop_triangles)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000015);bpy.ops.object.mode_set(mode='OBJECT')
body.data.calc_loop_triangles()
mod=body.modifiers.new('UV preserving game reduction','DECIMATE');mod.ratio=7990/len(body.data.loop_triangles);mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name);body.data.calc_loop_triangles();assert len(body.data.loop_triangles)<=8000
body.name='Boss2Body';body.data.name='Boss2Mesh_8k'
a=bpy.data.armatures.new('Boss2Skeleton');rig=bpy.data.objects.new('Boss2Rig',a);bpy.context.collection.objects.link(rig)
active(rig);bpy.ops.object.mode_set(mode='EDIT')
def bone(n,head,tail,parent=None):
 b=a.edit_bones.new(n);b.head=Vector(head)*h;b.tail=Vector(tail)*h
 if parent:b.parent=a.edit_bones[parent]
bone('Root',(0,0,0),(0,0,.1))
bone('Hips',(0,0,.43),(0,0,.54),'Root')
bone('Spine',(0,0,.54),(0,0,.64),'Hips')
bone('Chest',(0,0,.64),(0,0,.82),'Spine')
bone('Neck',(0,0,.82),(0,0,.87),'Chest')
bone('Head',(0,0,.87),(0,0,.99),'Neck')
for side,sign in [('L',1),('R',-1)]:
 bone('UpperArm_'+side,(sign*.245,0,.79),(sign*.30,0,.60),'Chest')
 bone('Forearm_'+side,(sign*.30,0,.60),(sign*.325,-.01,.43),'UpperArm_'+side)
 bone('Hand_'+side,(sign*.325,-.01,.43),(sign*.33,-.025,.33),'Forearm_'+side)
 bone('Thigh_'+side,(sign*.13,0,.43),(sign*.155,0,.25),'Hips')
 bone('Shin_'+side,(sign*.155,0,.25),(sign*.17,0,.085),'Thigh_'+side)
 bone('Foot_'+side,(sign*.17,0,.085),(sign*.17,-.12,.045),'Shin_'+side)
bpy.ops.object.mode_set(mode='OBJECT');a.bones['Root'].use_deform=False;rig.show_in_front=True
active(body);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for v in body.data.vertices:
 x,y,z=v.co/h;target=None
 if z>.875 and abs(x)<.115:target='Head'
 elif .59<z<.79 and abs(x)<.15:target='Chest'
 elif z<.095:target='Foot_L' if x>0 else 'Foot_R'
 if target:
  for group in body.vertex_groups:group.remove([v.index])
  body.vertex_groups[target].add([v.index],1,'REPLACE')
for v in body.data.vertices:
 top=sorted([(g.group,g.weight) for g in v.groups],key=lambda t:t[1],reverse=True)[:4];total=sum(w for _,w in top)
 assert total>0,('Missing skin',v.index)
 for group in body.vertex_groups:group.remove([v.index])
 for idx,w in top:body.vertex_groups[idx].add([v.index],w/total,'REPLACE')
body.data.validate();body.data.update()
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
def rot(n,xyz):
 q=a.bones[n].matrix_local.to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Euler(xyz,'XYZ').to_quaternion()@q
def smooth(t):return max(0,min(1,t))**2*(3-2*max(0,min(1,t)))
def move_root(z):
 # Pose locations are bone-local: convert world Z into the root's local axes.
 rig.pose.bones['Root'].location=a.bones['Root'].matrix_local.to_quaternion().inverted()@Vector((0,0,z*h))
def charge_pose(weight):
 rot('Chest',(.16*weight,0,0));rot('Head',(-.1*weight,0,0));move_root(-.035*weight)
 for side,sign in [('L',1),('R',-1)]:
  rot('UpperArm_'+side,(-.72*weight,0,sign*.18*weight))
  rot('Forearm_'+side,(-1.15*weight,0,-sign*.13*weight))
  rot('Thigh_'+side,(.12*weight,0,sign*.04*weight));rot('Shin_'+side,(-.24*weight,0,0));rot('Foot_'+side,(.12*weight,0,0))
rig.animation_data_create();s=bpy.context.scene;s.render.fps=30
clips={'Idle':61,'Walk':49,'Melee':34,'GroundSlam':61,'Charge':49,'WaveRelease':19}
for name,end in clips.items():
 action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
 for f in range(1,end+1):
  t=(f-1)/(end-1);p=math.tau*t
  for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
  if name=='Idle':
   rot('Chest',(.012*math.sin(p),0,0));rot('Head',(-.006*math.sin(p),0,.01*math.sin(p)))
  elif name=='Walk':
   move_root(.009*(1-math.cos(2*p)));rot('Hips',(0,.018*math.sin(p),.035*math.sin(p)));rot('Chest',(.055,0,-.05*math.sin(p)))
   for side,sign in [('L',1),('R',-1)]:
    v=math.sin(p)*sign
    rot('Thigh_'+side,(v*.30,0,0));rot('Shin_'+side,(-.42*max(0,-v),0,0));rot('Foot_'+side,(-v*.30+.42*max(0,-v),0,0))
    rot('UpperArm_'+side,(-v*.24,0,sign*.03));rot('Forearm_'+side,(-.12,0,0))
  elif name in ['Melee','GroundSlam']:
   strike=.62 if name=='Melee' else .64
   wind=smooth(t/(strike-.17)) if t<strike-.17 else 1
   release=smooth((t-(strike-.17))/.17);recovery=smooth((t-strike)/(1-strike))
   lift=wind*(1-release);hit=release*(1-recovery)
   slam=name=='GroundSlam'
   rot('Chest',(-.17*lift+(1.15 if slam else .46)*hit,0,(-.20*lift+.22*hit) if name=='Melee' else 0))
   rot('Head',(.12*lift-(.55 if slam else .23)*hit,0,0));move_root(-(.20 if slam else .05)*hit)
   rot('Hips',(-.13*hit,0,0))
   for side,sign in [('L',1),('R',-1)]:
    force=1 if name=='GroundSlam' or side=='R' else .22
    rot('UpperArm_'+side,((-2.25*lift-(1 if slam else .65)*hit)*force,0,sign*.12*lift*force))
    rot('Forearm_'+side,((-.58*lift-.12*hit)*force,0,0))
    rot('Thigh_'+side,((1.25 if slam else .22)*hit,0,0));rot('Shin_'+side,((-2.15 if slam else -.36)*hit,0,0));rot('Foot_'+side,((.9 if slam else .14)*hit,0,0))
  elif name=='Charge':charge_pose(smooth(t))
  else:
   charge_pose(1)
   push=smooth(t/.35) if t<.35 else 1-smooth((t-.35)/.65)
   rot('Chest',(.16-.25*push,0,0));rot('Head',(-.10+.1*push,0,0))
   for side,sign in [('L',1),('R',-1)]:
    rot('UpperArm_'+side,(-.72-.68*push,0,sign*(.18+.12*push)))
    rot('Forearm_'+side,(-1.15+1.05*push,0,-sign*.13*(1-push)))
  for pb in rig.pose.bones:
   pb.keyframe_insert(data_path='rotation_quaternion',frame=f,group=pb.name)
   if pb.name=='Root':pb.keyframe_insert(data_path='location',frame=f,group=pb.name)
 track=rig.animation_data.nla_tracks.new();track.name=name;track.mute=True;track.strips.new(name,1,action)
rig.animation_data.action=bpy.data.actions['Idle'];s.frame_set(1);s.frame_end=61
for im in bpy.data.images:
 if im.size[0]:im.pack()
active(body);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'boss2-game.blend'))
bpy.ops.export_scene.gltf(filepath=str(R/'public/models/boss2.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS')
report={'source_triangles':source,'triangles':len(body.data.loop_triangles),'bones':len(a.bones),'clips':{n:(f-1)/30 for n,f in clips.items()},'method':'UV-preserving collapse decimation; heat skin and rigid stone plates'}
(OUT/'asset-report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('RESULT',json.dumps(report),flush=True)
s,c=render_setup()
for clip,frames in [('Idle',[1]),('Walk',[13,37]),('Melee',[16,22]),('GroundSlam',[28,40]),('Charge',[49]),('WaveRelease',[7])]:
 rig.animation_data.action=bpy.data.actions[clip]
 for f in frames:
  s.frame_set(f);s.render.filepath=str(OUT/f'{clip}-{f:02d}.png');bpy.ops.render.render(write_still=True)
s.render.resolution_x=s.render.resolution_y=384
for clip in ['Walk','Melee','GroundSlam','Charge','WaveRelease']:
 rig.animation_data.action=bpy.data.actions[clip];folder=OUT/(clip+'-frames');folder.mkdir(exist_ok=True)
 for f in range(1,clips[clip]+1):
  s.frame_set(f);s.render.filepath=str(folder/f'{f:03d}.png');bpy.ops.render.render(write_still=True)
