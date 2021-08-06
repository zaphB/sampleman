#!/bin/bash

# change dir to this script's location
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")"

# check if repo is clean or need commit
git update-index --refresh >/dev/null 2>&1
if git diff-index --quiet HEAD --; then
  sleep 0
else
  echo "uncommitted changes exist in repo, please commit everything before building."
  exit 2
fi

if ! command -v mkfs.hfsplus >/dev/null 2>/dev/null; then
  echo "mkfs.hfsplus not found on your path"
  exit 3
fi

# install latest pkg version
echo installing latest version of pkg bundler
sudo npm install --global pkg 
echo '------------------------------------------------------'
echo 

# check if pkg binary is available
if ! command -v pkg >/dev/null 2>&1; then
  echo "pkg bundler not found on your PATH."
  exit 1
fi 

# find current sampleman version from git tags
sampleManVersion="$(git tag --points-at "$(git branch --show-current)" | grep '^v')"
installedNodeVersion="$(node --version | grep -oP '\d+\.\d+\.\d+')"
if [[ "$sampleManVersion" == "" ]]; then
  echo "current commit is not tagged as a release, building as 'interim'"
  sampleManVersion='interim'
else
  echo "BUILDING SAMPLEMAN $sampleManVersion RELEASES"
fi
echo "> node --version is v$(node --version | grep -oP '\d+\.\d+\.\d+')"
echo

# build targets 
#for target in "linux-x64" "win10-x64" "win7-x64" "macos-x64" "macos-arm64"; do
for target in "linux-x64" "win10-x64" "macos-x64" "macos-arm64"; do

  echo "begin building target $target..."

  # mangling win7 and win10 targets
  effTarget="$target"
  nodeVersion=""
  if [[ "$target" == "win7-x64" ]]; then
    effTarget="win-x64"
    nodeVersion="12.22.2"
  fi
  if [[ "$target" == "win10-x64" ]]; then
    effTarget="win-x64"
  fi

  # check latest nodejs prebuilt binary version if none is set yet
  if [[ "$nodeVersion" == "" ]]; then
    npm install --no-save semver-sort >/dev/null 2>&1
    echo "const s = require('semver-sort'); \
          console.log(s.desc(process.argv.slice(2))[0])" >.tmp-script.js
    nodeVersion="$(node .tmp-script.js $(curl "https://github.com/vercel/pkg-fetch/releases" 2>/dev/null \
                    | grep -oP '\d+\.\d+\.\d+-'"$effTarget" | grep -oP '\d+\.\d+\.\d+'))"
    rm .tmp-script.js
  fi

  echo "> using prebuilt node v$nodeVersion"

  mkdir -p releases/
  outname="sampleman-$sampleManVersion-$target-node$nodeVersion"
  pkg . --targets "node$nodeVersion-$effTarget" \
        --output "releases/$outname" \
          | grep -i "error!"
  if [[ "${PIPESTATUS[0]}" == "0" ]]; then
    created="$created\n> $outname"
    echo "> done."
  else 
    echo "> failed."
  fi
  echo
done

# store macos build in dmg containers
echo "stuffing macos builds into .dmg containers..."
echo

mkdir -p "mnt"
for f in $(ls "releases"); do
  if [[ "$(echo "$f" | cut -d'-' -f3)" == "macos" ]] && [[ "${f: -3}" != "dmg" ]]; then
    echo "begin packing $f..."
    dd if=/dev/zero of="releases/$f.dmg" bs=1M count=$(expr $(du -BM "releases/$f" | grep -oP '^\d+') + 3) >/dev/null 2>&1 \
      && mkfs.hfsplus -v sampleman "releases/$f.dmg" >/dev/null \
      && sudo mount -o loop "releases/$f.dmg" "mnt" \
      && sudo cp -a "releases/$f" "mnt/" \
      && sudo umount "mnt" \
      && rm "releases/$f"
    if [[ -e "releases/$f" ]]; then
      echo "> failed."
    else
      echo "> done."
    fi
    echo
  fi
done
rmdir "mnt"

# report how many binaries were created
if [[ "$created" == "" ]]; then
  echo "no binaries were created."
else
  echo -e "created $(echo -e "$created" | sed '/^\s*$/d' | wc -l) binaries in ./releases/: $created"
fi

