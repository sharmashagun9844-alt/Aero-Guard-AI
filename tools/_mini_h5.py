"""Minimal read-only HDF5 reader (classic v0 format, contiguous float datasets only).
Used only to verify/convert Keras weights where h5py is unavailable."""
import struct
import numpy as np

class H5:
    def __init__(self, path):
        self.b = open(path, "rb").read()
        assert self.b[:8] == b"\x89HDF\r\n\x1a\n" and self.b[8] == 0
        # root symbol table entry starts at 24+32=56 for v0 superblock w/ 8-byte offsets
        root_entry = 56
        self.root_hdr = struct.unpack_from("<Q", self.b, root_entry + 8)[0]

    def _messages(self, addr):
        b = self.b
        ver, _, nmsg = struct.unpack_from("<BBH", b, addr)
        assert ver == 1
        hsize = struct.unpack_from("<I", b, addr + 8)[0]
        blocks = [(addr + 16, hsize)]
        out, i = [], 0
        while i < len(blocks):
            start, size = blocks[i]; i += 1
            p, end = start, start + size
            while p + 8 <= end:
                t, s, fl = struct.unpack_from("<HHB", b, p)
                data = b[p + 8:p + 8 + s]
                if t == 0x10:  # continuation
                    off, ln = struct.unpack_from("<QQ", data)
                    blocks.append((off, ln))
                elif t != 0:
                    out.append((t, data))
                p += 8 + s
        return out

    def _heap_name(self, heap_addr, off):
        b = self.b
        assert b[heap_addr:heap_addr + 4] == b"HEAP"
        data_addr = struct.unpack_from("<Q", b, heap_addr + 24)[0]
        s = data_addr + off
        return b[s:b.index(b"\0", s)].decode()

    def _walk_btree(self, addr, heap_addr, acc):
        b = self.b
        assert b[addr:addr + 4] == b"TREE"
        _, level, nused = struct.unpack_from("<BBH", b, addr + 4)
        p = addr + 24 + 8  # skip header(24) and key0
        for _ in range(nused):
            child = struct.unpack_from("<Q", b, p)[0]
            p += 16  # child + next key
            if level > 0:
                self._walk_btree(child, heap_addr, acc)
            else:
                assert b[child:child + 4] == b"SNOD"
                n = struct.unpack_from("<H", b, child + 6)[0]
                for k in range(n):
                    e = child + 8 + 40 * k
                    name_off, hdr = struct.unpack_from("<QQ", b, e)
                    acc[self._heap_name(heap_addr, name_off)] = hdr

    def children(self, hdr_addr):
        for t, d in self._messages(hdr_addr):
            if t == 0x11:
                bt, hp = struct.unpack_from("<QQ", d)
                acc = {}
                self._walk_btree(bt, hp, acc)
                return acc
        return {}

    def dataset(self, hdr_addr):
        shape = dtype = layout = None
        for t, d in self._messages(hdr_addr):
            if t == 0x01:
                ver, nd = d[0], d[1]
                off = 8 if ver == 1 else 4
                shape = struct.unpack_from("<%dQ" % nd, d, off) if nd else ()
            elif t == 0x03:
                cls, size = d[0] & 0x0F, struct.unpack_from("<I", d, 4)[0]
                assert cls == 1, "only floating point supported"
                dtype = {4: "<f4", 8: "<f8"}[size]
            elif t == 0x08:
                assert d[0] == 3 and d[1] == 1, "only contiguous layout supported"
                layout = struct.unpack_from("<QQ", d, 2)
        n = int(np.prod(shape)) if shape else 1
        arr = np.frombuffer(self.b, dtype=dtype, count=n, offset=layout[0]).reshape(shape)
        return arr.copy()

    def walk(self, addr=None, prefix=""):
        addr = self.root_hdr if addr is None else addr
        for name, hdr in self.children(addr).items():
            path = f"{prefix}/{name}"
            kids = self.children(hdr)
            if kids:
                yield from self.walk(hdr, path)
            else:
                try:
                    yield path, self.dataset(hdr)
                except Exception as e:
                    yield path, f"<unreadable: {e}>"

if __name__ == "__main__":
    import sys
    for p, a in H5(sys.argv[1]).walk():
        print(p, getattr(a, "shape", a), getattr(a, "dtype", ""))
