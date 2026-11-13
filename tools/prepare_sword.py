import bpy
from pathlib import Path
from mathutils import Vector,Matrix
root=Path(r'E:\Game\ECHO HERO')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'art/sword/sword-original.glb'))
o=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=o
bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00003);bpy.ops.object.mode_set(mode='OBJECT')
o.data.calc_loop_triangles()
m=o.modifiers.new('Game mesh reduction','DECIMATE');m.ratio=5500/len(o.data.loop_triangles);m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
axis=Vector((-.555,0,-.57)).normalized();side=Vector((-axis.z,0,axis.x));normal=side.cross(axis)
original=Matrix((side,axis,normal)).transposed()
new=Matrix((Vector((1,0,0)),Vector((0,-1,0)),Vector((0,0,-1)))).transposed()
rotation=new @ original.transposed()
for v in o.data.vertices:v.co=rotation @ (v.co-Vector((.215,0,.71)))*1.1
o.name='Sword'
for image in bpy.data.images:
 if image.size[0]>512:image.scale(512,512);image.pack()
o.data.update();o.data.calc_loop_triangles()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/sword/sword-game.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'public/models/sword.glb'),export_format='GLB',use_selection=True,export_animations=False)
print('SWORD TRIANGLES',len(o.data.loop_triangles),flush=True)
