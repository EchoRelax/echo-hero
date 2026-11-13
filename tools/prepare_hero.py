import bpy, math, json, os
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT=Path(r'E:\Game\ECHO HERO')
OUT=ROOT/'art/hero'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'hero-updated-original.glb'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=body
bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
body.scale=(1.85/body.dimensions.z,)*3
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
body.name='Hero_Body'
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=0.00004);bpy.ops.object.mode_set(mode='OBJECT')
body.data.calc_loop_triangles()
mod=body.modifiers.new('UV preserving reduction','DECIMATE');mod.ratio=5500/len(body.data.loop_triangles);mod.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=mod.name)
for image in bpy.data.images:
 if image.size[0]>512:
  image.scale(512,512)
  image.pack()
body.data.calc_loop_triangles()
print('BODY TRIANGLES',len(body.data.loop_triangles),flush=True)
# Build a deform skeleton in the imported bind pose.
arm=bpy.data.armatures.new('Hero_Skeleton');rig=bpy.data.objects.new('Hero_Rig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,head,tail,parent=None):
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=arm.edit_bones[parent]
 return b
bone('Root',(0,0,0),(0,0,.15))
bone('Hips',(0,0,.88),(0,0,1.03),'Root')
bone('Spine',(0,0,1.03),(0,0,1.24),'Hips')
bone('Chest',(0,0,1.24),(0,0,1.47),'Spine')
bone('Neck',(0,0,1.47),(0,0,1.58),'Chest')
bone('Head',(0,0,1.58),(0,0,1.84),'Neck')
for side,sign in [('L',1),('R',-1)]:
 bone('Clavicle_'+side,(sign*.04,0,1.43),(sign*.25,0,1.36),'Chest')
 bone('UpperArm_'+side,(sign*.25,0,1.36),(sign*.30,-.015,1.12),'Clavicle_'+side)
 bone('Forearm_'+side,(sign*.30,-.015,1.12),(sign*.32,-.035,.85),'UpperArm_'+side)
 bone('Hand_'+side,(sign*.32,-.035,.85),(sign*.32,-.035,.72),'Forearm_'+side)
 bone('Thigh_'+side,(sign*.12,0,.88),(sign*.14,-.015,.48),'Hips')
 bone('Shin_'+side,(sign*.14,-.015,.48),(sign*.15,0,.13),'Thigh_'+side)
 bone('Foot_'+side,(sign*.15,0,.13),(sign*.15,-.17,.06),'Shin_'+side)
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front=True
body.parent=rig
modifier=body.modifiers.new('Hero deformation','ARMATURE');modifier.object=rig
for b in arm.bones:body.vertex_groups.new(name=b.name)
def blend(a,b,t):return {a:1-max(0,min(1,t)),b:max(0,min(1,t))}
for v in body.data.vertices:
 x,y,z=v.co;side='L' if x>0 else 'R';ax=abs(x)
 if z>1.55:w={'Head':1}
 elif 1.25<z<1.47 and ax>.18:
  # The shoulder cap must follow the clavicle/arm. Pinning all vertices above
  # 1.40 to Chest folds the sleeve into the torso when the arm reaches across.
  lateral=max(0,min(1,(ax-.18)/.09));lateral=lateral*lateral*(3-2*lateral)
  shoulder=blend('UpperArm_'+side,'Clavicle_'+side,(z-1.30)/.13)
  w={name:weight*lateral for name,weight in shoulder.items()}
  w['Chest']=1-lateral
 elif z>1.40:w=blend('Chest','Neck',(z-1.42)/.16)
 elif ax>(.27 if z<.94 else .205) and z>.70:
  if z>1.04:w=blend('UpperArm_'+side,'Forearm_'+side,(1.19-z)/.14)
  elif z>.84:w=blend('Forearm_'+side,'Hand_'+side,(.93-z)/.10)
  else:w={'Hand_'+side:1}
 elif z>.97:w=blend('Spine','Chest',(z-1.10)/.18)
 elif z>.78:w=blend('Hips','Spine',(z-.92)/.13)
 elif z>.62 and ax<.22 and y<-.12:w={'Hips':1}
 elif z>.45:w=blend('Thigh_'+side,'Shin_'+side,(.55-z)/.16)
 elif z>.16:w={'Shin_'+side:1}
 else:w=blend('Shin_'+side,'Foot_'+side,(.22-z)/.12)
 for name,weight in w.items():
  if weight>0:body.vertex_groups[name].add([v.index],weight,'REPLACE')
# Smooth skin weights along the mesh to avoid hard creases at joint boundaries.
weights=[]
for vertex in body.data.vertices:
 weights.append({group.group:group.weight for group in vertex.groups})
neighbors=[[] for _ in weights]
for edge in body.data.edges:
 a,b=edge.vertices;neighbors[a].append(b);neighbors[b].append(a)
for iteration in range(4):
 result=[]
 for i,current in enumerate(weights):
  adjacent=neighbors[i]
  if not adjacent:result.append(current);continue
  mixed={group:value*.6 for group,value in current.items()}
  for j in adjacent:
   # Keep the two legs separate while smoothing joint transitions.
   if body.data.vertices[i].co.x*body.data.vertices[j].co.x<0 and body.data.vertices[i].co.z<.78:
    for group,value in current.items():mixed[group]=mixed.get(group,0)+value*.4/len(adjacent)
    continue
   for group,value in weights[j].items():mixed[group]=mixed.get(group,0)+value*.4/len(adjacent)
  top=sorted(mixed.items(),key=lambda x:x[1],reverse=True)[:4]
  total=sum(value for _,value in top)
  result.append({group:value/total for group,value in top})
 weights=result
for group in body.vertex_groups:group.remove(list(range(len(weights))))
for i,weight in enumerate(weights):
 for group,value in weight.items():body.vertex_groups[group].add([i],value,'REPLACE')
# Bind-space weapon socket. Its world axes match the separately exported sword.
hand=Vector(arm.bones['Hand_R'].head_local)
marker=bpy.data.objects.new('SwordSocket',None)
bpy.context.collection.objects.link(marker)
marker.parent=rig
marker.parent_type='BONE'
marker.parent_bone='Hand_R'
bpy.context.view_layer.update()
marker.matrix_world=Matrix.Translation(hand+Vector((0,0,-.065))) @ Matrix.Rotation(math.pi/2,4,'X')
# Bake analytical two-bone limb posing to ordinary glTF animation tracks.
scene=bpy.context.scene;scene.render.fps=30
rest={b.name:b.matrix_local.copy() for b in arm.bones}
for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'

def aim(name,head,tail):
 d=(Vector(tail)-Vector(head)).normalized()
 bind=arm.bones[name]
 original=(bind.tail_local-bind.head_local).normalized()
 q=original.rotation_difference(d) @ bind.matrix_local.to_quaternion()
 rig.pose.bones[name].matrix=Matrix.LocRotScale(Vector(head),q,Vector((1,1,1)))
 # Skin joints rotate about their bind heads. Translation keys on individual
 # joints pull the skinned mesh apart when animation actions are blended.
 rig.pose.bones[name].location=(0,0,0)
 rig.pose.bones[name].scale=(1,1,1)
 bpy.context.view_layer.update()

def solve(a,b,start,target,pole):
 start=Vector(start);target=Vector(target);axis=target-start
 l1=arm.bones[a].length;l2=arm.bones[b].length
 distance=max(.001,min(axis.length,l1+l2-.002));axis.normalize();target=start+axis*distance
 along=(l1*l1-l2*l2+distance*distance)/(2*distance)
 bend=Vector(pole);bend-=axis*bend.dot(axis)
 if bend.length<.001:bend=Vector((0,-1,0))
 bend.normalize();joint=start+axis*along+bend*math.sqrt(max(0,l1*l1-along*along))
 aim(a,start,joint);aim(b,joint,target)
 return target

def rotate(name,angles):rig.pose.bones[name].rotation_quaternion=__import__('mathutils').Euler(angles,'XYZ').to_quaternion()
def smooth(t):return t*t*(3-2*t)
def mix(a,b,t):return Vector(a).lerp(Vector(b),t)

def weapon_pose(kind,t):
 # Right-side vertical guard. Negative X is the character's anatomical right.
 # Leave space in front of the tunic for the crossing support forearm.
 grip=Vector((-.22,-.28,1.34));yaw=0;elevation=math.pi/2
 if kind=='Attack':
  keys=[(0,(-.22,-.28,1.34),0,math.pi/2),
        (.23,(-.22,-.22,1.43),-2.23,.45),
        (.49,(0,-.40,1.20),0,.04),
        (.65,(.16,-.25,1.10),1.37,-.18),
        (.84,(-.18,-.30,1.32),.35,1.25),
        (1,(-.22,-.28,1.34),0,math.pi/2)]
  for (ta,pa,ya,ea),(tb,pb,yb,eb) in zip(keys,keys[1:]):
   if ta<=t<=tb:
    u=smooth((t-ta)/(tb-ta));grip=mix(pa,pb,u);yaw=ya+(yb-ya)*u;elevation=ea+(eb-ea)*u;break
 elif kind=='Run':
  grip.z+=.018*math.cos(4*math.pi*t)
  grip.x+=.012*math.sin(2*math.pi*t)
 elif kind=='Idle':grip.z+=.004*math.sin(2*math.pi*t)
 elif kind=='Hit':grip.y+=.04*math.sin(math.pi*t)
 direction=Vector((math.sin(yaw)*math.cos(elevation),-math.cos(yaw)*math.cos(elevation),math.sin(elevation)))
 return grip,direction


def world_rotation(name,angles):
 # The bone's local Y runs vertically. Convert world yaw to its local basis;
 # applying a local Z Euler directly makes the character nod/lean sideways.
 basis=rest[name].to_quaternion()
 q=__import__('mathutils').Euler(angles,'XYZ').to_quaternion()
 rig.pose.bones[name].rotation_quaternion=basis.inverted() @ q @ basis


def pose(kind,t):
 for pb in rig.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 phase=2*math.pi*t
 bob=-.025+.005*math.sin(phase);lean=.025;twist=0
 if kind=='Run':
  # Compression in mid stance, extension into the short flight phase.
  bob=-.085-.045*math.cos(phase*2-2*math.pi*.34)
  lean=.10;twist=-.045*math.cos(phase)
 if kind=='Attack':
  if t<.23:twist=-.45*smooth(t/.23)
  elif t<.65:twist=-.45+.95*smooth((t-.23)/.42)
  else:twist=.50*(1-smooth((t-.65)/.35))
  bob=-.025-.035*math.sin(math.pi*t)
 if kind=='Hit':lean=-.15*math.sin(math.pi*t)
 if kind=='Death':
  f=smooth(min(1,t/.8));rotate('Root',(-math.pi*.48*f,0,.12*f));rig.pose.bones['Root'].location=(0,.20*f,.10*f)
 # Pose translation is in bone-local space (local Y is vertical).
 rig.pose.bones['Hips'].location=rest['Hips'].to_quaternion().inverted() @ Vector((.006*math.sin(phase) if kind=='Run' else 0,0,bob))
 if kind=='Run':world_rotation('Hips',(0,.015*math.sin(phase),.025*math.cos(phase)))
 world_rotation('Spine',(lean,0,twist*.35));world_rotation('Chest',(0,0,twist*.65))
 # Protract the support shoulder before solving the arm. The hand crosses to
 # the right-side grip, so a bind-pose shoulder would pull the forearm inside
 # the chest or force a fully straight elbow.
 world_rotation('Clavicle_L',(0,0,-.38))
 bpy.context.view_layer.update()
 root_transform=rig.pose.bones['Root'].matrix @ rest['Root'].inverted()
 # Keep the gaze level and facing the target throughout the torso swing.
 head=rig.pose.bones['Head'];position=head.head.copy()
 head.matrix=Matrix.LocRotScale(position,root_transform.to_quaternion() @ rest['Head'].to_quaternion(),Vector((1,1,1)))
 head.location=(0,0,0)
 bpy.context.view_layer.update()
 for side,sign in [('L',1),('R',-1)]:
  thigh='Thigh_'+side;shin='Shin_'+side;foot='Foot_'+side
  hip=rig.pose.bones[thigh].head.copy()
  target=Vector(arm.bones[shin].tail_local)
  toe_angle=0
  if kind=='Run':
   # Feet land in two close, separate lanes instead of the wide bind stance.
   target.x=sign*.075
   u=(t+(0 if side=='L' else .5))%1
   # Stance: planted foot travels backward. Swing: knee lifts and foot returns.
   if u<.34:
    v=u/.34;target.y=-.36+.72*v
    target.z=.13+.035*smooth(max(0,(v-.75)/.25))
    toe_angle=.45*smooth(max(0,(v-.65)/.35))
   else:
    v=(u-.34)/.66;target.y=.36-.72*smooth(v)
    target.z=.13+.035*(1-smooth(v))+.30*math.sin(math.pi*v)**1.4
    toe_angle=.45*(1-smooth(v))-.16*math.sin(math.pi*v)
  else:
   target.x+=sign*.025
   target.y+=sign*.055
   if kind=='Attack':target.y+=sign*.025*math.sin(math.pi*t)
  if kind=='Death':target=root_transform @ target
  solve(thigh,shin,hip,target,root_transform.to_quaternion() @ Vector((0,-1,.05)))
  ankle=rig.pose.bones[shin].tail.copy()
  forward=Vector((0,-.17,-.07+toe_angle*.17))
  aim(foot,ankle,ankle+root_transform.to_quaternion() @ forward)
 grip,blade=weapon_pose(kind,t)
 if kind=='Death':grip=root_transform @ grip;blade=root_transform.to_quaternion() @ blade
 # Project the shared grip into BOTH arms' reach, so the rear hand cannot
 # detach at the extremes of a swing. Solve the weapon before either arm.
 for iteration in range(8):
  for side in ('R','L'):
   shoulder=rig.pose.bones['UpperArm_'+side].head.copy()
   wrist=grip-blade*(.185 if side=='L' else .065)
   delta=wrist-shoulder
   reach=arm.bones['UpperArm_'+side].length+arm.bones['Forearm_'+side].length-.004
   if delta.length>reach:grip-=delta.normalized()*(delta.length-reach)
 # Rear hand is on the pommel side of the same grip, never animated separately.
 for side,sign in [('R',-1),('L',1)]:
  armname='UpperArm_'+side;fore='Forearm_'+side;handname='Hand_'+side
  shoulder=rig.pose.bones[armname].head.copy()
  palm=grip-blade*(.12 if side=='L' else 0)
  target=palm-blade*.065
  hand_direction=blade.copy()
  # Keep the support elbow forward of the torso, not tucked through its side.
  elbow_pole=(.55,-1,-.25) if side=='L' else (sign,-.35,-.5)
  wrist=solve(armname,fore,shoulder,target,elbow_pole)
  aim(handname,wrist,wrist+hand_direction*.115)

clips={'Idle':(61,2),'Run':(20,19/30),'Attack':(31,1),'Hit':(13,.4),'Death':(37,1.2)}
rig.animation_data_create()
for name,(frames,duration) in clips.items():
 rig.animation_data.action=None
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(1,frames+1):
  scene.frame_set(frame);pose(name,(frame-1)/(frames-1))
  for pb in rig.pose.bones:
   if pb.name in ('Root','Hips'):pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
   pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
 # Store each action as a separate track for GLB export.
 track=rig.animation_data.nla_tracks.new();track.name=name
 strip=track.strips.new(name,1,action);strip.action_frame_start=1;strip.action_frame_end=frames
 track.mute=True
 print('ANIMATION',name,frames,flush=True)
rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=False
scene.frame_set(1)
# Save in a neutral pose, with tracks muted for editing.
for track in rig.animation_data.nla_tracks:track.mute=True
pose('Idle',0)
bpy.ops.object.select_all(action='DESELECT')
for o in [body,rig,marker]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hero-rig.blend'))
# Inspect supported glTF options before exporting.
props=bpy.ops.export_scene.gltf.get_rna_type().properties
kwargs=dict(filepath=str(ROOT/'public/models/hero.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_yup=True)
if 'export_animation_mode' in props:kwargs['export_animation_mode']='ACTIONS'
if 'export_anim_action_all_armature_actions' in props:kwargs['export_anim_action_all_armature_actions']=True
bpy.ops.export_scene.gltf(**kwargs)
body.data.calc_loop_triangles()
print('EXPORT',len(body.data.loop_triangles),'triangles',flush=True)
print('ALL ACTIONS',[(a.name,list(a.frame_range)) for a in bpy.data.actions],flush=True)
