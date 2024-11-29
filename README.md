# Create backing tracks for your open mic or karaoke night

If you want a UI, check out https://github.com/stemrollerapp/stemroller.

## Setup

The steps are:

- Download dependencies
  - Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) to download your song (if you have your song skip this step)
  - Install [demucs](https://github.com/facebookresearch/demucs/) and [ffmpeg](https://ffmpeg.org/)
- Download your song with yt-dlp
- Separate the track with demucs
- Join the drums/bass/other tracks with ffmpeg into a track that you can use as your backing track!

## Requirements

Download dependencies

```
python3 -m venv venv
source venv/bin/activate
python3 -m pip install -r requirements.txt
```

## Automated track split

```
./split-track.sh -v "https://www.youtube.com/watch?v=5pVCI6cqdqk"
```

### Explanation

I'll create a backing track with drums/bass for the song
[Amarte sin Amarte by Jr](https://www.youtube.com/watch?v=pG7IS0lFPt4), first let's download the song:

```
yt-dlp -x --audio-format mp3 "https://www.youtube.com/watch?v=pG7IS0lFPt4"
[youtube] pG7IS0lFPt4: Downloading webpage
[youtube] pG7IS0lFPt4: Downloading player 2fd212f2
[download] Destination: Amarte Sin Amarte-pG7IS0lFPt4.webm
[download] 100% of 3.45MiB in 00:48
[ffmpeg] Destination: Amarte Sin Amarte-pG7IS0lFPt4.mp3
Deleting original file Amarte Sin Amarte-pG7IS0lFPt4.webm (pass -k to keep)
```

Next let's use demucs to separate the track into different instrument tracks,
I didn't have to play with flags for it to work perfectly.

```
 demucs "Amarte Sin Amarte-pG7IS0lFPt4.mp3"
Selected model is a bag of 4 models. You will see that many progress bars per track.
Separated tracks will be stored in ./separated/mdx_extra_q
Separating track Amarte Sin Amarte-pG7IS0lFPt4.mp3
100%|████████████████████████████████████████████████████████████████████████| 231.0/231.0 [01:03<00:00,  3.66seconds/s]
100%|████████████████████████████████████████████████████████████████████████| 231.0/231.0 [01:03<00:00,  3.66seconds/s]
100%|████████████████████████████████████████████████████████████████████████| 231.0/231.0 [01:05<00:00,  3.53seconds/s]
100%|████████████████████████████████████████████████████████████████████████| 231.0/231.0 [01:03<00:00,  3.61seconds/s]
```

Finally let's join the drum/bass tracks with ffmpeg, the separated tracks are in
`./separated/md_extra_q`, the combined file is `combined.wav`.

```
cd separated/mdx_extra_q/Amarte\ Sin\ Amarte-pG7IS0lFPt4/
ffmpeg -i bass.wav -i drums.wav -filter_complex amix=inputs=2:normalize=0 combined.wav
```

Finally let's convert again to mp3 for the open mic

```
ffmpeg -i combined.wav -vn -ar 44100 -ac 2 -b:a 192k amarte-sin-amarte--bass-drums.mp3
```

### Capturing more instruments in the output

Creates 6 instruments: bass, drums, other, piano, guitar, vocals.

```
demucs -n htdemucs_6s --mp3 -j 2 <input-file>
```

## Known issues

### ERROR: WARNING: unable to obtain file audio codec with ffprobe

Run `brew upgrade ffmpeg` https://github.com/ytdl-org/youtube-dl/issues/12367
