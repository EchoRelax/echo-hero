import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(r'E:/Game/ECHO HERO')
for name in ('tree',):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/f'art/forest/{name}-updated-original.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 print(name,'meshes',len(meshes),'armatures',sum(o.type=='ARMATURE' for o in bpy.context.scene.objects),flush=True)
 for o in meshes:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
  o.data.calc_loop_triangles();print('Source triangles',len(o.data.loop_triangles),flush=True)
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0]
 bpy.ops.object.join();body=bpy.context.object
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00004);bpy.ops.object.mode_set(mode='OBJECT')
 body.data.calc_loop_triangles()
 mod=body.modifiers.new('Game reduction','DECIMATE');mod.ratio=min(1,7500/len(body.data.loop_triangles));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Retain source upright Z; inspect front before committing game orientation.
 lo=Vector(tuple(min(v.co[i] for v in body.data.vertices) for i in range(3)))
 hi=Vector(tuple(max(v.co[i] for v in body.data.vertices) for i in range(3)))
 factor={'boss1':3.0,'roots':1.5,'tree':3.6}[name]/max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for v in body.data.vertices:v.co=(v.co-center)*factor
 body.name=name.capitalize()
 for image in bpy.data.images:
  if image.size[0] and (image.size[0]!=512 or image.size[1]!=512):image.scale(512,512)
  if image.size[0]:image.pack()
 body.data.update();body.data.calc_loop_triangles();print('RESULT',name,len(body.data.loop_triangles),flush=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'art/forest/{name}-game.blend'))
 bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/{name}.glb'),export_format='GLB',use_selection=True,export_animations=False)
 s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='TEXTURE';s.display.shading.light='STUDIO';s.world=bpy.data.worlds.new('World');s.world.color=(.13,.16,.19)
 for m in bpy.data.materials:
  if m.use_nodes:
   ns=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'metallic' not in n.image.name]
   if ns:m.node_tree.nodes.active=ns[0]
 bpy.ops.object.camera_add(location=(2.8,-6,2.9));c=bpy.context.object;c.rotation_euler=(Vector((0,0,1.4))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=4.5;s.camera=c
 s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.filepath=str(ROOT/f'art/forest/{name}-preview.png');bpy.ops.render.render(write_still=True)
