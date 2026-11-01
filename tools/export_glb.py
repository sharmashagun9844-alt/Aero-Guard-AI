import bpy, sys
src, dst = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type=='MESH' and o.name!='Cube':
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_normals=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, export_animations=False)
print("EXPORTED", dst)
