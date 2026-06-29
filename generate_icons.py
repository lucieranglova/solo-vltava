from PIL import Image, ImageDraw

SCALE = 10.24  # 100-unit viewBox -> 1024px master
BG = (19, 22, 43)        # #13162B
TEAL = (43, 196, 176)    # #2BC4B0
CORAL = (255, 140, 90)   # #FF8C5A

def s(pt):
    return (pt[0]*SCALE, pt[1]*SCALE)

def cubic_bezier(p0, c1, c2, p3, n=40):
    pts = []
    for i in range(n+1):
        t = i/n
        mt = 1-t
        x = mt**3*p0[0] + 3*mt**2*t*c1[0] + 3*mt*t**2*c2[0] + t**3*p3[0]
        y = mt**3*p0[1] + 3*mt**2*t*c1[1] + 3*mt*t**2*c2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def draw_thick_curve(draw, pts, width, fill):
    r = width / 2
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i+1]], fill=fill, width=int(width))
    for p in pts:
        draw.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=fill)

def render(size, path):
    master = Image.new("RGB", (1024, 1024), BG)
    d = ImageDraw.Draw(master)

    mountain = [s(p) for p in [(18,64),(37,38),(49,50),(65,26),(84,56),(84,74),(18,74)]]
    d.polygon(mountain, fill=TEAL)

    p0 = s((20,73)); c1 = s((34,66)); c2 = s((30,81)); p1 = s((46,77))
    c3 = s((60,74)); c4 = s((53,85)); p2 = s((70,79))
    pts = cubic_bezier(p0, c1, c2, p1) + cubic_bezier(p1, c3, c4, p2)
    draw_thick_curve(d, pts, 5.5 * SCALE, CORAL)

    final = master.resize((size, size), Image.LANCZOS)
    final.save(path)
    print("saved", path, size)

render(512, "icons/icon-512.png")
render(192, "icons/icon-192.png")
render(180, "icons/apple-touch-icon.png")
