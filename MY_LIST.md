# My list

The special commands that I used for some songs:

## Like I want you - Giveon

There's a long intro so I cut that with ffmpeg

```bash
sanitize_filename() {
  local filename="$(cat)"
  filename=$(echo "$filename" | sed 's/[][ \(\)]/_/g')
  filename=$(echo "$filename" | sed 's/[^A-Za-z0-9.\-_]//g')
  echo "$filename"
}

video="https://www.youtube.com/watch?v=flqcLoKCg4A"
video_title=$(yt-dlp -j "${video}" | jq -r ".title" | sanitize_filename)
yt-dlp -x --audio-format mp3 "${video}" -o "${video_title}.mp3"
ffmpeg -i Like_I_Want_You__Live__Wireless_Festival_London_2022_at_Finsbury_Park.mp3 -ss 00:00:55.35 -t 00:04:17 -c:v copy -c:a copy Like_I_Want_You__Giveon.mp3

# Split
demucs -n htdemucs_6s --mp3 -j`nproc` Like_I_Want_You__Giveon.mp3

# Join
cd separated/htdemucs_6s/Like_I_Want_You__Giveon/

# Optimize size
for i in bass drums guitar other piano vocals; do
  ffmpeg -i $i.mp3 -map 0:a:0 -b:a 128k $i-128.mp3
done

# Convert
ffmpeg -i bass-128.mp3 -i drums-128.mp3 -i other-128.mp3 -i piano-128.mp3 -filter_complex amix=inputs=4:normalize=0 combined.mp3
```

## Te quiero tanto - OV7

I changed the pitch to be one semitone down.
I achieved that with rubberband and this answer https://superuser.com/questions/1118826/change-tone-pitch-for-file-audio

```bash
video="https://www.youtube.com/watch?v=Y4fm-ebvAOs"
video_title=$(yt-dlp -j "${video}" | jq -r ".title" | sanitize_filename)
yt-dlp -x --audio-format mp3 "${video}" -o "${video_title}.mp3"
rubberband -p -1 "${video_title}.mp3" "${video_title}_m1.mp3"
```
