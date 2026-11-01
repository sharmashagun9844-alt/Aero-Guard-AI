import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[-1])
print("VERSION", bpy.app.version_string)
print("SCENES", [s.name for s in bpy.data.scenes])
print("OBJECTS", len(bpy.data.objects))
tot_v=tot_f=0
for o in bpy.data.objects:
    info=f"{o.type:8} {o.name[:40]:40} parent={o.parent.name if o.parent else None}"
    if o.type=='MESH':
        m=o.data; tot_v+=len(m.vertices); tot_f+=len(m.polygons)
        info+=f" v={len(m.vertices)} f={len(m.polygons)} mats={[s.material.name if s.material else None for s in o.material_slots]} mods={[x.type for x in o.modifiers]}"
    print(info, "dim=",tuple(round(d,2) for d in o.dimensions))
print("TOTAL verts",tot_v,"faces",tot_f)
print("MATERIALS",[m.name for m in bpy.data.materials])
print("IMAGES",[(i.name,i.size[:],i.packed_file is not None) for i in bpy.data.images])
print("ANIMS",[a.name for a in bpy.data.actions])
print("COLLECTIONS",[c.name for c in bpy.data.collections])
