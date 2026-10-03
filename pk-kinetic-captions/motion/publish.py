#!/usr/bin/env python3
"""
Publish the PK Kinetic Caption title's text-style controls to Final Cut.

base.moti is a Final Cut Title that Motion itself created and saved, with
gradient face, outline, glow and drop shadow switched on in Motion's own
inspector (so Motion wrote those groups correctly). This adds the
<publishSettings> targets that expose their controls in Final Cut's inspector,
where the panel's export also sets them.

Text-style controls publish against the *style* object (not the text layer),
with channels relative to it: Face is ./14, Outline ./30, Glow ./38,
Drop Shadow ./21 — the same scheme Apple's own titles use (Glow Color ./38/40).

The document is edited as text, never re-serialised: ElementTree drops the
<!DOCTYPE ozxmlscene> line and Motion then hangs on open.
"""
import re, sys
from pathlib import Path

HERE = Path(__file__).parent
STYLE = '10042'          # the text's style object in base.moti
TEXT = '10011'           # the text layer

# (name shown in Final Cut, object, channel). Channel IDs confirmed in Motion
# (each control shows its parameter's default) and against installed
# templates publishing the same controls; the numbering is not regular — the
# shadow's distance is 27, its angle 29, its blur 75, the glow's blur 77, the
# outline's width 36.
CONTROLS = [
    ('Font',               STYLE, './83'),
    ('Size',               STYLE, './3'),
    ('Fill',               STYLE, './14/15'),     # 0 colour, 1 gradient, 2 texture
    ('Fill Color',         STYLE, './14/16'),
    ('Fill Gradient',      STYLE, './14/17'),
    ('Fill Opacity',       STYLE, './14/19'),
    # The gradient's two colour stops (RGB1, RGB2 inside Gradient ./14/17/1).
    # Their ids come from the gradient block copied out of Apple's Basic
    # Title, so they exist in the document even at their default values.
    ('Gradient Start',     STYLE, './14/17/1/999140132/3'),
    ('Gradient End',       STYLE, './14/17/1/999140133/3'),
    ('Outline Color',      STYLE, './30/32'),
    ('Outline Opacity',    STYLE, './30/35'),
    ('Outline Width',      STYLE, './30/36'),
    ('Glow Color',         STYLE, './38/40'),
    ('Glow Opacity',       STYLE, './38/43'),
    # Glow has two Blur parameters: 44 is inert in text glow; 77 is the one
    # Motion and Final Cut's Text inspector actually use (measured: 44 set to 80
    # left the inspector's Blur at 1 and the glow a hard rim).
    ('Glow Blur',          STYLE, './38/77'),
    ('Glow Radius',        STYLE, './38/45'),
    ('Shadow Color',       STYLE, './21/23'),
    ('Shadow Opacity',     STYLE, './21/26'),
    ('Shadow Blur',        STYLE, './21/75'),
    ('Shadow Distance',    STYLE, './21/27'),
    ('Shadow Angle',       STYLE, './21/29'),
]

def build(src: Path, dst: Path, controls=CONTROLS):
    s = src.read_text(encoding='utf-8')
    assert s.lstrip().startswith('<?xml') and '<!DOCTYPE ozxmlscene>' in s, 'not a Motion document'
    targets = ''.join(f'\n\t\t<target object="{o}" channel="{c}" name="{n}"/>' for n, o, c in controls)
    s, count = re.subn(r'(<publishSettings>\s*<version>2</version>)', r'\1' + targets, s, count=1)
    assert count == 1, 'no publishSettings block'
    dst.write_text(s, encoding='utf-8')

if __name__ == '__main__':
    # The copy here, and the one the extension bundles and installs.
    outs = [Path(sys.argv[1])] if len(sys.argv) > 1 else [
        HERE / 'PK Kinetic Caption.moti',
        HERE.parent / 'fcp-extension/Extension/Resources/title/PK Kinetic Caption.moti',
    ]
    for out in outs:
        build(HERE / 'base.moti', out)
        print(f'published {len(CONTROLS)} controls → {out}')
