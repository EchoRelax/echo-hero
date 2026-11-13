"""Archive, reduce, rig and preview the third-biome assets with Blender."""
import bpy,math,json,shutil,sys
from pathlib import Path
from mathutils import Vector,Euler
R=Path('E:/Game/ECHO HERO');OUT=R/'art/enemies/storm';OUT.mkdir(parents=True,exist_ok=True)

def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def setup(body):
 h=max(v.co.z for v in body.data.vertices)
 s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO'
 s.display.shading.background_type='WORLD';s.world=bpy.data.worlds.new('PreviewWorld');s.world.color=(.075,.09,.12)
 for m in bpy.data.materials:
  if m.use_nodes:
   ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower() and 'metallic' not in n.image.name.lower()]
   if ns:m.node_tree.nodes.active=ns[0]
 s.render.resolution_x=s.render.resolution_y=640;s.render.resolution_percentage=100
 bpy.ops.object.camera_add(location=(h*.3,-h*3,h*.9));c=bpy.context.object
 c.rotation_euler=(Vector((0,0,h*.5))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=h*1.6;s.camera=c
 return s,c,h

for name,budget in [('stormwisp',4000),('boss3',8000)]:
 if '--only' in sys.argv and name!=sys.argv[sys.argv.index('--only')+1]:continue
 original=OUT/f'{name}-original.glb'
 if not original.exists():shutil.copy2(R/f'public/models/{name}.glb',original)
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(original))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
 body=meshes[0];active(body);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);body.data.calc_loop_triangles()
 print('SOURCE',name,len(body.data.loop_triangles),'BOUNDS',[[min(v.co[i] for v in body.data.vertices),max(v.co[i] for v in body.data.vertices)] for i in range(3)],'RIGS',sum(o.type=='ARMATURE' for o in bpy.context.scene.objects),flush=True)
 if '--inspect' in sys.argv:
  s,c,h=setup(body)
  for view,loc in [('front',(0,-h*3,h*.7)),('side',(h*3,0,h*.7))]:
   c.location=loc;c.rotation_euler=(Vector((0,0,h*.5))-c.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(OUT/f'{name}-source-{view}.png');bpy.ops.render.render(write_still=True)
  continue
 source=len(body.data.loop_triangles)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.000015);bpy.ops.object.mode_set(mode='OBJECT')
 body.data.calc_loop_triangles();m=body.modifiers.new('UV preserving game reduction','DECIMATE');m.ratio=(budget-10)/len(body.data.loop_triangles);m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 body.data.calc_loop_triangles();assert len(body.data.loop_triangles)<=budget
 body.name='StormWispBody' if name=='stormwisp' else 'Boss3Body';body.data.name=body.name+'_GameMesh'
 rig=None;clips={}
 if name=='boss3':
  h=max(v.co.z for v in body.data.vertices)
  a=bpy.data.armatures.new('Boss3Skeleton');rig=bpy.data.objects.new('Boss3Rig',a);bpy.context.collection.objects.link(rig)
  active(rig);bpy.ops.object.mode_set(mode='EDIT')
  def bone(n,head,tail,parent=None):
   b=a.edit_bones.new(n);b.head=Vector(head)*h;b.tail=Vector(tail)*h
   if parent:b.parent=a.edit_bones[parent]
  bone('Root',(0,0,0),(0,0,.1));bone('Core',(0,0,.40),(0,0,.49),'Root')
  bone('Spine',(0,0,.49),(0,0,.59),'Core');bone('Chest',(0,0,.59),(0,0,.73),'Spine')
  bone('Neck',(0,0,.73),(0,0,.79),'Chest');bone('Head',(0,0,.79),(0,0,.97),'Neck')
  bone('Tail1',(0,0,.4),(0,0,.26),'Core');bone('Tail2',(0,0,.26),(0,0,.12),'Tail1');bone('TailTip',(0,0,.12),(0,0,.015),'Tail2')
  for side,sign in [('L',1),('R',-1)]:
   bone('UpperArm_'+side,(sign*.245,0,.69),(sign*.30,0,.49),'Chest')
   bone('Forearm_'+side,(sign*.30,0,.49),(sign*.335,-.01,.36),'UpperArm_'+side)
   bone('Hand_'+side,(sign*.335,-.01,.36),(sign*.34,-.03,.28),'Forearm_'+side)
  bpy.ops.object.mode_set(mode='OBJECT');a.bones['Root'].use_deform=False;rig.show_in_front=True
  active(body);rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.parent_set(type='ARMATURE_AUTO')
  for v in body.data.vertices:
   x,y,z=v.co/h;target=None
   if z>.79 and abs(x)<.15:target='Head'
   elif .56<z<.73 and abs(x)<.16:target='Chest'
   if target:
    for g in body.vertex_groups:g.remove([v.index])
    body.vertex_groups[target].add([v.index],1,'REPLACE')
  for v in body.data.vertices:
   top=sorted([(g.group,g.weight) for g in v.groups],key=lambda t:t[1],reverse=True)[:4];total=sum(w for _,w in top)
   assert total>0,(name,'Missing weights',v.index)
   for g in body.vertex_groups:g.remove([v.index])
   for idx,w in top:body.vertex_groups[idx].add([v.index],w/total,'REPLACE')
  for pb in rig.pose.bones:pb.rotation_mode='QUATERNION'
  def rot(n,xyz):
   q=a.bones[n].matrix_local.to_quaternion();rig.pose.bones[n].rotation_quaternion=q.inverted()@Euler(xyz,'XYZ').to_quaternion()@q
  def rise(z):rig.pose.bones['Root'].location=a.bones['Root'].matrix_local.to_quaternion().inverted()@Vector((0,0,z*h))
  def smooth(x):
   x=max(0,min(1,x));return x*x*(3-2*x)
  def channel(weight):
   rot('Chest',(-.1*weight,0,0));rot('Head',(.07*weight,0,0));rise(.055*weight)
   for side,sign in [('L',1),('R',-1)]:
    rot('UpperArm_'+side,(-1.6*weight,0,sign*.42*weight));rot('Forearm_'+side,(-.65*weight,0,0))
  rig.animation_data_create();s=bpy.context.scene;s.render.fps=30
  clips={'Hover':61,'Fly':49,'Melee':37,'VortexCast':61,'StormCast':31,'StormChannel':31}
  for clip,end in clips.items():
   act=bpy.data.actions.new(clip);act.use_fake_user=True;rig.animation_data.action=act
   for f in range(1,end+1):
    t=(f-1)/(end-1);p=t*math.tau
    for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0)
    if clip in ['Hover','Fly']:
     rise(.018*math.sin(p));rot('Chest',((.08 if clip=='Fly' else 0)+.012*math.sin(p),0,.015*math.sin(p)))
     rot('Tail1',(.04*math.sin(p),.05*math.sin(p),-.05*math.sin(p)));rot('Tail2',(.05*math.sin(p+.7),0,.08*math.sin(p)))
     rot('TailTip',(.06*math.sin(p+1.4),0,-.10*math.sin(p)))
     for side,sign in [('L',1),('R',-1)]:
      rot('UpperArm_'+side,((.12 if clip=='Fly' else 0)+.025*math.sin(p)*sign,0,sign*.08));rot('Forearm_'+side,(-.10,0,0))
    elif clip=='Melee':
     release=smooth((t-.42)/.20);recover=smooth((t-.62)/.38);wind=smooth(t/.42)*(1-release);hit=release*(1-recover)
     rot('Chest',(-.08*wind+.18*hit,0,-.25*wind+.32*hit));rot('Head',(.05*wind-.1*hit,0,0));rise(.03*wind)
     rot('UpperArm_R',(-1.1*wind-1.65*hit,0,-.12*wind));rot('Forearm_R',(-1.15*wind-.05*hit,0,0))
     rot('UpperArm_L',(-.18*hit,0,.18*wind));rot('Tail1',(0,0,.08*wind-.1*hit))
    elif clip=='VortexCast':
     release=smooth((t-.47)/.18);recover=smooth((t-.65)/.35);lift=smooth(t/.47)*(1-release);burst=release*(1-recover)
     rise(.07*lift+.025*burst);rot('Chest',(-.12*lift+.12*burst,0,0));rot('Head',(.10*lift-.08*burst,0,0))
     for side,sign in [('L',1),('R',-1)]:
      rot('UpperArm_'+side,(-1.8*lift-.65*burst,0,sign*(.28*lift+1.1*burst)));rot('Forearm_'+side,(-.5*lift-.18*burst,0,0))
     rot('Tail1',(0,0,.10*math.sin(p)));rot('Tail2',(0,0,-.12*math.sin(p)))
    elif clip=='StormCast':channel(smooth(t))
    else:
     channel(1);wave=math.sin(p)
     rot('Chest',(-.1+.025*wave,0,.035*wave));rot('Head',(.07-.015*wave,0,0))
     for side,sign in [('L',1),('R',-1)]:
      rot('UpperArm_'+side,(-1.6+.10*wave*sign,0,sign*.42));rot('Forearm_'+side,(-.65-.10*wave*sign,0,0))
     rot('Tail1',(0,.05*wave,.06*wave));rot('Tail2',(0,-.04*wave,-.08*wave))
    for pb in rig.pose.bones:
     pb.keyframe_insert(data_path='rotation_quaternion',frame=f,group=pb.name)
     if pb.name=='Root':pb.keyframe_insert(data_path='location',frame=f,group=pb.name)
   track=rig.animation_data.nla_tracks.new();track.name=clip;track.mute=True;track.strips.new(clip,1,act)
  rig.animation_data.action=bpy.data.actions['Hover'];s.frame_set(1);s.frame_end=61
 body.data.validate();body.data.update();body.data.calc_loop_triangles()
 for im in bpy.data.images:
  if im.size[0]:im.pack()
 active(body)
 if rig:rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{name}-game.blend'))
 bpy.ops.export_scene.gltf(filepath=str(R/f'public/models/{name}.glb'),export_format='GLB',use_selection=True,export_animations=bool(rig),export_animation_mode='ACTIONS')
 report={'source_triangles':source,'triangles':len(body.data.loop_triangles),'bones':len(rig.data.bones) if rig else 0,'clips':{n:(f-1)/30 for n,f in clips.items()},'method':'UV-preserving automatic collapse decimation'}
 (OUT/f'{name}-report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('RESULT',name,json.dumps(report),flush=True)
 s,c,h=setup(body)
 if rig:
  for clip,f in [('Hover',16),('Fly',13),('Melee',23),('VortexCast',28),('VortexCast',40),('StormCast',31),('StormChannel',8)]:
   rig.animation_data.action=bpy.data.actions[clip];s.frame_set(f);s.render.filepath=str(OUT/f'{clip}-{f}.png');bpy.ops.render.render(write_still=True)
 else:s.render.filepath=str(OUT/f'{name}-game.png');bpy.ops.render.render(write_still=True)
