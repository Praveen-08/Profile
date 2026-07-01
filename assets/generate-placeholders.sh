#!/bin/bash
# Generates placeholder SVG images for PK Visuals
# Replace these with real photos/videos when ready

IMAGES=(
  "reel-01:Herne Bay Estate · Cinematic Video:1200:800"
  "reel-02:Remuera Villa · Drone:600:800"
  "reel-03:Ponsonby · Twilight:600:800"
  "reel-04:Agent Brand Film:1200:500"
  "case-01:Herne Bay Estate:1200:750"
  "case-02:Remuera Penthouse:1200:750"
  "cta-bg:Limited Availability:1600:900"
  "work-01:Herne Bay Estate:800:600"
  "work-02:Ponsonby Villa:800:600"
  "work-03:Remuera Penthouse:1200:525"
  "work-04:Waiheke Retreat:800:600"
  "work-05:Agent Reel:800:600"
  "work-06:Devonport Cottage:800:600"
  "work-07:Mt Eden Bungalow:800:600"
  "work-08:Takapuna Beachfront:800:1200"
  "service-photo:Photography:1200:900"
  "service-video:Cinematic Video:1200:900"
  "service-drone:Drone Aerial:1200:900"
  "service-floorplan:Floor Plans:1200:900"
  "service-twilight:Twilight Shoots:1200:900"
  "service-reel:Agent Reels:1200:900"
)

for item in "${IMAGES[@]}"; do
  IFS=: read -r name label w h <<< "$item"
  cat > "${name}.svg" << SVGEOF
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="100%" stop-color="#0d0c09"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="0" y="0" width="${w}" height="3" fill="#c9a84c" opacity="0.5"/>
  <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle"
        font-family="Georgia,serif" font-size="18" fill="#c9a84c" opacity="0.7">${label}</text>
  <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial,sans-serif" font-size="11" fill="#555" letter-spacing="3">REPLACE WITH REAL MEDIA</text>
</svg>
SVGEOF
  # Also create a jpg alias (browsers will load SVG fine with .jpg extension for placeholders)
  cp "${name}.svg" "${name}.jpg"
  echo "Created ${name}.jpg"
done
echo "Done. Replace .jpg files with real photography/video thumbnails."
