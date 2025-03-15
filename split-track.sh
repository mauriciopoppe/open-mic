#!/bin/bash

set -euxo pipefail

# Usage
# ./split-track.sh -v <video-url>

while getopts v: opt; do
  case $opt in
    v) video=$OPTARG ;;
    *)
      echo 'Error in command line parsing' >&2
      exit 1
  esac
done
: ${video:?Missing -v}

video_title=$(yt-dlp -j "${video}" | jq -r ".title" | sed 's/[ \(\)]/_/g')
video_basename="${video_title}.mp3"
yt-dlp -x --audio-format mp3 "${video}" -o "${video_basename}"
demucs -n htdemucs_6s --mp3 -j`nproc` "${video_basename}"

echo "Complete, check generated files in separated/htdemucs_6s/"
