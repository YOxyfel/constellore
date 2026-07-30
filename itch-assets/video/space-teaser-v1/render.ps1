$ErrorActionPreference = "Stop"

$assetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$silentVideo = Join-Path $assetDir "space-teaser-v1-silent.mp4"
$audioTrack = Join-Path $assetDir "space-teaser-v1-audio.wav"
$finalVideo = Join-Path $assetDir "space-teaser-v1-1080p.mp4"

$shot01 = Join-Path $assetDir "shot-01-liftoff.png"
$shot02 = Join-Path $assetDir "shot-02-warp.png"
$shot03 = Join-Path $assetDir "shot-03-black-hole.png"
$shot04 = Join-Path $assetDir "shot-04-singularity.png"

$videoFilter = @'
[0:v]scale=2200:1238:force_original_aspect_ratio=increase,crop=2200:1238,
zoompan=z='min(zoom+0.0019,1.18)':x='iw/2-(iw/zoom/2)+8*sin(on*0.55)':y='ih/2-(ih/zoom/2)+10*cos(on*0.38)':d=96:s=1920x1080:fps=24,
eq=contrast=1.04:saturation=1.05,setsar=1[v0];
[1:v]scale=2200:1238:force_original_aspect_ratio=increase,crop=2200:1238,
zoompan=z='min(1.12,1.035+on*0.0009)':x='min(iw-iw/zoom,on*(iw-iw/zoom)/95)':y='ih/2-(ih/zoom/2)+3*sin(on*0.22)':d=96:s=1920x1080:fps=24,
eq=contrast=1.05:saturation=1.08,setsar=1[v1];
[2:v]scale=2200:1238:force_original_aspect_ratio=increase,crop=2200:1238,
zoompan=z='min(1.38,1.0+on*0.0041)':x='min(iw-iw/zoom,max(0,iw*0.72-(iw/zoom)/2))':y='min(ih-ih/zoom,max(0,ih*0.43-(ih/zoom)/2))':d=96:s=1920x1080:fps=24,
eq=contrast=1.06:saturation=1.03,setsar=1[v2];
[3:v]scale=2200:1238:force_original_aspect_ratio=increase,crop=2200:1238,
zoompan=z='min(1.72,1.0+on*0.0076)':x='iw/2-(iw/zoom/2)+2*sin(on*0.4)':y='ih/2-(ih/zoom/2)+2*cos(on*0.37)':d=96:s=1920x1080:fps=24,
eq=contrast=1.10:saturation=1.06,setsar=1[v3];
[v0][v1]xfade=transition=smoothleft:duration=0.25:offset=3.75[x1];
[x1][v2]xfade=transition=fade:duration=0.25:offset=7.50[x2];
[x2][v3]xfade=transition=fadeblack:duration=0.25:offset=11.25[x3];
[x3]fade=t=out:st=14.82:d=0.43[main];
color=c=white:s=1920x1080:r=24:d=0.083[flash];
color=c=black:s=1920x1080:r=24:d=0.50[tail];
[main][flash][tail]concat=n=3:v=1:a=0,format=yuv420p[outv]
'@

& ffmpeg -y `
  -i $shot01 `
  -i $shot02 `
  -i $shot03 `
  -i $shot04 `
  -filter_complex $videoFilter `
  -map "[outv]" `
  -r 24 `
  -c:v libx264 `
  -preset slow `
  -crf 17 `
  -pix_fmt yuv420p `
  -movflags +faststart `
  $silentVideo

if ($LASTEXITCODE -ne 0) {
  throw "Silent video render failed with exit code $LASTEXITCODE."
}

$toneSource = "aevalsrc=0.045*sin(2*PI*45*t)+0.09*between(t\,0\,3.9)*sin(2*PI*(68+8*t)*t)+0.07*between(t\,3.7\,7.8)*sin(2*PI*(105+42*(t-3.7))*(t-3.7))+0.09*between(t\,7.5\,11.6)*sin(2*PI*31*t)+0.07*between(t\,11.25\,15.25)*sin(2*PI*(48+72*(t-11.25))*(t-11.25)):s=48000:d=15.833"
$noiseSource = "anoisesrc=color=brown:amplitude=0.15:d=15.833:r=48000"
$impactSource = "anoisesrc=color=white:amplitude=0.42:d=0.12:r=48000"

$audioFilter = @'
[0:a]volume=0.72[a0];
[1:a]lowpass=f=1100,highpass=f=30,volume='0.11+0.18*between(t,0,3.9)+0.11*between(t,11.2,15.2)':eval=frame[a1];
[2:a]afade=t=out:st=0:d=0.12,adelay=15250|15250[a2];
[a0][a1][a2]amix=inputs=3:duration=longest:normalize=0,
acompressor=threshold=0.12:ratio=4:attack=5:release=80,
alimiter=limit=0.90,
afade=t=out:st=15.46:d=0.37[aout]
'@

& ffmpeg -y `
  -f lavfi -i $toneSource `
  -f lavfi -i $noiseSource `
  -f lavfi -i $impactSource `
  -filter_complex $audioFilter `
  -map "[aout]" `
  -ar 48000 `
  -ac 2 `
  -c:a pcm_s16le `
  $audioTrack

if ($LASTEXITCODE -ne 0) {
  throw "Audio render failed with exit code $LASTEXITCODE."
}

& ffmpeg -y `
  -i $silentVideo `
  -i $audioTrack `
  -map 0:v:0 `
  -map 1:a:0 `
  -c:v copy `
  -c:a aac `
  -b:a 192k `
  -shortest `
  -movflags +faststart `
  $finalVideo

if ($LASTEXITCODE -ne 0) {
  throw "Final mux failed with exit code $LASTEXITCODE."
}

Write-Output $finalVideo
