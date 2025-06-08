#!/bin/bash

set -euxo pipefail

# Usage
# ./split-track.sh -v <video-url>

if [[ -z "$VIRTUAL_ENV" ]]; then
  echo "This script must run within a virtual env, check the README.md"
  exit 1
fi

while getopts v: opt; do
  case $opt in
  v) video=$OPTARG ;;
  *)
    echo 'Error in command line parsing' >&2
    exit 1
    ;;
  esac
done
: ${video:?Missing -v}

sanitize_filename() {
  local filename="$(cat)"
  filename=$(echo "$filename" | sed 's/[][ \(\)]/_/g')
  filename=$(echo "$filename" | sed 's/[^A-Za-z0-9\.-_]//g')
  echo "$filename"
}

video_title=$(yt-dlp -j "${video}" | jq -r ".title" | sanitize_filename)
video_basename="${video_title}.mp3"
yt-dlp -x --audio-format mp3 "${video}" -o "${video_basename}"
demucs -n htdemucs_6s --mp3 -j$(nproc) "${video_basename}"

echo "Complete, check generated files in separated/htdemucs_6s/"
